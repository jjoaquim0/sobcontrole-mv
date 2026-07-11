import React from 'react';
import { AlertTriangle, Clock3, Loader2, Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAnalyticsModules } from '../hooks/useAnalyticsModules';
import { getReportNavigationItem } from '../pages/reports/reportNavigation';

interface AnalyticsModuleRouteProps {
  moduleKey: string;
  children: React.ReactElement;
}

export const AnalyticsModuleRoute: React.FC<AnalyticsModuleRouteProps> = ({ moduleKey, children }) => {
  const navigate = useNavigate();
  const { modules, isLoading, isError, refetch } = useAnalyticsModules();
  const navigationItem = getReportNavigationItem(moduleKey);
  const module = modules.find((item) => item.key === moduleKey);
  const accessStatus = module?.accessStatus || navigationItem?.defaultAccessStatus;
  const moduleName = module?.name || navigationItem?.name || 'Módulo analítico';

  if (isLoading) {
    return (
      <div className="min-h-[420px] flex flex-col items-center justify-center gap-3 text-gray-400" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-[#00a8d8]" />
        <span className="text-sm">Validando acesso ao relatório...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[420px] flex flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Não foi possível validar seu acesso</h1>
        <p className="text-sm text-gray-500 dark:text-white/50">Tente novamente antes de abrir dados deste módulo.</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-[#00a8d8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] rounded">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (accessStatus === 'available' || accessStatus === 'contracted') return children;

  const isComingSoon = accessStatus === 'coming_soon';

  return (
    <div className="animate-fade-in">
      <div className="min-h-[460px] flex flex-col items-center justify-center text-center px-6 bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl">
        <div className={`p-4 rounded-full mb-4 ${isComingSoon ? 'bg-blue-50 text-blue-500 dark:bg-blue-950/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30'}`}>
          {isComingSoon ? <Clock3 className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
        </div>
        <span className="text-xs font-bold uppercase text-gray-400 mb-2">{isComingSoon ? 'Em breve' : 'Recurso premium'}</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{moduleName}</h1>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-2 max-w-lg">
          {isComingSoon
            ? 'Este relatório está em desenvolvimento e será liberado assim que estiver pronto.'
            : navigationItem?.description || 'Este módulo não está incluído no plano atual da empresa.'}
        </p>
        {!isComingSoon && (
          <>
            <ul className="mt-5 space-y-2 text-left max-w-md">
              {(navigationItem?.benefits || []).map((benefit) => (
                <li key={benefit} className="text-sm text-gray-600 dark:text-white/60 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#00a8d8] mt-0.5 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate('/settings?tab=subscription')}
              className="mt-6 bg-gradient-to-r from-[#0B2551] to-[#00a8d8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] focus-visible:ring-offset-2"
            >
              Ver planos e benefícios
            </button>
          </>
        )}
      </div>
    </div>
  );
};
