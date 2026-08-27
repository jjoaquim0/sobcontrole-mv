import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  createDocumentExtractionHandler,
  DocumentExtractionPersistenceError,
  type AuthorizedDocumentVersion,
  type DocumentExtractionDependencies,
} from '../_shared/document-import/handler.ts';

const corsOrigins = (value: string | undefined): string[] => {
  const origins = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins && origins.length > 0 ? origins : ['*'];
};

const unavailableResponse = (): Response =>
  new Response(
    JSON.stringify({
      error: {
        code: 'configuration_error',
        message: 'A extracao de documentos nao esta configurada neste ambiente.',
      },
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    },
  );

const createPersistenceError = (code?: string): DocumentExtractionPersistenceError =>
  new DocumentExtractionPersistenceError(code);

const createDependencies = (): DocumentExtractionDependencies | null => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return null;

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    allowedOrigins: corsOrigins(Deno.env.get('AI_ALLOWED_ORIGINS')),
    authenticate: async (authorization) => {
      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (!match) return null;

      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(match[1]);
      return error || !user ? null : { userId: user.id, accessToken: match[1] };
    },
    resolveDocument: async (identity, documentVersionId): Promise<AuthorizedDocumentVersion | null> => {
      const userClient = createClient(supabaseUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: 'Bearer ' + identity.accessToken } },
      });

      const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('id, company_id, role')
        .eq('id', identity.userId)
        .maybeSingle();
      if (profileError || !profile?.company_id || profile.id !== identity.userId) return null;

      const { data: company, error: companyError } = await userClient
        .from('companies')
        .select('id, cnpj')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (companyError || !company || company.id !== profile.company_id) return null;

      const { data: version, error: versionError } = await userClient
        .from('document_versions')
        .select('id, document_id, company_id, storage_path, mime_type')
        .eq('id', documentVersionId)
        .eq('company_id', profile.company_id)
        .maybeSingle();
      if (
        versionError ||
        !version ||
        version.company_id !== profile.company_id ||
        typeof version.storage_path !== 'string'
      ) {
        return null;
      }

      const { data: document, error: documentError } = await userClient
        .from('documents')
        .select('id, company_id, category, status, deleted_at')
        .eq('id', version.document_id)
        .eq('company_id', profile.company_id)
        .maybeSingle();
      if (
        documentError ||
        !document ||
        document.company_id !== profile.company_id ||
        document.deleted_at !== null ||
        document.status !== 'active'
      ) {
        return null;
      }

      return {
        userId: identity.userId,
        companyId: profile.company_id,
        companyCnpj: typeof company.cnpj === 'string' ? company.cnpj : '',
        documentVersionId: version.id,
        documentId: document.id,
        category: String(document.category ?? ''),
        mimeType: String(version.mime_type ?? ''),
        storagePath: version.storage_path,
        readXml: async () => {
          const { data, error } = await userClient.storage
            .from('documents')
            .download(version.storage_path);
          if (error || !data) throw createPersistenceError();
          return data.text();
        },
      };
    },
    createJob: async (input) => {
      const { data, error } = await serviceClient
        .from('document_extraction_jobs')
        .insert(input)
        .select('id')
        .single();
      if (error || !data?.id) throw createPersistenceError(error?.code);
      return { id: String(data.id) };
    },
    markJobRunning: async (jobId, companyId) => {
      const { error } = await serviceClient
        .from('document_extraction_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('company_id', companyId);
      if (error) throw createPersistenceError(error.code);
    },
    createProposal: async (input) => {
      const { items, ...proposalInput } = input;
      const { data, error } = await serviceClient
        .from('document_import_proposals')
        .insert(proposalInput)
        .select('id')
        .single();
      if (error) throw createPersistenceError(error.code);
      if (!data?.id) throw createPersistenceError();

      if (items.length > 0) {
        const { error: itemsError } = await serviceClient
          .from('document_import_proposal_items')
          .insert(items.map((item) => ({
            proposal_id: data.id,
            company_id: input.company_id,
            position: item.position,
            payload: item.payload,
            field_origins: item.field_origins,
            matched_product_id: item.matched_product_id,
            current_cost: item.current_cost,
            document_cost: item.document_cost,
            update_cost_decision: item.update_cost_decision,
          })));
        if (itemsError) {
          await serviceClient
            .from('document_import_proposals')
            .delete()
            .eq('id', data.id)
            .eq('company_id', input.company_id);
          throw createPersistenceError(itemsError.code);
        }
      }
    },
    markJobDone: async (jobId, companyId) => {
      const { error } = await serviceClient
        .from('document_extraction_jobs')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('company_id', companyId);
      if (error) throw createPersistenceError(error.code);
    },
    markJobFailed: async (jobId, companyId, code) => {
      const { error } = await serviceClient
        .from('document_extraction_jobs')
        .update({
          status: 'failed',
          error: code,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('company_id', companyId);
      if (error) throw createPersistenceError(error.code);
    },
    setDocumentSource: async (documentId, companyId, source) => {
      const { error } = await serviceClient
        .from('documents')
        .update({ source })
        .eq('id', documentId)
        .eq('company_id', companyId);
      if (error) throw createPersistenceError(error.code);
    },
    waitUntil: (task) => EdgeRuntime.waitUntil(task),
    logger: (event) => console.log(JSON.stringify(event)),
  };
};

let handler: ((request: Request) => Promise<Response>) | undefined;

Deno.serve(async (request: Request): Promise<Response> => {
  if (!handler) {
    const dependencies = createDependencies();
    if (!dependencies) return unavailableResponse();
    handler = createDocumentExtractionHandler(dependencies);
  }
  return handler(request);
});
