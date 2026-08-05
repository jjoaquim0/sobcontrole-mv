-- Story 1.29 — Classificação fiscal de produtos e categorias
--
-- É esta tabela que define a precisão do módulo. Sem ela, a apuração usa um
-- anexo único por empresa e ignora tributo já recolhido na origem — o que erra
-- estruturalmente em comércio misto, farmácia, autopeças e bebidas.
--
-- A classificação é HERDADA em cascata (produto -> categoria -> empresa), então
-- nenhum cliente precisa classificar o catálogo inteiro para começar a usar.
-- Cada nível grava apenas o que sobrescreve; NULL significa "herda".

BEGIN;

CREATE TABLE IF NOT EXISTS product_tax_classification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

    -- Exatamente um dos dois: a linha classifica um produto OU uma categoria.
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,

    -- NULL em qualquer atributo = herda do nível acima. A herança é por
    -- ATRIBUTO, não por registro: um produto pode sobrescrever só a tributação
    -- e manter o anexo que veio da categoria.
    anexo TEXT,
    tributacao TEXT,

    note TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    CONSTRAINT product_tax_classification_target_check
      CHECK (num_nonnulls(product_id, category_id) = 1),
    CONSTRAINT product_tax_classification_anexo_check
      CHECK (anexo IS NULL OR anexo IN ('I', 'II', 'III', 'IV', 'V')),
    CONSTRAINT product_tax_classification_tributacao_check
      CHECK (tributacao IS NULL OR tributacao IN ('normal', 'st', 'monofasico', 'isento', 'exportacao')),
    -- Linha que não sobrescreve nada é ruído: bloqueia registro vazio.
    CONSTRAINT product_tax_classification_not_empty
      CHECK (anexo IS NOT NULL OR tributacao IS NOT NULL)
);

-- Índices parciais únicos: um produto (ou categoria) tem no máximo uma linha.
-- UNIQUE comum não serve porque as colunas são mutuamente exclusivas e NULL
-- não colide com NULL em índice único no PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tax_classification_product
  ON product_tax_classification(company_id, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tax_classification_category
  ON product_tax_classification(company_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE TRIGGER trg_product_tax_classification_updated_at
  BEFORE UPDATE ON product_tax_classification
  FOR EACH ROW EXECUTE FUNCTION public.tax_set_updated_at();

ALTER TABLE product_tax_classification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classificacao fiscal da propria empresa" ON product_tax_classification
FOR ALL
USING (company_id = get_user_company_id() AND is_tax_manager())
WITH CHECK (company_id = get_user_company_id() AND is_tax_manager());

REVOKE ALL ON product_tax_classification FROM anon;

COMMENT ON TABLE product_tax_classification IS
  'Classificação fiscal por produto ou categoria. NULL em um atributo significa herança do nível acima (produto -> categoria -> perfil da empresa).';
COMMENT ON COLUMN product_tax_classification.tributacao IS
  'normal | st | monofasico | isento | exportacao. Tudo que não for normal é removido da base tributável do anexo, por já ter sido recolhido na origem ou não ser devido.';

COMMIT;
