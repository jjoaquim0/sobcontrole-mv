import React, { useState } from 'react';
import { 
  AlertOctagon, 
  Database, 
  Copy, 
  Check, 
  RefreshCw, 
  FileCode2, 
  ServerCrash, 
  Compass, 
  BookOpen, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export interface DatabaseError {
  type: 'unconfigured' | 'connection' | 'tables_missing';
  message: string;
}

interface DatabaseErrorPageProps {
  error: DatabaseError;
  onRetry: () => void;
}

export const DatabaseErrorPage: React.FC<DatabaseErrorPageProps> = ({ error, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    // Add a slight delay for better UX feel
    await new Promise(resolve => setTimeout(resolve, 800));
    onRetry();
    setIsRetrying(false);
  };

  const sqlSchema = `-- SQL Schema para Inicialização do Banco de Dados Gestly no Supabase
-- Copie e cole este script no editor SQL do seu console do Supabase.

-- Tabela: Empresas (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Assinaturas (Subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'inactive',
    current_period_end TIMESTAMPTZ NOT NULL,
    usage_limit INTEGER NOT NULL DEFAULT 100,
    usage_current INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Perfis de Usuários (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Categorias de Produtos (Categories)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Produtos (Products)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT NOT NULL,
    barcode TEXT DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'Unidade',
    cost_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    sale_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    current_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    min_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    max_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Clientes (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    document TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '{}' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Vendas (Sales)
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    seller_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    total NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    fee NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    final_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Itens da Venda (Sale Items)
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    subtotal NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
);

-- Tabela: Contas a Receber (Account Receivables)
CREATE TABLE IF NOT EXISTS account_receivables (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    description TEXT
);

-- Tabela: Contas a Pagar (Account Payables)
CREATE TABLE IF NOT EXISTS account_payables (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    description TEXT
);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    toast.success('Script SQL copiado com sucesso!');
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHeader = () => {
    switch (error.type) {
      case 'unconfigured':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/5 animate-pulse">
              <Database className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conexão Pendente</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
              O Gestly precisa estar conectado a uma instância real do Supabase para gerenciar suas operações.
            </p>
          </div>
        );
      case 'tables_missing':
        return (
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <FileCode2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Banco de Dados Vazio</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
              A conexão com o Supabase foi estabelecida com sucesso, mas a estrutura de tabelas ainda não foi criada.
            </p>
          </div>
        );
      case 'connection':
      default:
        return (
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl mb-4 border border-red-500/20 shadow-lg shadow-red-500/5">
              <ServerCrash className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Falha na Conexão</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
              Não foi possível estabelecer contato com a API do Supabase. Verifique suas credenciais de acesso ou sua conexão de rede.
            </p>
          </div>
        );
    }
  };

  const renderSteps = () => {
    if (error.type === 'unconfigured') {
      return (
        <div className="space-y-4">
          <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs">1</span>
              Configure o arquivo `.env`
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7">
              Substitua os valores dummy pelos dados do seu projeto Supabase no arquivo <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded font-mono text-[10px] text-amber-600 dark:text-amber-400">.env</code> na raiz do projeto:
            </p>
            <div className="mt-2.5 pl-7">
              <pre className="p-3 bg-gray-950 rounded-xl text-left text-emerald-400 font-mono text-[10px] overflow-x-auto shadow-inner select-all border border-white/5">
{`VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui`}
              </pre>
            </div>
          </div>

          <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs">2</span>
              Crie a Estrutura de Tabelas
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7">
              Após configurar as credenciais e reiniciar o servidor dev (<code className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded font-mono text-[10px]">npm run dev</code>), siga as instruções da etapa <strong>Banco de Dados Vazio</strong> para inicializar as tabelas.
            </p>
          </div>
        </div>
      );
    }

    if (error.type === 'tables_missing') {
      return (
        <div className="space-y-4">
          <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">1</span>
                Copie o script SQL abaixo
              </h3>
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-[11px] font-medium bg-[#10b981] hover:bg-[#059669] text-white px-2.5 py-1 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Script'}
              </button>
            </div>
            
            <div className="relative">
              <pre className="p-3.5 bg-gray-950 rounded-xl text-left text-gray-300 font-mono text-[10px] h-[160px] overflow-y-auto shadow-inner select-all border border-white/5">
                {sqlSchema}
              </pre>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none rounded-b-xl" />
            </div>
          </div>

          <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">2</span>
              Execute no Supabase SQL Editor
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 pl-7 leading-relaxed">
              Acesse o painel do seu projeto no Supabase, vá em <strong>SQL Editor</strong> &rarr; <strong>New Query</strong>, cole o código copiado e clique em <strong>Run</strong>.
            </p>
            <div className="mt-3 pl-7 flex flex-wrap gap-2.5">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#10b981] hover:text-[#059669] flex items-center gap-1 underline transition-colors"
              >
                <Compass className="w-3.5 h-3.5" />
                Ir para o Dashboard do Supabase
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            Detalhes do Erro
          </h3>
          <p className="text-xs font-mono text-red-500/90 dark:text-red-400/90 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/20 rounded-xl p-3 mt-2 overflow-x-auto leading-relaxed">
            {error.message}
          </p>
        </div>

        <div className="border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
            Lista de Verificação de Rede
          </h3>
          <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 pl-6 list-disc space-y-1 leading-relaxed">
            <li>Sua conexão de internet está funcionando corretamente?</li>
            <li>Os valores no arquivo `.env` não estão invertidos ou com espaços em branco adicionais?</li>
            <li>As permissões de requisição HTTP não estão sendo bloqueadas por firewall ou proxy corporativo?</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-themeBg-light dark:bg-themeBg-dark flex items-center justify-center p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-3xl shadow-2xl p-8 max-w-xl w-full transition-all duration-300 flex flex-col gap-6">
        
        {/* Top: Header */}
        {renderHeader()}

        {/* Mid: Dynamic Guide / Steps */}
        {renderSteps()}

        {/* Bottom: Action CTAs */}
        <div className="border-t border-gray-100 dark:border-white/5 pt-5 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto bg-[#10b981] hover:bg-[#059669] text-white rounded-xl py-2.5 px-6 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Verificando...' : 'Tentar Novamente'}
          </button>
          
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center sm:text-left flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            Consulte a documentação em <code>/Documentação</code> se precisar.
          </div>
        </div>

      </div>
    </div>
  );
};
export default DatabaseErrorPage;
