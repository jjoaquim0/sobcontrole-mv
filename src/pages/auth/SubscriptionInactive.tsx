import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, MessageSquare } from 'lucide-react';
import { Logo } from '../../components/shared/brand';

export const SubscriptionInactive: React.FC = () => {
  const { signOut, company } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-themeBg-light dark:bg-themeBg-dark flex items-center justify-center p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-xl p-8 max-w-md w-full text-center transition-all duration-300">
        {/* Marca — esta tela vive fora do app shell, sem sidebar para identificá-la */}
        <div className="flex justify-center mb-6">
          <Logo symbolClassName="w-7 h-7" wordmarkClassName="text-lg" />
        </div>

        {/* Warning Icon */}
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          Assinatura Inativa
        </h1>

        {/* Company context */}
        {company && (
          <p className="text-xs font-semibold text-[#10b981] bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 rounded-full inline-block mb-4">
            {company.name}
          </p>
        )}

        {/* Message */}
        <p className="text-sm text-themeText-secondaryLight dark:text-themeText-secondaryDark mb-6 leading-relaxed">
          Identificamos que a assinatura do plano para sua conta está vencida ou não foi ativada. 
          Para continuar acessando os recursos de controle financeiro, estoque e vendas do <strong>Gestly</strong>, entre em contato com o administrador de sua empresa ou regularize sua fatura.
        </p>

        {/* Call to Actions */}
        <div className="space-y-3">
          <a
            href="mailto:suporte@gestly.com?subject=Regularizacao%20de%20Assinatura"
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <MessageSquare className="w-4 h-4" />
            Falar com o Suporte
          </a>

          <button
            onClick={handleSignOut}
            className="w-full border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            Entrar com Outra Conta
          </button>
        </div>
      </div>
    </div>
  );
};
export default SubscriptionInactive;
