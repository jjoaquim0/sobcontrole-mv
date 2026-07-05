-- Módulo Documentos (GED)
-- Cria a tabela documents com RLS multi-tenant espelhando o padrão das
-- demais tabelas, além do bucket de Storage e políticas de storage.objects
-- restringindo leitura/escrita à pasta {company_id}/ de cada empresa.

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'outros',
    mime_type TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    storage_path TEXT NOT NULL,
    related_type TEXT,
    related_id TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa aos documentos" ON documents
FOR ALL USING (company_id = get_user_company_id());

REVOKE ALL ON documents FROM anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/xml',
    'application/xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Membros da empresa podem enviar documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);

CREATE POLICY "Membros da empresa podem ver documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);

CREATE POLICY "Membros da empresa podem excluir documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);
