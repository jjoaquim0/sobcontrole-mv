-- Rollback — Story 1.29: classificação fiscal de produtos e categorias
--
-- ATENÇÃO: a classificação fiscal não existe em nenhuma outra tabela. Perdê-la
-- faz a apuração voltar a usar o anexo único do perfil da empresa, degradando a
-- precisão sem aviso. Exportar antes se houver classificação em produção.

BEGIN;

DROP TRIGGER IF EXISTS trg_product_tax_classification_updated_at ON product_tax_classification;

DROP INDEX IF EXISTS idx_product_tax_classification_category;
DROP INDEX IF EXISTS idx_product_tax_classification_product;

DROP TABLE IF EXISTS product_tax_classification;

COMMIT;
