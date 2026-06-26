import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TrendingUp, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Se já estiver logado, redireciona direto para o dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col justify-between selection:bg-[#10b981] selection:text-white">
      {/* Top Navbar */}
      <nav className="max-w-7xl w-full mx-auto px-6 h-20 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-[#10b981] p-1.5 rounded-lg text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-white tracking-wider">Gestly</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors duration-200"
          >
            Entrar
          </Link>
          <Link
            to="/register"
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 shadow-lg shadow-emerald-950/20"
          >
            Experimentar Grátis
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-4xl w-full mx-auto px-6 py-16 text-center flex-1 flex flex-col items-center justify-center gap-6">
        <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs text-[#10b981] font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          SaaS Multi-tenant para PMEs
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-gray-500 tracking-tight leading-tight">
          Gestão inteligente,<br />
          sem complicações.
        </h1>
        
        <p className="text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed">
          O Gestly consolida suas vendas, controle de estoque, compras e finanças em uma única plataforma segura para pequenas e médias empresas.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto">
          <Link
            to="/register"
            className="w-full sm:w-auto bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-6 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 group shadow-lg shadow-emerald-950/30"
          >
            Começar Agora
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto border border-white/10 hover:border-white/20 hover:bg-white/5 text-white rounded-xl px-6 py-3 font-semibold text-sm transition-colors duration-200"
          >
            Entrar no Painel
          </Link>
        </div>

        {/* Bullet features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 w-full text-left">
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-[#10b981] mb-2" />
            <h3 className="font-semibold text-sm text-white">Multi-tenant Seguro</h3>
            <p className="text-xs text-gray-400 mt-1">Isolamento absoluto de dados entre inquilinos.</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-[#10b981] mb-2" />
            <h3 className="font-semibold text-sm text-white">Controle Completo</h3>
            <p className="text-xs text-gray-400 mt-1">Estoque integrado, vendas, compras e DRE financeiro.</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
            <CheckCircle2 className="w-5 h-5 text-[#10b981] mb-2" />
            <h3 className="font-semibold text-sm text-white">Visual Premium</h3>
            <p className="text-xs text-gray-400 mt-1">Interface responsiva otimizada com suporte a tema escuro.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-white/5 text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Gestly SaaS. Todos os direitos reservados.
      </footer>
    </div>
  );
};
export default Landing;
