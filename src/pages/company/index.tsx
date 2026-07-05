import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2,
  CreditCard,
  Crown,
  Users,
  Upload,
  ImageIcon,
  Download,
  Loader2,
  Copy,
  Calendar,
  UserX,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { UserRole } from '../../types';
import { TeamMember } from '../../services/settingsService';

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';
const labelClass = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
const controlClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';
const primaryButtonClass =
  'bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70';
const outlineButtonClass =
  'border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200 disabled:opacity-70';

const formatCnpj = (cnpj: string) => {
  const clean = (cnpj || '').replace(/\D/g, '');
  if (clean.length !== 14) return cnpj || '—';
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '—');

const companyNameSchema = z.object({
  name: z.string().min(1, 'Informe o nome da empresa'),
});

type CompanyNameForm = z.infer<typeof companyNameSchema>;

const CompanyProfileCard: React.FC = () => {
  const { company } = useAuth();
  const { settings, isLoading, updateCompanyName, isSavingCompanyName, uploadLogo, isUploadingLogo } = useSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyNameForm>({
    resolver: zodResolver(companyNameSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    reset({ name: company?.name || '' });
  }, [company, reset]);

  useEffect(() => {
    if (settings) setLogoPreview(settings.logoUrl || '');
  }, [settings]);

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    await uploadLogo(file).catch(() => undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyId = () => {
    if (!company?.id) return;
    navigator.clipboard.writeText(company.id);
    toast.success('ID da empresa copiado para a área de transferência!');
  };

  const onSubmit = async (values: CompanyNameForm) => {
    if (values.name.trim() === (company?.name || '')) return;
    await updateCompanyName(values.name.trim()).catch(() => undefined);
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Building2 className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dados da Empresa</h2>
          <p className="text-sm text-gray-500 dark:text-white/50">Informações cadastrais e logomarca</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Nome da Empresa</label>
              <input type="text" {...register('name')} className={controlClass} />
              {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>CNPJ</label>
              <input
                type="text"
                value={formatCnpj(company?.cnpj || '')}
                disabled
                className={`${controlClass} opacity-70 cursor-not-allowed font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Logomarca</label>
            <div className="flex items-center gap-5 mt-2">
              <div className="w-20 h-20 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logomarca da empresa" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300 dark:text-white/20" />
                )}
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className={outlineButtonClass}
                >
                  {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploadingLogo ? 'Enviando...' : 'Enviar Logomarca'}
                </button>
                <p className="text-xs text-gray-500 dark:text-white/50 mt-2">PNG, JPG ou SVG até 2MB.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 dark:border-white/5 pt-4 text-xs text-gray-500 dark:text-white/50">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Empresa desde {formatDate(company?.createdAt)}
            </span>
            {company?.id && (
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 font-mono hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-200"
              >
                <Copy className="w-3.5 h-3.5" />
                ID: {company.id.slice(0, 8)}...
              </button>
            )}
          </div>

          <div className="flex justify-end border-t border-gray-100 dark:border-white/5 pt-5">
            <button type="submit" disabled={isSavingCompanyName} className={primaryButtonClass}>
              {isSavingCompanyName && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSavingCompanyName ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  pro: 'Profissional',
  enterprise: 'Empresarial',
};

const PLAN_BADGE: Record<string, string> = {
  pro: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  free: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Período de Teste',
  past_due: 'Pagamento Pendente',
  canceled: 'Cancelada',
  inactive: 'Inativa',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const SubscriptionCard: React.FC = () => {
  const { subscription } = useAuth();
  const { isLoading } = useSettings();

  const plan = subscription?.plan || 'free';
  const status = subscription?.status || 'inactive';
  const usageCurrent = subscription?.usageCurrent ?? 0;
  const usageLimit = subscription?.usageLimit ?? 0;
  const usagePercent = usageLimit > 0 ? Math.min(100, Math.round((usageCurrent / usageLimit) * 100)) : 0;
  const barColor = usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-[#10b981]';

  const daysRemaining = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000))
    : null;

  const needsAttention = status === 'past_due' || status === 'canceled' || status === 'inactive';

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CreditCard className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Plano e Assinatura</h2>
          <p className="text-sm text-gray-500 dark:text-white/50">Status, limite de uso e período de faturamento</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {needsAttention && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-950/20 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {status === 'past_due'
                  ? 'Há um pagamento pendente na sua assinatura. Regularize para evitar a interrupção do serviço.'
                  : 'Sua assinatura não está ativa. Renove o plano para continuar utilizando todos os recursos.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <span className={labelClass}>Plano</span>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  {PLAN_LABELS[plan] || plan}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className={labelClass}>Status</span>
              <div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] || STATUS_BADGE.inactive}`}
                >
                  {STATUS_LABELS[status] || status}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className={labelClass}>Período Vigente</span>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {formatDate(subscription?.currentPeriodEnd)}
                {daysRemaining !== null && (
                  <span className="block text-xs font-normal text-gray-500 dark:text-white/50 mt-0.5">
                    {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={labelClass}>Uso do Plano</span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {usageCurrent} de {usageLimit} operações
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-white/40 mt-1.5">{usagePercent}% da capacidade utilizada</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Colaborador',
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  employee: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
];

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const TeamCard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { teamMembers, isTeamLoading, removeMember, isRemoving, exportData, isExporting } = useSettings();
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const isAdmin = profile?.role === 'admin';

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    await removeMember(memberToRemove.id)
      .then(() => setMemberToRemove(null))
      .catch(() => undefined);
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Equipe</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">
              {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'} na sua empresa
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="text-sm font-semibold text-[#10b981] hover:text-[#059669] transition-colors duration-200"
        >
          Ver Todos
        </button>
      </div>

      {isTeamLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-white/15 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-white/50">Nenhum membro encontrado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {teamMembers.map((member) => {
            const isSelf = member.id === profile?.id;
            return (
              <li key={member.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-black/5 ${getAvatarColor(member.name)}`}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {member.name}
                      {isSelf && <span className="text-gray-400 dark:text-white/40 font-normal"> (você)</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-white/50 truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {member.status === 'invited' && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
                      Convidado
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_BADGE[member.role]}`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                  {isAdmin && !isSelf && (
                    <button
                      type="button"
                      onClick={() => setMemberToRemove(member)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors duration-150"
                      title="Remover membro"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end border-t border-gray-100 dark:border-white/5 pt-5 mt-2">
        <button
          type="button"
          onClick={() => exportData().catch(() => undefined)}
          disabled={isExporting}
          className={outlineButtonClass}
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? 'Exportando...' : 'Exportar Todos os Dados'}
        </button>
      </div>

      <ConfirmModal
        isOpen={!!memberToRemove}
        title="Remover Membro"
        message={`Tem certeza que deseja remover "${memberToRemove?.name}" da equipe? O acesso deste membro será revogado.`}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
        isLoading={isRemoving}
        confirmText="Remover"
        variant="danger"
      />
    </div>
  );
};

export const Company: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Minha Empresa" subtitle="Gerencie os dados e assinatura da sua empresa" />
      <CompanyProfileCard />
      <SubscriptionCard />
      <TeamCard />
    </div>
  );
};

export default Company;
