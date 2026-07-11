import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, SearchX, AlertTriangle } from 'lucide-react';
import { useAnalyticsModules, AnalyticsModuleWithAccess } from '../../../hooks/useAnalyticsModules';
import { BI_MODULE_CONTENT, BI_CATEGORY_LABELS, BI_FILTER_CATEGORIES } from '../biModulesContent';
import { BiModuleCard, BiModuleCardSkeleton } from '../components/BiModuleCard';
import { BiUnlockModal } from '../components/BiUnlockModal';
import { AnalyticsModuleCategory } from '../../../types';

type CategoryFilter = 'all' | AnalyticsModuleCategory;

const matchesSearch = (module: AnalyticsModuleWithAccess, term: string): boolean => {
  if (!term) return true;
  const content = BI_MODULE_CONTENT[module.key];
  const haystack = [module.name, content?.description, ...(content?.metrics || [])].join(' ').toLowerCase();
  return haystack.includes(term.toLowerCase());
};

export const BiCenterTab: React.FC = () => {
  const { modules, isLoading, isError, refetch } = useAnalyticsModules();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [unlockTarget, setUnlockTarget] = useState<AnalyticsModuleWithAccess | null>(null);

  const filteredModules = useMemo(
    () =>
      modules.filter(
        (module) => (category === 'all' || module.category === category) && matchesSearch(module, search)
      ),
    [modules, category, search]
  );

  const recommendedModules = useMemo(
    () => (category === 'all' && !search ? modules.filter((m) => BI_MODULE_CONTENT[m.key]?.recommended) : []),
    [modules, category, search]
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-500">Erro ao carregar a Central de Inteligência.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm font-semibold text-[#10b981] hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Central de Inteligência</h2>
        <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
          Transforme dados do seu negócio em decisões mais rápidas.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou funcionalidade..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1d27] text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#10b981]/40"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {BI_FILTER_CATEGORIES.map((cat) => {
          const isActive = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
                isActive
                  ? 'bg-[#10b981] text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              {BI_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {recommendedModules.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-transparent p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#10b981]" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recomendado pela Gestly</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedModules.map((module) => (
              <BiModuleCard
                key={module.id}
                module={module}
                content={BI_MODULE_CONTENT[module.key]}
                onUnlock={setUnlockTarget}
              />
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <BiModuleCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <SearchX className="w-8 h-8 text-gray-300 dark:text-white/20" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhum módulo encontrado</p>
          <p className="text-xs text-gray-500 dark:text-white/50 max-w-xs">
            Ajuste a busca ou o filtro de categoria para ver outros módulos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map((module) => (
            <BiModuleCard
              key={module.id}
              module={module}
              content={BI_MODULE_CONTENT[module.key]}
              onUnlock={setUnlockTarget}
            />
          ))}
        </div>
      )}

      <BiUnlockModal
        isOpen={!!unlockTarget}
        moduleName={unlockTarget?.name || ''}
        benefits={unlockTarget ? BI_MODULE_CONTENT[unlockTarget.key]?.benefits || [] : []}
        onClose={() => setUnlockTarget(null)}
        onViewPlans={() => {
          setUnlockTarget(null);
          navigate('/settings?tab=subscription');
        }}
      />
    </div>
  );
};
