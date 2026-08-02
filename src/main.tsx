import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './routes';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { supabase } from './lib/supabase';
import { DatabaseErrorPage, DatabaseError } from './pages/error/DatabaseErrorPage';
import { Loader2 } from 'lucide-react';
import { Logo } from './components/shared/brand';
import './index.css';

// Configuração do TanStack Query v5
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppInitializer = () => {
  const loadSession = useAuthStore((state) => state.loadSession);
  const initTheme = useThemeStore((state) => state.initTheme);
  const theme = useThemeStore((state) => state.theme);

  const [dbError, setDbError] = useState<DatabaseError | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const checkConnection = async () => {
    setIsValidating(true);
    setDbError(null);

    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key || url.includes('dummy') || key.includes('dummy') || url === '' || key === '') {
      setDbError({
        type: 'unconfigured',
        message: 'As credenciais do Supabase não estão configuradas ou contêm valores "dummy" no arquivo .env.'
      });
      setIsValidating(false);
      return;
    }

    try {
      // Tenta fazer uma consulta simples para validar a conexão e a existência da tabela
      const { error } = await supabase.from('companies').select('id').limit(1);

      if (error) {
        if (error.code === '42P01') {
          setDbError({
            type: 'tables_missing',
            message: 'O banco de dados está online, mas as tabelas necessárias (schema) não foram localizadas.'
          });
        } else {
          setDbError({
            type: 'connection',
            message: `Ocorreu um erro ao acessar o banco de dados: ${error.message} (Código: ${error.code})`
          });
        }
      } else {
        // Conexão bem sucedida, carrega a sessão normalmente
        await loadSession();
      }
    } catch (err: any) {
      setDbError({
        type: 'connection',
        message: `Falha técnica de rede ao se comunicar com o Supabase: ${err.message || err}`
      });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    initTheme();
    checkConnection();
  }, [initTheme]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#16193B] flex flex-col items-center justify-center text-white/50 gap-6">
        {/* Splash de boot: fundo azul-noite da marca, lockup em versão escura. */}
        <Logo
          variant="escuro"
          orientation="vertical"
          symbolClassName="w-14 h-14"
          wordmarkClassName="text-3xl"
        />
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#8F76FF]" />
          <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Validando Conexão...</span>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <QueryClientProvider client={queryClient}>
        <DatabaseErrorPage error={dbError} onRetry={checkConnection} />
        <Toaster 
          position="top-right" 
          richColors 
          theme={theme} 
          toastOptions={{
            style: {
              borderRadius: '12px',
            }
          }}
        />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster 
        position="top-right" 
        richColors 
        theme={theme} 
        toastOptions={{
          style: {
            borderRadius: '12px',
          }
        }}
      />
    </QueryClientProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>
);
