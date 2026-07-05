import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Users, UserPlus, Trash2, X } from 'lucide-react';
import { DataTable, Column } from '../../../components/shared/DataTable';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { useSettings } from '../../../hooks/useSettings';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../types';
import { TeamMember } from '../../../services/settingsService';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Colaborador',
};

const controlClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';

const MemberAvatar: React.FC<{ name: string }> = ({ name }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colorClass = colors[Math.abs(hash) % colors.length];

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-black/5 ${colorClass}`}>
      {initials}
    </div>
  );
};

export const TeamTab: React.FC = () => {
  const { user } = useAuth();
  const {
    teamMembers,
    isTeamLoading,
    inviteMember,
    isInviting,
    removeMember,
    isRemoving,
    updateRole,
    isUpdatingRole,
  } = useSettings();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('employee');
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const handleInvite = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    const ok = await inviteMember({ email: inviteEmail, role: inviteRole })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteRole('employee');
    }
  };

  const handleRoleChange = async (member: TeamMember, role: UserRole) => {
    if (role === member.role) return;
    await updateRole({ userId: member.id, role }).catch(() => undefined);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    await removeMember(memberToRemove.id)
      .then(() => setMemberToRemove(null))
      .catch(() => undefined);
  };

  const columns: Column<TeamMember>[] = [
    {
      key: 'member',
      label: 'Membro',
      render: (row) => (
        <div className="flex items-center gap-3">
          <MemberAvatar name={row.name} />
          <span className="font-semibold text-gray-800 dark:text-gray-200">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'E-mail',
      render: (row) => <span className="text-gray-600 dark:text-gray-400">{row.email}</span>,
    },
    {
      key: 'role',
      label: 'Função',
      render: (row) => (
        <select
          value={row.role}
          disabled={isUpdatingRole || row.id === user?.id}
          onChange={(e) => handleRoleChange(row, e.target.value as UserRole)}
          className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
        >
          <option value="admin">{ROLE_LABELS.admin}</option>
          <option value="manager">{ROLE_LABELS.manager}</option>
          <option value="employee">{ROLE_LABELS.employee}</option>
        </select>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Ativo
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (row) => {
        const isSelf = row.id === user?.id;
        return (
          <button
            type="button"
            onClick={() => !isSelf && setMemberToRemove(row)}
            disabled={isSelf}
            className={`p-1.5 rounded-lg transition-colors duration-150 ${
              isSelf
                ? 'text-gray-300 dark:text-white/20 cursor-not-allowed'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
            }`}
            title={isSelf ? 'Você não pode remover a si mesmo' : 'Remover membro'}
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between">
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
            onClick={() => setIsInviteOpen(true)}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Membro
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={teamMembers}
        isLoading={isTeamLoading}
        emptyTitle="Nenhum membro encontrado"
        emptySubtitle="Convide colaboradores para trabalhar com você."
        emptyIcon={<Users className="w-12 h-12 text-gray-300 dark:text-white/15 mb-3" />}
      />

      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteOpen(false)}
              className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Convidar Membro</h3>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@empresa.com"
                    className={controlClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Função
                  </label>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className={controlClass}>
                    <option value="admin">{ROLE_LABELS.admin}</option>
                    <option value="manager">{ROLE_LABELS.manager}</option>
                    <option value="employee">{ROLE_LABELS.employee}</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isInviting}
                    className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-70"
                  >
                    {isInviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isInviting ? 'Enviando...' : 'Enviar Convite'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
