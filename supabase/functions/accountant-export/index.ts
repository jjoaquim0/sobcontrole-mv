import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  dedupeFileName,
  formatCsvDate,
  formatCsvMonth,
  formatCsvNumber,
  normalizeFileName,
  serializeCsv,
} from '../_shared/tax/csv.ts';
import { createZip, type ZipEntry } from '../_shared/tax/zip.ts';

/**
 * Story 1.32 — Pacote mensal para o contador.
 *
 * Toda leitura de negócio usa o JWT do usuário, com RLS ativa. O service_role
 * é usado apenas para gravar o pacote no Storage — nunca para ler dado de
 * empresa. Isso torna o vazamento entre tenants impossível por construção: a
 * própria RLS já filtra tudo que a função consegue enxergar.
 */

const VERSAO_LAYOUT = '1.0';
/** Teto do pacote. Acima disso a exportação é recusada, nunca truncada. */
const MAX_PACKAGE_BYTES = 45 * 1024 * 1024;
const STORAGE_BUCKET = Deno.env.get('ACCOUNTANT_EXPORT_BUCKET') ?? 'documents';
const SIGNED_URL_TTL_SECONDS = 600;

const parseAllowedOrigins = (value: string | undefined): string[] => {
  const origins = value?.split(',').map((origin) => origin.trim()).filter(Boolean);
  return origins && origins.length > 0 ? origins : ['*'];
};

const corsHeaders = (origin: string): Record<string, string> => ({
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': origin,
  'Content-Type': 'application/json',
  Vary: 'Origin',
});

const errorResponse = (
  code: string,
  message: string,
  status: number,
  origin: string,
  requestId: string,
): Response =>
  new Response(JSON.stringify({ error: { code, message }, request_id: requestId }), {
    status,
    headers: corsHeaders(origin),
  });

const monthStart = (month: string): string => `${month}-01`;

const monthEnd = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
};

const isValidMonth = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

interface ExportRequest {
  fromMonth: string;
  toMonth: string;
  includeDocuments: boolean;
}

