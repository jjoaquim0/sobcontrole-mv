import React from 'react';
import { Hammer } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';

interface UnderConstructionProps {
  title: string;
}

export const UnderConstruction: React.FC<UnderConstructionProps> = ({ title }) => {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} subtitle="Módulo em desenvolvimento avançado" />
      
      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-8 flex flex-col items-center justify-center text-center min-h-[400px] transition-colors duration-300">
        <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 mb-4">
          <Hammer className="w-12 h-12 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Área em Construção
        </h2>
        <p className="text-sm text-themeText-secondaryLight dark:text-themeText-secondaryDark max-w-md leading-relaxed">
          O módulo de <strong>{title}</strong> do Gestly está sendo estruturado com foco em performance e facilidade de uso. Em breve você terá acesso completo a este painel.
        </p>
      </div>
    </div>
  );
};
export default UnderConstruction;
