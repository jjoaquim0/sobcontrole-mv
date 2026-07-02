
# SobControle — CRM Inteligente para PMEs

**Sistema:** SobControle  
**Assistente IA:** Gestly  
**Stack:** React + TypeScript + Vite + Supabase  
**Foco:** Gestão integrada para pequenas e médias empresas com inteligência artificial

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Módulos Atuais (Implementados)](#módulos-atuais-implementados)
- [Módulos Futuros (Roadmap)](#módulos-futuros-roadmap)
- [Estrutura de Rotas](#estrutura-de-rotas)
- [Modelo de Dados (Principais Entidades)](#modelo-de-dados-principais-entidades)
- [Sistema de Roles e Permissões](#sistema-de-roles-e-permissões)
- [Monetização](#monetização)
- [Inteligência Artificial — Gestly](#inteligência-artificial--gestly)
- [Desenvolvimento](#desenvolvimento)

---

## Visão Geral

O **SobControle** é um CRM completo para PMEs brasileiras que unifica gestão comercial, financeira, operacional e relacionamento com clientes em uma única plataforma. Seu grande diferencial é o **Gestly**, um assistente de IA que potencializa cada módulo com automação inteligente, análise de dados e recomendações contextuais.

### Princípios de Design

- **Multi-tenant nativo** — cada empresa é isolada com Row Level Security (RLS) no Supabase
- **Mobile-first** — interface responsiva construída com Tailwind CSS
- **Modo escuro** — suporte completo a tema dark/light
- **Offline-first preparado** — arquitetura pronta para futura sincronização offline
- **Privacidade e segurança** — dados de cada empresa totalmente isolados

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript |
| **Build** | Vite 5 |
| **Estilização** | Tailwind CSS 3 |
| **Roteamento** | React Router v6 |
| **Estado global** | Zustand |
| **Server state** | TanStack React Query |
| **Formulários** | React Hook Form + Zod |
| **Gráficos** | Recharts |
| **Animações** | Framer Motion |
| **Ícones** | Lucide React |
| **Notificações** | Sonner |
| **Backend/Banco** | Supabase (PostgreSQL, Auth, Storage, RLS) |
| **Ferramentas IA** | aiox-core |

---

## Arquitetura

```
┌─ Frontend (React SPA) ─────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Pages   │  │ Shared   │  │   Services   │  │
│  │ (Routes) │──│ Comp.    │──│ (API Layer)  │  │
│  └──────────┘  └──────────┘  └──────┬───────┘  │
│        │                            │           │
│  ┌─────┴──────┐           ┌─────────┴────────┐ │
│  │   Hooks    │           │  lib/supabase.ts  │ │
│  │ (useAuth,  │           │  (Supabase client)│ │
│  │  useSales) │           └─────────┬────────┘ │
│  └─────┬──────┘                     │           │
│        └──────────┬─────────────────┘           │
└───────────────────┼─────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │     Supabase        │
         │  ┌────────────────┐ │
         │  │  PostgreSQL    │ │
         │  │  + RLS Policies│ │
         │  ├────────────────┤ │
         │  │  Auth (Auth0)  │ │
         │  ├────────────────┤ │
         │  │  Storage       │ │
         │  └────────────────┘ │
         └─────────────────────┘
```

### Estrutura de Pastas

```
src/
├── components/
│   ├── layout/          # AppLayout, Sidebar, Header
│   └── shared/          # DataTable, StatCard, PageHeader, StatusBadge, ConfirmModal
├── hooks/               # useAuth, useSales, useCustomers, useInventory, useDashboard
├── lib/                 # supabase.ts (cliente configurado)
├── pages/
│   ├── admin/           # Painel administrativo
│   ├── auth/            # Login, Register, SubscriptionInactive
│   ├── company/         # Minha Empresa
│   ├── customers/       # Clientes (listagem + detalhe + modal)
│   ├── dashboard/       # Painel executivo
│   ├── documents/       # Documentos
│   ├── error/           # Páginas de erro
│   ├── financial/       # Financeiro
│   ├── inventory/       # Estoque (listagem + detalhe + modais)
│   ├── landing/         # Landing page pública
│   ├── profile/         # Perfil do usuário
│   ├── purchases/       # Compras
│   ├── reports/         # Relatórios
│   ├── sales/           # Vendas (listagem + detalhe + modal)
│   ├── settings/        # Configurações
│   └── suppliers/       # Fornecedores
├── routes/              # PrivateRoute, PublicRoute, RoleRoute
├── services/            # dashboardservice, customerservice, inventoryservice, salesService
├── store/               # authStore, themeStore (Zustand)
├── types/               # Interfaces TypeScript globais
└── main.tsx             # Entry point
```

---

## Módulos Atuais (Implementados)

### 1. Autenticação e Cadastro
- Login com e-mail/senha via Supabase Auth
- Registro com criação automática de empresa + assinatura trial
- Recuperação de senha
- Proteção de rotas (públicas vs privadas)
- Bloqueio por assinatura inativa

### 2. Multi-tenant (Empresas)
- Isolamento completo por empresa via RLS no PostgreSQL
- Perfis de usuário vinculados a uma empresa
- Função `complete_company_signup()` que cria empresa + perfil + assinatura em transação atômica

### 3. Dashboard Executivo
- Receita do mês com variação percentual
- Total de vendas
- Alerta de estoque baixo
- Gráfico de vendas semanais (Recharts)
- Atividade recente (contas a receber/pagar)
- Ações rápidas (nova venda, novo produto, novo cliente)
- Top produtos do mês
- Saúde financeira (indicador circular)
- Resumo financeiro (a receber, a pagar, vencidos)

### 4. Vendas
- Listagem de vendas com filtros
- Detalhe da venda
- Cadastro/edição de vendas (modal)
- Itens de venda vinculados a produtos
- Métodos de pagamento (dinheiro, crédito, débito, pix, boleto, transferência)
- Status de pagamento (pago, pendente, cancelado)

### 5. Clientes
- Cadastro completo (PF/PJ)
- CPF/CNPJ, e-mail, telefone, endereço (JSON com CEP/Rua/Número)
- Listagem com busca
- Detalhe do cliente
- Ativação/desativação

### 6. Estoque (Produtos)
- Cadastro de produtos com SKU, código de barras, unidade
- Preço de custo e venda
- Controle de quantidade mínima/máxima
- Ajuste manual de estoque (modal)
- Importação via CSV (modal)
- Categorias de produtos
- Ativação/desativação

### 7. Fornecedores
- Cadastro com CNPJ, contato, status

### 8. Compras (Admin/Gerente)
- Registro de compras vinculadas a fornecedores

### 9. Financeiro (Admin/Gerente)
- Contas a receber (vinculadas a vendas)
- Contas a pagar
- Status: pago, pendente, atrasado, cancelado
- (*Em construção — página com UnderConstruction*)

### 10. Relatórios (Admin/Gerente)
- (*Em construção — página com UnderConstruction*)

### 11. Documentos
- Upload e gerenciamento de arquivos
- Categorização e status (ativo/arquivado)

### 12. Configurações e Perfil
- Minha Empresa (dados da empresa)
- Configurações do sistema
- Perfil do usuário

### 13. Admin
- Painel administrativo (apenas role admin)

### 14. Landing Page
- Página de marketing pública
- Seções: Hero, Features, Pricing, Testimonials, CTA

### 15. Tema Escuro/Claro
- Zustand store para tema
- Persistência de preferência
- Transições suaves entre modos

---

## Módulos Futuros (Roadmap)

### Fase 1 — Core (Prioridade Alta)
- [ ] **Kanban / Pipeline de Vendas** — Visualização drag-and-drop do funil de vendas
- [ ] **Agenda / Calendário** — Agendamento de reuniões, tarefas e compromissos com clientes
- [ ] **Notificações Inteligentes** — Push, e-mail e SMS com ações sugeridas pela IA
- [ ] **Assinaturas / Recorrências** — Cobranças recorrentes e gestão de assinaturas de clientes
- [ ] **WhatsApp Integrado** — Envio e recebimento de mensagens via WhatsApp Business API

### Fase 2 — Inteligência Artificial
- [ ] **Chatbot Gestly** — Assistente comercial via chat, tira dúvidas, sugere ações
- [ ] **Upload de Planilhas com IA** — Usuário envia planilha, Gestly interpreta e importa; se não for adequada, avisa e não salva
- [ ] **Open Finance** — Conectar bancos dos clientes, visualizar saldos/extratos e categorizar transações automaticamente com IA

### Fase 3 — Analytics e Automação
- [ ] **BI / Analytics Avançado** — Dashboards analíticos com gráficos interativos, exportação, insights automáticos
- [ ] **Marketing / Automação** — E-mail marketing, disparo de campanhas, automação de follow-up com base em comportamento

### Fase 4 — Futuro (Longo Prazo)
- [ ] **Criação de Vídeos com Agentes de IA** — Time de agentes para produzir vídeos comerciais personalizados
- [ ] **API Pública / Webhooks** — Integração com sistemas externos

---

## Estrutura de Rotas

```
/                    → Landing page (pública)
/login               → Login
/register            → Cadastro
/subscription-inactive → Assinatura inativa

/* Rotas privadas (com AppLayout) */
/dashboard           → Painel executivo
/sales               → Vendas (lista)
/sales/:id           → Detalhe da venda
/customers           → Clientes (lista)
/customers/:id       → Detalhe do cliente
/inventory           → Estoque (lista)
/inventory/:id       → Detalhe do produto
/suppliers           → Fornecedores
/purchases           → Compras (admin/manager)
/financial           → Financeiro (admin/manager)
/reports             → Relatórios (admin/manager)
/documents           → Documentos
/company             → Minha Empresa (admin/manager)
/settings            → Configurações (admin/manager)
/profile             → Perfil do usuário
/admin               → Admin (somente admin)
```

---

## Modelo de Dados (Principais Entidades)

### Companies (Empresas)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Primary Key |
| name | TEXT | Nome fantasia |
| cnpj | TEXT | CNPJ |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Profiles (Usuários)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK (vinculado ao auth.users do Supabase) |
| email | TEXT | |
| name | TEXT | |
| role | TEXT | admin / manager / employee |
| company_id | UUID | FK → companies |

### Subscriptions (Assinaturas)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| company_id | UUID | FK → companies |
| plan | TEXT | pro / enterprise |
| status | TEXT | active / trialing / inactive |
| usage_limit | INTEGER | Limite de operações |
| usage_current | INTEGER | Operações usadas |

### Customers (Clientes), Products (Produtos), Sales (Vendas), etc.
(Ver `supabase_schema.sql` para schema completo de todas as tabelas.)

---

## Sistema de Roles e Permissões

| Role | Acesso |
|------|--------|
| **admin** | Acesso total, inclusive admin panel, financeiro, relatórios, compras, configurações, empresa |
| **manager** | Mesmo que admin, exceto painel admin |
| **employee** | Apenas operacional: dashboard, vendas, clientes, estoque, fornecedores, documentos |

As permissões são aplicadas em duas camadas:
1. **Frontend** — `RoleRoute` bloqueia rotas no React Router
2. **Backend** — RLS policies no PostgreSQL garantem isolamento multi-tenant

---

## Monetização

**Modelo:** Apenas planos pagos (sem versão gratuita)

### Planos Fixos (2-3 opções)
| Plano | Ideal para | Features |
|-------|-----------|----------|
| **Pro** | PMEs até 10 usuários | Todos os módulos core + limite de operações |
| **Enterprise** | PMEs acima de 10 usuários | Tudo do Pro + suporte prioritário + limite maior |

**Trial:** 14 dias grátis na assinatura (já implementado).

---

## Inteligência Artificial — Gestly

O **Gestly** é o assistente de IA do SobControle. Ele funciona como um copiloto comercial inteligente integrado a todos os módulos do sistema.

### Funcionalidades da IA (Roadmap)

#### 1. Chatbot Comercial
- Interface de chat dentro do sistema
- Personalidade de assistente comercial
- Tira dúvidas sobre dados do sistema (ex: "quantas vendas tive esse mês?")
- Sugere ações baseadas em análise de dados
- Ajuda na criação de vendas, produtos, campanhas

#### 2. Upload Inteligente de Planilhas
- Usuário faz upload de qualquer planilha (CSV, XLSX, etc.)
- Gestly interpreta o conteúdo usando IA
- Mapeia automaticamente os campos para as entidades do sistema
- Se a planilha não for compatível/usável, avisa o cliente e não salva nada
- Suporta: produtos, clientes, vendas, etc.

#### 3. Open Finance com Categorização
- Conexão com bancos via Open Finance
- Visualização de contas, saldos e extratos
- Categorização automática de transações usando IA
- Identificação de padrões de gastos e receitas

#### 4. Futuro: Criação de Vídeos com Agentes
- Time de agentes de IA especializados
- Produção automatizada de vídeos comerciais
- Personalização com dados do cliente

---

## Desenvolvimento

### Pré-requisitos

- Node.js 18+
- npm
- Conta no Supabase

### Setup

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Copie .env.example para .env e preencha com suas credenciais do Supabase
cp .env.example .env

# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

### Variáveis de Ambiente (.env)

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento Vite |
| `npm run build` | TypeScript check + build de produção |
| `npm run preview` | Preview do build de produção |
| `npm run lint` | ESLint em todos os arquivos TS/TSX |

### Banco de Dados

O schema completo está em `supabase_schema.sql`. Para inicializar:
1. Crie um projeto no Supabase
2. Execute o script `supabase_schema.sql` no SQL Editor
3. Configure as variáveis de ambiente

### Convenções de Código

- **Componentes**: Arrow functions com `React.FC` explícito
- **Nomenclatura**: PascalCase para componentes, camelCase para hooks/funções
- **Estilos**: Tailwind CSS classes, sem CSS modules ou styled-components
- **Estado global**: Zustand para tema e auth; React Query para dados do servidor
- **Requisições**: Serviços em `src/services/`, hooks em `src/hooks/`
- **Formulários**: React Hook Form + Zod para validação
- **Comentários**: Evitar ao máximo (código auto-documentado)

---

## Licença

Proprietária — Todos os direitos reservados.
