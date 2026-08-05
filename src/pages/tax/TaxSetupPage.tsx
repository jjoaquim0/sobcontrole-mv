import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import {
  lookupCompanyRegistry,
  saveTaxProfile,
  type RegistryLookupResult,
  type SaveTaxProfileInput,
} from '../../services/taxAssessmentService';
import { useTaxProfile } from '../../hooks/useTax';
import type { SimplesAnexo } from '../../services/taxProfileDerivation';

const REGIME_OPTIONS: Array<{ value: SaveTaxProfileInput['regime']; label: string }> = [
  { value: 'mei', label: 'MEI' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

const ANEXOS: SimplesAnexo[] = ['I', 'II', 'III', 'IV', 'V'];

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-white/80';

export const TaxSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const profileQuery = useTaxProfile();

  const [lookup, setLookup] = useState<RegistryLookupResult | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const [form, setForm] = useState<SaveTaxProfileInput>({
    regime: 'simples_nacional',
    simplesAnexo: null,
    meiActivityType: null,
    uf: '',
    municipio: '',
    codigoMunicipioIbge: '',
    issRate: 0,
    revenueBasis: 'competencia',
    rbt12Initial: 0,
    rbt12InitialReferenceMonth: null,
    fatorREnabled: false,
    cnaePrincipal: '',
    cnaesSecundarios: [],
    source: 'manual',
    sourceFetchedAt: null,
  });

  // Perfil já existente entra no formulário para reconfirmação.
  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setForm((current) => ({
      ...current,
      regime: profile.regime,
      simplesAnexo: profile.anexo,
      meiActivityType: profile.meiActivityType,
      uf: profile.uf,
      municipio: profile.municipio,
      revenueBasis: profile.revenueBasis,
      rbt12Initial: profile.rbt12Initial,
      rbt12InitialReferenceMonth: profile.rbt12InitialReferenceMonth,
      fatorREnabled: profile.fatorREnabled,
    }));
  }, [profileQuery.data]);

  const runLookup = async () => {
    setIsLooking(true);
    setLookupError(null);
    try {
      const result = await lookupCompanyRegistry();
      setLookup(result);

      const { derived } = result;
      setForm((current) => ({
        ...current,
        // Regime indeterminado NÃO sobrescreve a escolha do usuário: nulo na
        // base pública significa "desconhecido", não "não optante".
        regime: derived.regime === 'indeterminado' ? current.regime : derived.regime,
        // Anexo só é pré-selecionado com confiança alta.
        simplesAnexo:
          derived.anexoConfidence === 'alta' ? derived.suggestedAnexo : current.simplesAnexo,
        meiActivityType: derived.suggestedMeiActivityType ?? current.meiActivityType,
        uf: derived.uf || current.uf,
        municipio: derived.municipio || current.municipio,
        codigoMunicipioIbge: derived.codigoMunicipioIbge || current.codigoMunicipioIbge,
        cnaePrincipal: derived.cnaePrincipal,
        cnaesSecundarios: derived.cnaesSecundarios,
        source: 'receita',
        sourceFetchedAt: result.fetchedAt,
      }));
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Falha na consulta.');
    } finally {
      setIsLooking(false);
    }
  };

  const update = <K extends keyof SaveTaxProfileInput>(key: K, value: SaveTaxProfileInput[K]) => {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const missingAnexo = form.regime === 'simples_nacional' && !form.simplesAnexo;
  const missingMeiActivity = form.regime === 'mei' && !form.meiActivityType;
  const canSave = !missingAnexo && !missingMeiActivity && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await saveTaxProfile({
        ...form,
        // Distingue "aceitou como veio" de "corrigiu": muda a rastreabilidade.
        source: form.source === 'receita' && touched ? 'receita_corrigido' : form.source,
      });
      await profileQuery.refetch();
      toast.success('Perfil tributário confirmado.');
      navigate('/contabil');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const derived = lookup?.derived ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identificação do regime tributário"
        subtitle="O sistema consulta o CNPJ da sua empresa no cadastro da Receita e sugere o regime. Você confirma ou corrige."
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Consulta ao cadastro da Receita
            </h2>
            <p className="text-xs text-gray-500 dark:text-white/60">
              Usa o CNPJ já cadastrado em Minha Empresa. Nenhum dado é enviado por você.
            </p>
          </div>
          <button
            type="button"
            onClick={runLookup}
            disabled={isLooking}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2551] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B2551]/90 disabled:opacity-60"
          >
            {isLooking ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            {isLooking ? 'Consultando…' : 'Consultar CNPJ'}
          </button>
        </div>

        {lookupError && (
          <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {lookupError} Você pode preencher os campos manualmente abaixo.
          </p>
        )}

        {lookup && (
          <div className="mt-4 space-y-3">
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {lookup.derived.regimeReason}
            </p>
            {lookup.derived.razaoSocial && (
              <p className="text-sm text-gray-600 dark:text-white/70">
                <strong>{lookup.derived.razaoSocial}</strong>
                {lookup.derived.cnaePrincipal && ` · CNAE ${lookup.derived.cnaePrincipal}`}
                {lookup.derived.cnaePrincipalDescricao &&
                  ` — ${lookup.derived.cnaePrincipalDescricao}`}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-white/60">
              Situação cadastral: {lookup.derived.registrationStatusLabel} · dado obtido em{' '}
              {new Date(lookup.fetchedAt).toLocaleString('pt-BR')}
              {lookup.stale && ' (cache — a consulta em tempo real falhou)'}
            </p>

            {lookup.derived.warnings.map((warning) => (
              <p
                key={warning.code}
                className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{warning.message}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Confirme os dados do seu regime
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="regime">Regime tributário</label>
            <select
              id="regime"
              className={`mt-1 ${inputClass}`}
              value={form.regime}
              onChange={(event) => update('regime', event.target.value as SaveTaxProfileInput['regime'])}
            >
              {REGIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {form.regime === 'simples_nacional' && (
            <div>
              <label className={labelClass} htmlFor="anexo">Anexo do Simples</label>
              <select
                id="anexo"
                className={`mt-1 ${inputClass}`}
                value={form.simplesAnexo ?? ''}
                onChange={(event) =>
                  update('simplesAnexo', (event.target.value || null) as SimplesAnexo | null)
                }
              >
                <option value="">Selecione…</option>
                {ANEXOS.map((anexo) => (
                  <option key={anexo} value={anexo}>Anexo {anexo}</option>
                ))}
              </select>
              {derived?.anexoReason && (
                <p className="mt-1 text-xs text-gray-500 dark:text-white/60">{derived.anexoReason}</p>
              )}
              {missingAnexo && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  O anexo é obrigatório para apurar no Simples.
                </p>
              )}
            </div>
          )}

          {form.regime === 'mei' && (
            <div>
              <label className={labelClass} htmlFor="mei-activity">Tipo de atividade</label>
              <select
                id="mei-activity"
                className={`mt-1 ${inputClass}`}
                value={form.meiActivityType ?? ''}
                onChange={(event) =>
                  update(
                    'meiActivityType',
                    (event.target.value || null) as SaveTaxProfileInput['meiActivityType'],
                  )
                }
              >
                <option value="">Selecione…</option>
                <option value="comercio">Comércio ou indústria</option>
                <option value="servicos">Serviços</option>
                <option value="comercio_servicos">Comércio e serviços</option>
              </select>
              {missingMeiActivity && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  O tipo de atividade define o valor fixo do DAS.
                </p>
              )}
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="uf">UF</label>
            <input id="uf" className={`mt-1 ${inputClass}`} value={form.uf}
              onChange={(event) => update('uf', event.target.value.toUpperCase().slice(0, 2))} />
          </div>

          <div>
            <label className={labelClass} htmlFor="municipio">Município</label>
            <input id="municipio" className={`mt-1 ${inputClass}`} value={form.municipio}
              onChange={(event) => update('municipio', event.target.value)} />
          </div>

          <div>
            <label className={labelClass} htmlFor="revenue-basis">Base de apuração da receita</label>
            <select
              id="revenue-basis"
              className={`mt-1 ${inputClass}`}
              value={form.revenueBasis}
              onChange={(event) =>
                update('revenueBasis', event.target.value as 'competencia' | 'caixa')
              }
            >
              <option value="competencia">Competência (data da venda)</option>
              <option value="caixa">Caixa (data do recebimento)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
              A escolha muda o valor apurado. O regime de caixa exige opção formal.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="iss">Alíquota de ISS (%)</label>
            <input
              id="iss"
              type="number" min="0" max="100" step="0.01"
              className={`mt-1 ${inputClass}`}
              value={form.issRate * 100}
              onChange={(event) => update('issRate', Number(event.target.value) / 100)}
            />
          </div>
        </div>

        {form.regime === 'simples_nacional' && (
          <div className="rounded-xl bg-[#00a8d8]/5 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0089b0] dark:text-[#53dcff]" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Receita dos 12 meses anteriores (RBT12 inicial)
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-white/70">
                  Sem esse valor, os 12 primeiros meses de uso produzem uma alíquota efetiva
                  irreal, porque o sistema ainda não tem histórico. Informe zero apenas se a
                  empresa começou a faturar agora.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="number" min="0" step="0.01"
                    className={inputClass}
                    placeholder="0,00"
                    value={form.rbt12Initial}
                    onChange={(event) => update('rbt12Initial', Number(event.target.value))}
                    aria-label="RBT12 inicial"
                  />
                  <input
                    type="month"
                    className={inputClass}
                    value={form.rbt12InitialReferenceMonth ?? ''}
                    onChange={(event) =>
                      update('rbt12InitialReferenceMonth', event.target.value || null)
                    }
                    aria-label="Mês de referência do RBT12 inicial"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {form.regime === 'simples_nacional' && (
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 dark:border-white/10">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.fatorREnabled}
              onChange={(event) => update('fatorREnabled', event.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                Minha atividade está sujeita ao Fator R
              </span>
              <span className="mt-1 block text-xs text-gray-600 dark:text-white/70">
                Quando a folha de 12 meses alcança 28% da receita, a tributação passa do Anexo V
                para o Anexo III. Exige informar a folha mês a mês. Na dúvida, confirme com o seu
                contador.
              </span>
            </span>
          </label>
        )}

        {(form.regime === 'lucro_presumido' || form.regime === 'lucro_real') && (
          <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            A estimativa automática de imposto não está disponível para este regime — ela exigiria
            dado fiscal item a item e créditos de compra que o sistema não possui. O calendário de
            guias e a exportação para o contador continuam funcionando, com lançamento manual do
            valor apurado.
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-white/60">
            Ao confirmar, você declara que os dados conferem. Os valores calculados são gerenciais
            e não substituem a apuração do seu contador.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B2551]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Confirmar perfil tributário
          </button>
        </div>
      </div>
    </div>
  );
};
