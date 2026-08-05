import React from 'react';
import { Loader2 } from 'lucide-react';

interface RouteFallbackProps {
  /** Usa tela cheia nas rotas públicas, que não vivem dentro do AppLayout. */
  fullScreen?: boolean;
}

/**
 * Exibido enquanto o chunk de uma rota carregada sob demanda chega da rede.
 * Segue o mesmo visual do estado de carregamento do PrivateRoute.
 */
export const RouteFallback: React.FC<RouteFallbackProps> = ({ fullScreen = false }) => (
  <div
    className={
      fullScreen
        ? 'min-h-screen bg-[#0f1117] flex flex-col items-center justify-center text-white/50 gap-2'
        : 'flex min-h-[60vh] flex-col items-center justify-center gap-2 text-gray-400'
    }
  >
    <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
    <span className="text-xs font-medium tracking-widest uppercase text-gray-500">Carregando...</span>
  </div>
);