const parseRequest = (body: unknown): ExportRequest | null => {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  if (!isValidMonth(record.fromMonth) || !isValidMonth(record.toMonth)) return null;
  if (record.fromMonth > record.toMonth) return null;
  return {
    fromMonth: record.fromMonth,
    toMonth: record.toMonth,
    includeDocuments: record.includeDocuments !== false,
  };
};

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const requestOrigin = request.headers.get('Origin');
  const responseOrigin = requestOrigin ?? '*';
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('AI_ALLOWED_ORIGINS'));

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(responseOrigin) });
  }
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Método não suportado.', 405, responseOrigin, requestId);
  }
  if (!allowedOrigins.includes('*') && (!requestOrigin || !allowedOrigins.includes(requestOrigin))) {
    return errorResponse('origin_not_allowed', 'Origem não autorizada.', 403, responseOrigin, requestId);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return errorResponse('configuration_error', 'Exportação não configurada.', 503, responseOrigin, requestId);
  }

  const log = (event: Record<string, unknown>) => console.log(JSON.stringify(event));

  try {
    const authMatch = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '');
    if (!authMatch) {
      return errorResponse('unauthorized', 'Sessão inválida ou expirada.', 401, responseOrigin, requestId);
    }
    const accessToken = authMatch[1];

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return errorResponse('unauthorized', 'Sessão inválida ou expirada.', 401, responseOrigin, requestId);
    }

    // Cliente por request com o JWT: a RLS decide tudo que é legível.
    const scoped = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: profile } = await scoped
      .from('profiles')
      .select('company_id, role, name')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return errorResponse('company_unavailable', 'Empresa não identificada.', 409, responseOrigin, requestId);
    }
    if (profile.role !== 'admin' && profile.role !== 'manager') {
      log({ event: 'accountant_export_denied', request_id: requestId, reason: 'role' });
      return errorResponse(
        'permission_denied',
        'Apenas administradores e gerentes podem exportar.',
        403,
        responseOrigin,
        requestId,
      );
    }

    const parsed = parseRequest(await request.json().catch(() => null));
    if (!parsed) {
      return errorResponse(
        'invalid_request',
        'Informe uma competência inicial e final válidas (AAAA-MM).',
        422,
        responseOrigin,
        requestId,
      );
    }

    const companyId = String(profile.company_id);
    const dateFrom = monthStart(parsed.fromMonth);
    const dateTo = monthEnd(parsed.toMonth);
    const encoder = new TextEncoder();
    const entries: ZipEntry[] = [];
    const omissions: string[] = [];

    const [company, taxProfile, sales, saleItems, purchases, purchaseItems, receivables, payables, assessments, obligations, documents] =
      await Promise.all([
        scoped.from('companies').select('name, cnpj').eq('id', companyId).maybeSingle(),
        scoped.from('company_tax_profile').select('regime, simples_anexo, revenue_basis').eq('company_id', companyId).maybeSingle(),
        scoped.from('sales').select('id, created_at, customer_id, total, discount, fee, final_value, payment_method, payment_status, customers(full_name, document)').eq('company_id', companyId).gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59.999`),
        scoped.from('sale_items').select('sale_id, quantity, unit_price, subtotal, products(name, sku, unit), sales!inner(company_id, created_at)').eq('sales.company_id', companyId).gte('sales.created_at', `${dateFrom}T00:00:00`).lte('sales.created_at', `${dateTo}T23:59:59.999`),
        scoped.from('purchases').select('id, created_at, total_amount, discount, fee, final_value, status, payment_method, suppliers(name, document)').eq('company_id', companyId).gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59.999`),
        scoped.from('purchase_items').select('purchase_id, quantity, unit_cost, subtotal, products(name, sku), purchases!inner(company_id, created_at)').eq('purchases.company_id', companyId).gte('purchases.created_at', `${dateFrom}T00:00:00`).lte('purchases.created_at', `${dateTo}T23:59:59.999`),
        scoped.from('account_receivables').select('due_date, paid_at, amount, status, payment_method, description, sale_id').eq('company_id', companyId).gte('due_date', dateFrom).lte('due_date', dateTo),
        scoped.from('account_payables').select('due_date, paid_at, amount, status, payment_method, description, purchase_id, origin').eq('company_id', companyId).gte('due_date', dateFrom).lte('due_date', dateTo),
        scoped.from('tax_assessments').select('*').eq('company_id', companyId).gte('reference_month', dateFrom).lte('reference_month', dateTo),
        scoped.from('tax_obligations').select('*').eq('company_id', companyId).gte('reference_month', dateFrom).lte('reference_month', dateTo),
        parsed.includeDocuments
          ? scoped.from('documents').select('id, name, category, related_type, created_at, file_path').eq('company_id', companyId).gte('created_at', `${dateFrom}T00:00:00`).lte('created_at', `${dateTo}T23:59:59.999`)
          : Promise.resolve({ data: [], error: null }),
      ]);

    const rows = <T>(result: { data: T[] | null }): T[] => result.data ?? [];

    const addCsv = <T>(name: string, data: T[], columns: Parameters<typeof serializeCsv<T>>[1]) => {
      entries.push({ name, data: encoder.encode(serializeCsv(data, columns)) });
      return data.length;
    };

    const counts: Record<string, number> = {};

    counts['vendas.csv'] = addCsv('vendas.csv', rows(sales), [
      { header: 'Data', value: (r) => formatCsvDate(r.created_at) },
      { header: 'Venda', value: (r) => r.id },
      { header: 'Cliente', value: (r) => r.customers?.full_name ?? '' },
      { header: 'CPF/CNPJ', value: (r) => r.customers?.document ?? '' },
      { header: 'Valor bruto', value: (r) => formatCsvNumber(r.total) },
      { header: 'Desconto', value: (r) => formatCsvNumber(r.discount) },
      { header: 'Acréscimo', value: (r) => formatCsvNumber(r.fee) },
      { header: 'Valor final', value: (r) => formatCsvNumber(r.final_value) },
      { header: 'Método', value: (r) => r.payment_method },
      { header: 'Situação', value: (r) => r.payment_status },
    ]);

    counts['vendas_itens.csv'] = addCsv('vendas_itens.csv', rows(saleItems), [
      { header: 'Venda', value: (r) => r.sale_id },
      { header: 'Produto', value: (r) => r.products?.name ?? '' },
      { header: 'SKU', value: (r) => r.products?.sku ?? '' },
      { header: 'Unidade', value: (r) => r.products?.unit ?? '' },
      { header: 'Quantidade', value: (r) => formatCsvNumber(r.quantity, 3) },
      { header: 'Preço unitário', value: (r) => formatCsvNumber(r.unit_price) },
      { header: 'Subtotal', value: (r) => formatCsvNumber(r.subtotal) },
    ]);

    counts['compras.csv'] = addCsv('compras.csv', rows(purchases), [
      { header: 'Data', value: (r) => formatCsvDate(r.created_at) },
      { header: 'Compra', value: (r) => r.id },
      { header: 'Fornecedor', value: (r) => r.suppliers?.name ?? '' },
      { header: 'CNPJ', value: (r) => r.suppliers?.document ?? '' },
      { header: 'Valor bruto', value: (r) => formatCsvNumber(r.total_amount) },
      { header: 'Desconto', value: (r) => formatCsvNumber(r.discount) },
      { header: 'Acréscimo', value: (r) => formatCsvNumber(r.fee) },
      { header: 'Valor final', value: (r) => formatCsvNumber(r.final_value) },
      { header: 'Método', value: (r) => r.payment_method },
      { header: 'Situação', value: (r) => r.status },
    ]);

    counts['compras_itens.csv'] = addCsv('compras_itens.csv', rows(purchaseItems), [
      { header: 'Compra', value: (r) => r.purchase_id },
      { header: 'Produto', value: (r) => r.products?.name ?? '' },
      { header: 'SKU', value: (r) => r.products?.sku ?? '' },
      { header: 'Quantidade', value: (r) => formatCsvNumber(r.quantity, 3) },
      { header: 'Custo unitário', value: (r) => formatCsvNumber(r.unit_cost) },
      { header: 'Subtotal', value: (r) => formatCsvNumber(r.subtotal) },
    ]);

    counts['recebimentos.csv'] = addCsv('recebimentos.csv', rows(receivables), [
      { header: 'Vencimento', value: (r) => formatCsvDate(r.due_date) },
      { header: 'Quitação', value: (r) => formatCsvDate(r.paid_at) },
      { header: 'Valor', value: (r) => formatCsvNumber(r.amount) },
      { header: 'Situação', value: (r) => r.status },
      { header: 'Método', value: (r) => r.payment_method },
      { header: 'Origem', value: (r) => (r.sale_id ? 'Venda' : 'Lançamento manual') },
      { header: 'Descrição', value: (r) => r.description },
    ]);

    counts['pagamentos.csv'] = addCsv('pagamentos.csv', rows(payables), [
      { header: 'Vencimento', value: (r) => formatCsvDate(r.due_date) },
      { header: 'Quitação', value: (r) => formatCsvDate(r.paid_at) },
      { header: 'Valor', value: (r) => formatCsvNumber(r.amount) },
      { header: 'Situação', value: (r) => r.status },
      { header: 'Método', value: (r) => r.payment_method },
      {
        header: 'Origem',
        value: (r) =>
          r.origin === 'tax'
            ? 'Guia tributária'
            : r.purchase_id
              ? 'Compra'
              : 'Lançamento manual',
      },
      { header: 'Descrição', value: (r) => r.description },
    ]);

    counts['apuracao.csv'] = addCsv('apuracao.csv', rows(assessments), [
      { header: 'Competência', value: (r) => formatCsvMonth(r.reference_month) },
      { header: 'Regime', value: (r) => r.regime },
      { header: 'Regime IBS/CBS', value: (r) => r.ibs_cbs_regime },
      { header: 'Receita da base', value: (r) => formatCsvNumber(r.gross_revenue_month) },
      { header: 'RBT12', value: (r) => formatCsvNumber(r.rbt12) },
      { header: 'Base tributável', value: (r) => formatCsvNumber(r.total_taxable_base) },
      { header: 'Imposto estimado', value: (r) => formatCsvNumber(r.estimated_tax) },
      { header: 'Valor confirmado', value: (r) => formatCsvNumber(r.confirmed_amount) },
      { header: 'Divergência (%)', value: (r) => formatCsvNumber(r.variance_pct) },
      { header: 'Cobertura de classificação', value: (r) => formatCsvNumber(r.classification_coverage, 4) },
      { header: 'Situação', value: (r) => (r.status === 'confirmed' ? 'Confirmada' : 'Estimada') },
      { header: 'Catálogo pendente de validação', value: (r) => Boolean(r.requires_catalog_validation) },
    ]);

    const documentEntries = rows(documents);
    const takenNames = new Set<string>();
    const documentPaths = new Map<string, string>();

    counts['obrigacoes.csv'] = addCsv('obrigacoes.csv', rows(obligations), [
      { header: 'Guia', value: (r) => r.label },
      { header: 'Tipo', value: (r) => r.kind },
      { header: 'Competência', value: (r) => formatCsvMonth(r.reference_month) },
      { header: 'Vencimento', value: (r) => formatCsvDate(r.due_date) },
      { header: 'Valor', value: (r) => formatCsvNumber(r.amount) },
      { header: 'Situação', value: (r) => r.status },
      { header: 'Pagamento', value: (r) => formatCsvDate(r.paid_at) },
      { header: 'Lançamento manual', value: (r) => Boolean(r.is_manual) },
      { header: 'Comprovante', value: (r) => (r.document_id ? documentPaths.get(String(r.document_id)) ?? '' : '') },
    ]);

    // Coleta dos binários. Documento inacessível ou ausente é registrado no
    // manifesto — nunca derruba o fechamento do mês.
    if (parsed.includeDocuments) {
      for (const document of documentEntries) {
        const path = (document as { file_path?: string }).file_path;
        if (!path) {
          omissions.push(`${document.name}: sem arquivo associado`);
          continue;
        }
        const { data: file, error } = await scoped.storage.from(STORAGE_BUCKET).download(path);
        if (error || !file) {
          omissions.push(`${document.name}: arquivo indisponível no armazenamento`);
          continue;
        }
        const fileName = dedupeFileName(normalizeFileName(String(document.name)), takenNames);
        const entryName = `documentos/${fileName}`;
        documentPaths.set(String(document.id), entryName);
        entries.push({ name: entryName, data: new Uint8Array(await file.arrayBuffer()) });
      }
    }

    counts['documentos.csv'] = addCsv('documentos.csv', documentEntries, [
      { header: 'Documento', value: (r) => r.name },
      { header: 'Categoria', value: (r) => r.category },
      { header: 'Vínculo', value: (r) => r.related_type },
      { header: 'Data', value: (r) => formatCsvDate(r.created_at) },
      { header: 'Arquivo no pacote', value: (r) => documentPaths.get(String(r.id)) ?? 'Não incluído' },
    ]);

    const generatedAt = new Date().toISOString();
    const manifest = [
      ['Razão social', company.data?.name ?? ''],
      ['CNPJ', company.data?.cnpj ?? ''],
      ['Regime', taxProfile.data?.regime ?? 'Não configurado'],
      ['Anexo', taxProfile.data?.simples_anexo ?? ''],
      ['Base de receita', taxProfile.data?.revenue_basis ?? ''],
      ['Competência inicial', formatCsvMonth(parsed.fromMonth)],
      ['Competência final', formatCsvMonth(parsed.toMonth)],
      ['Gerado em', generatedAt],
      ['Fuso aplicado', 'UTC'],
      ['Solicitado por', String(profile.name ?? '')],
      ['Versão do layout', VERSAO_LAYOUT],
      ...Object.entries(counts).map(([file, count]) => [`Linhas em ${file}`, String(count)]),
      ['Documentos incluídos', String(documentPaths.size)],
      ['Documentos omitidos', String(omissions.length)],
      ...omissions.map((reason, index) => [`Omissão ${index + 1}`, reason]),
    ];

    entries.push({
      name: 'manifesto.csv',
      data: encoder.encode(
        serializeCsv(manifest, [
          { header: 'Campo', value: (row) => row[0] },
          { header: 'Valor', value: (row) => row[1] },
        ]),
      ),
    });

    entries.push({
      name: 'LEIA-ME.txt',
      data: encoder.encode(
        [
          'PACOTE GERENCIAL PARA CONTABILIDADE — SobControle',
          `Versão do layout: ${VERSAO_LAYOUT}`,
          '',
          'ARQUIVOS',
          'manifesto.csv ......... identificação, competência e contagem de linhas',
          'vendas.csv ............ vendas do período com cliente e forma de pagamento',
          'vendas_itens.csv ...... itens das vendas com produto, quantidade e valor',
          'compras.csv ........... compras do período com fornecedor',
          'compras_itens.csv ..... itens das compras',
          'recebimentos.csv ...... contas a receber com vencimento e quitação',
          'pagamentos.csv ........ contas a pagar, incluindo guias tributárias',
          'apuracao.csv .......... apuração mensal estimada e valor confirmado',
          'obrigacoes.csv ........ guias emitidas, vencimentos e comprovantes',
          'documentos.csv ........ índice dos documentos anexados',
          'documentos/ ........... arquivos anexados no período',
          '',
          'FORMATO',
          'CSV em UTF-8 com BOM, separador ponto e vírgula, decimal com vírgula,',
          'datas em DD/MM/AAAA. Abre diretamente no Excel em português.',
          '',
          `BASE DE RECEITA: ${taxProfile.data?.revenue_basis === 'caixa' ? 'regime de caixa' : 'competência'}`,
          '',
          'AVISO IMPORTANTE',
          'Os valores de apuração deste pacote são ESTIMATIVAS GERENCIAIS geradas',
          'a partir dos dados operacionais do sistema. Não constituem apuração',
          'fiscal, não têm validade declaratória e não substituem o trabalho do',
          'contador responsável. A coluna de classificação fiscal reflete o que foi',
          'cadastrado pelo cliente e pode ser corrigida por quem tem competência',
          'técnica para tanto.',
        ].join('\r\n'),
      ),
    });

    const totalBytes = entries.reduce((sum, entry) => sum + entry.data.length, 0);
    if (totalBytes > MAX_PACKAGE_BYTES) {
      return errorResponse(
        'package_too_large',
        'O pacote ficou grande demais. Reduza o intervalo de competências ou desmarque os documentos.',
        413,
        responseOrigin,
        requestId,
      );
    }

    const zip = createZip(entries);
    const objectPath = `${companyId}/exportacoes/contador-${parsed.fromMonth}-a-${parsed.toMonth}-${Date.now()}.zip`;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: uploadError } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, zip, { contentType: 'application/zip', upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    const { data: signed, error: signError } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) throw new Error(signError?.message ?? 'signed url failed');

    log({
      event: 'accountant_export_ok',
      request_id: requestId,
      company_id: companyId,
      files: entries.length,
      bytes: zip.length,
      omissions: omissions.length,
    });

    return new Response(
      JSON.stringify({
        url: signed.signedUrl,
        expires_in: SIGNED_URL_TTL_SECONDS,
        files: entries.length,
        bytes: zip.length,
        omissions,
        request_id: requestId,
      }),
      { status: 200, headers: corsHeaders(responseOrigin) },
    );
  } catch (error) {
    log({
      event: 'accountant_export_failed',
      request_id: requestId,
      detail: error instanceof Error ? error.message : 'unknown',
    });
    return errorResponse('internal_error', 'Não foi possível gerar o pacote.', 500, responseOrigin, requestId);
  }
});
