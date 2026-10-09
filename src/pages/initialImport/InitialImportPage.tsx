import { ChangeEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileUp, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { getImportReferences, runImportAction } from '@/services/initialImportService';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { Badge } from '@/pages/peopleDocs/components/PeopleDocsPrimitives';
import { IMPORT_TEMPLATES, ImportKind, ImportPlan, parseCsv, planImport, PlannedRow, templateCsv } from './importDomain';

type RowResult = PlannedRow & { result?: 'done' | 'failed'; resultMessage?: string };

const stateBadge = (row: RowResult) => {
  if (row.result === 'done') return <Badge color="green">Importado</Badge>;
  if (row.result === 'failed') return <Badge color="red">Falhou</Badge>;
  if (row.state === 'ready') return <Badge color="blue">Pronto</Badge>;
  if (row.state === 'skip') return <Badge color="gray">Ignorado</Badge>;
  return <Badge color="red">Com erro</Badge>;
};

const downloadTemplate = (kind: ImportKind) => {
  const blob = new Blob([`\uFEFF${templateCsv(kind)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `modelo-${IMPORT_TEMPLATES[kind].label.toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const InitialImportPage = () => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ImportKind>('posts');
  const [fileName, setFileName] = useState<string>();
  const [plan, setPlan] = useState<ImportPlan>();
  const [rows, setRows] = useState<RowResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const reset = () => { setPlan(undefined); setRows([]); setFileName(undefined); };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) { toast.error('Use um arquivo CSV de até 1 MB.'); return; }
    setIsChecking(true);
    try {
      const [text, refs] = await Promise.all([file.text(), getImportReferences()]);
      const nextPlan = planImport(kind, parseCsv(text), refs);
      setFileName(file.name);
      setPlan(nextPlan);
      setRows(nextPlan.rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    } finally {
      setIsChecking(false);
    }
  };

  const ready = rows.filter((row) => row.state === 'ready' && !row.result);
  const runImport = async () => {
    setIsImporting(true);
    const next = [...rows];
    for (let position = 0; position < next.length; position += 1) {
      const row = next[position];
      if (row.state !== 'ready' || row.result || !row.action) continue;
      try {
        await runImportAction(row.action);
        next[position] = { ...row, result: 'done' };
      } catch (error) {
        next[position] = { ...row, result: 'failed', resultMessage: error instanceof Error ? error.message : 'Erro ao gravar.' };
      }
      setRows([...next]);
    }
    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['obligations'] });
    queryClient.invalidateQueries({ queryKey: ['people-docs'] });
    const done = next.filter((row) => row.result === 'done').length;
    const failed = next.filter((row) => row.result === 'failed').length;
    if (failed) toast.error(`${done} linha(s) importada(s) e ${failed} com falha. Veja o motivo em cada linha.`);
    else toast.success(`${done} linha(s) importada(s).`);
  };

  const template = IMPORT_TEMPLATES[kind];
  const counts = {
    ready: rows.filter((row) => row.state === 'ready').length,
    skip: rows.filter((row) => row.state === 'skip').length,
    error: rows.filter((row) => row.state === 'error').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Importação inicial" subtitle="Carga controlada de postos, alocações e obrigações a partir de planilha (CSV)." />
      <HowToPanel
        id="importacao-inicial"
        steps={[
          'Cadastre os contratos e os funcionários antes. A importação liga postos e alocações ao que já existe.',
          'Baixe o modelo, preencha na planilha e salve como CSV.',
          'Envie o arquivo: nada é gravado até você conferir a lista e clicar em Importar.',
          'Importe primeiro os postos, depois as alocações e por fim as obrigações.',
        ]}
        note="Importe somente os dados necessários ao fluxo. Linhas repetidas ou já cadastradas são ignoradas, então é seguro reenviar o mesmo arquivo."
      />

      <section className={`${cardClass} grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_auto]`} aria-label="Arquivo">
        <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">O que importar</span>
          <select className={inputClass} value={kind} disabled={isImporting} onChange={(event) => { setKind(event.target.value as ImportKind); reset(); }}>
            {(Object.keys(IMPORT_TEMPLATES) as ImportKind[]).map((key) => <option key={key} value={key}>{IMPORT_TEMPLATES[key].label}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => downloadTemplate(kind)} className={secondaryButtonClass}><Download className="h-4 w-4" />Baixar modelo</button>
        <label className={`${primaryButtonClass} cursor-pointer ${isChecking || isImporting ? 'pointer-events-none opacity-60' : ''}`}>
          {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Enviar CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Arquivo CSV" onChange={onFile} disabled={isChecking || isImporting} />
        </label>
        <p className="text-xs text-gray-500 sm:col-span-3">Colunas: {template.columns.join(', ')}. {template.help}</p>
      </section>

      {plan?.headerError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{plan.headerError}</p>}

      {rows.length > 0 && (
        <section className={`${cardClass} space-y-4`} aria-label="Conferência do arquivo">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">{fileName}</span>: {counts.ready} pronta(s), {counts.skip} ignorada(s), {counts.error} com erro.</p>
            <button type="button" disabled={isImporting || ready.length === 0} onClick={runImport} className={primaryButtonClass}>{isImporting && <Loader2 className="h-4 w-4 animate-spin" />}Importar {ready.length} linha(s)</button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/5" aria-label="Linhas do arquivo">
            {rows.map((row) => (
              <li key={row.line} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white"><span className="mr-2 text-xs font-normal text-gray-400">linha {row.line}</span>{row.label}</p>
                  {(row.resultMessage || row.message) && (
                    <p className={`mt-0.5 flex items-center gap-1 text-xs ${row.result === 'failed' || row.state === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                      {row.result === 'failed' || row.state === 'error' ? <XCircle className="h-3 w-3" /> : null}{row.resultMessage || row.message}
                    </p>
                  )}
                  {row.result === 'done' && <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" />Gravado</p>}
                </div>
                {stateBadge(row)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
