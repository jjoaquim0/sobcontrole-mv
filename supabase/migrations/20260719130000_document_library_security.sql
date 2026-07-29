-- Story 1.16 — Biblioteca de documentos privada, versionada e auditável.
-- Esta migration preserva os objetos legados: cada documento existente recebe
-- uma versão inicial; nenhum arquivo é sobrescrito ou removido nesta mudança.

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';

ALTER TABLE public.documents ALTER COLUMN url DROP NOT NULL;
UPDATE public.documents SET owner_id = uploaded_by WHERE owner_id IS NULL;
UPDATE public.documents SET visibility = 'company' WHERE visibility IS NULL OR visibility NOT IN ('private', 'company', 'restricted');

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_visibility_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_visibility_check CHECK (visibility IN ('private', 'company', 'restricted'));
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check CHECK (status IN ('active', 'archived', 'deleted'));

CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  original_name TEXT NOT NULL CHECK (length(btrim(original_name)) > 0),
  storage_path TEXT NOT NULL UNIQUE CHECK (length(btrim(storage_path)) > 0),
  mime_type TEXT NOT NULL DEFAULT '',
  size BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
  change_comment TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('view', 'download', 'edit', 'admin')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.document_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  summary TEXT NOT NULL CHECK (length(btrim(summary)) > 0),
  previous_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A versão 1 aponta para o objeto legado, mantendo-o acessível após o bucket
-- ficar privado. Novos uploads obedecem ao caminho company/document/version.
INSERT INTO public.document_versions (
  id, document_id, company_id, version_number, original_name, storage_path,
  mime_type, size, change_comment, created_by, created_at
)
SELECT
  gen_random_uuid(), d.id, d.company_id, 1, d.original_name, d.storage_path,
  COALESCE(d.mime_type, ''), COALESCE(d.size, 0), 'Versão inicial migrada', d.uploaded_by, d.created_at
FROM public.documents d
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_versions v WHERE v.document_id = d.id
);

UPDATE public.documents d
SET current_version_id = v.id
FROM public.document_versions v
WHERE v.document_id = d.id AND v.version_number = 1 AND d.current_version_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_current_version_id_fkey'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_current_version_id_fkey
      FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_documents_company_library
  ON public.documents(company_id, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_company_relationship
  ON public.documents(company_id, related_type, related_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_versions_document
  ON public.document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user
  ON public.document_permissions(company_id, user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_events_document
  ON public.document_audit_events(document_id, created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.document_permission_rank(p_access_level TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_access_level
    WHEN 'view' THEN 1
    WHEN 'download' THEN 2
    WHEN 'edit' THEN 3
    WHEN 'admin' THEN 4
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.document_access_level(p_document_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_direct_access TEXT;
  v_base_access TEXT := 'none';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;

  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() THEN
    RETURN 'none';
  END IF;

  IF public.get_user_role() = 'admin' OR v_document.owner_id = auth.uid() THEN
    RETURN 'admin';
  END IF;

  SELECT access_level INTO v_direct_access
  FROM public.document_permissions
  WHERE document_id = p_document_id AND user_id = auth.uid();

  IF v_document.visibility = 'company' THEN
    v_base_access := CASE WHEN public.get_user_role() = 'manager' THEN 'edit' ELSE 'download' END;
  END IF;

  IF public.document_permission_rank(COALESCE(v_direct_access, 'none')) >= public.document_permission_rank(v_base_access) THEN
    RETURN COALESCE(v_direct_access, 'none');
  END IF;

  RETURN v_base_access;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_document(p_document_id UUID, p_required_access TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.document_permission_rank(public.document_access_level(p_document_id))
    >= public.document_permission_rank(p_required_access);
$$;

CREATE OR REPLACE FUNCTION public.can_view_document_record(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ;
  v_company_id UUID;
BEGIN
  SELECT company_id, deleted_at INTO v_company_id, v_deleted_at
  FROM public.documents WHERE id = p_document_id;

  RETURN v_company_id = public.get_user_company_id()
    AND public.can_access_document(p_document_id, 'view')
    AND (v_deleted_at IS NULL OR public.get_user_role() = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_document_relation(
  p_company_id UUID,
  p_related_type TEXT,
  p_related_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists BOOLEAN := false;
BEGIN
  IF p_related_type IS NULL AND p_related_id IS NULL THEN
    RETURN;
  END IF;
  IF p_related_type IS NULL OR p_related_id IS NULL OR p_related_type NOT IN ('customer', 'supplier', 'sale', 'purchase', 'product', 'deal', 'company') THEN
    RAISE EXCEPTION 'Relacionamento de documento inválido.' USING ERRCODE = '22023';
  END IF;

  CASE p_related_type
    WHEN 'customer' THEN SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = p_related_id::UUID AND company_id = p_company_id) INTO v_exists;
    WHEN 'supplier' THEN SELECT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_related_id::UUID AND company_id = p_company_id) INTO v_exists;
    WHEN 'sale' THEN SELECT EXISTS (SELECT 1 FROM public.sales WHERE id = p_related_id AND company_id = p_company_id) INTO v_exists;
    WHEN 'purchase' THEN SELECT EXISTS (SELECT 1 FROM public.purchases WHERE id = p_related_id AND company_id = p_company_id) INTO v_exists;
    WHEN 'product' THEN SELECT EXISTS (SELECT 1 FROM public.products WHERE id = p_related_id::UUID AND company_id = p_company_id) INTO v_exists;
    WHEN 'deal' THEN SELECT EXISTS (SELECT 1 FROM public.deals WHERE id = p_related_id::UUID AND company_id = p_company_id) INTO v_exists;
    WHEN 'company' THEN v_exists := p_related_id = p_company_id::TEXT;
  END CASE;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'A entidade relacionada não pertence à empresa atual.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_expected_document_storage_path(
  p_storage_path TEXT,
  p_company_id UUID,
  p_document_id UUID,
  p_version_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_storage_path ~ ('^' || p_company_id::TEXT || '/' || p_document_id::TEXT || '/' || p_version_id::TEXT || '/[^/]+$');
$$;

CREATE OR REPLACE FUNCTION public.assert_document_storage_object(p_storage_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'documents' AND name = p_storage_path
  ) THEN
    RAISE EXCEPTION 'O arquivo enviado não foi encontrado no Storage.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_document_audit_event(
  p_document_id UUID,
  p_company_id UUID,
  p_event_type TEXT,
  p_summary TEXT,
  p_previous_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.document_audit_events (
    document_id, company_id, event_type, summary, previous_data, new_data, performed_by
  ) VALUES (
    p_document_id, p_company_id, p_event_type, p_summary, p_previous_data, p_new_data, auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_document_with_initial_version(
  p_document_id UUID,
  p_version_id UUID,
  p_name TEXT,
  p_original_name TEXT,
  p_category TEXT,
  p_visibility TEXT,
  p_description TEXT,
  p_related_type TEXT,
  p_related_id TEXT,
  p_storage_path TEXT,
  p_mime_type TEXT,
  p_size BIGINT,
  p_created_by UUID
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID := public.get_user_company_id();
  v_document public.documents%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL OR p_created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Usuário não autorizado a criar documento.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_name, ''))) = 0 OR length(btrim(COALESCE(p_original_name, ''))) = 0 OR length(btrim(COALESCE(p_category, ''))) = 0 THEN
    RAISE EXCEPTION 'Nome, arquivo original e categoria são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_visibility NOT IN ('private', 'company', 'restricted') OR p_size < 0 THEN
    RAISE EXCEPTION 'Metadados de documento inválidos.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_expected_document_storage_path(p_storage_path, v_company_id, p_document_id, p_version_id) THEN
    RAISE EXCEPTION 'Caminho de Storage inválido para o documento.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_document_storage_object(p_storage_path);
  PERFORM public.assert_document_relation(v_company_id, p_related_type, p_related_id);

  INSERT INTO public.documents (
    id, company_id, name, original_name, url, description, category, mime_type, size,
    storage_path, related_type, related_id, status, visibility, owner_id, uploaded_by, source
  ) VALUES (
    p_document_id, v_company_id, btrim(p_name), p_original_name, NULL, NULLIF(btrim(p_description), ''), p_category,
    COALESCE(p_mime_type, ''), p_size, p_storage_path, p_related_type, p_related_id, 'active', p_visibility,
    auth.uid(), auth.uid(), 'upload'
  ) RETURNING * INTO v_document;

  INSERT INTO public.document_versions (
    id, document_id, company_id, version_number, original_name, storage_path, mime_type, size, created_by
  ) VALUES (
    p_version_id, p_document_id, v_company_id, 1, p_original_name, p_storage_path, COALESCE(p_mime_type, ''), p_size, auth.uid()
  );

  UPDATE public.documents
  SET current_version_id = p_version_id, updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_document;

  PERFORM public.log_document_audit_event(
    p_document_id, v_company_id, 'document_created', 'Documento criado e arquivo enviado.', NULL,
    jsonb_build_object('version', 1, 'visibility', p_visibility, 'category', p_category)
  );
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_document_metadata(p_document_id UUID, p_updates JSONB)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_previous public.documents%ROWTYPE;
  v_name TEXT;
  v_description TEXT;
  v_category TEXT;
  v_visibility TEXT;
  v_related_type TEXT;
  v_related_id TEXT;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR NOT public.can_access_document(p_document_id, 'edit') OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a editar este documento.' USING ERRCODE = '42501';
  END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_updates) AS key_name
    WHERE key_name NOT IN ('name', 'description', 'category', 'visibility', 'related_type', 'related_id')
  ) THEN
    RAISE EXCEPTION 'Atualização de documento inválida.' USING ERRCODE = '22023';
  END IF;

  v_previous := v_document;

  v_name := CASE WHEN p_updates ? 'name' THEN btrim(p_updates->>'name') ELSE v_document.name END;
  v_description := CASE WHEN p_updates ? 'description' THEN NULLIF(btrim(p_updates->>'description'), '') ELSE v_document.description END;
  v_category := CASE WHEN p_updates ? 'category' THEN btrim(p_updates->>'category') ELSE v_document.category END;
  v_visibility := CASE WHEN p_updates ? 'visibility' THEN p_updates->>'visibility' ELSE v_document.visibility END;
  v_related_type := CASE WHEN p_updates ? 'related_type' THEN NULLIF(p_updates->>'related_type', '') ELSE v_document.related_type END;
  v_related_id := CASE WHEN p_updates ? 'related_id' THEN NULLIF(p_updates->>'related_id', '') ELSE v_document.related_id END;

  IF length(COALESCE(v_name, '')) = 0 OR length(COALESCE(v_category, '')) = 0 OR v_visibility NOT IN ('private', 'company', 'restricted') THEN
    RAISE EXCEPTION 'Metadados de documento inválidos.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.assert_document_relation(v_document.company_id, v_related_type, v_related_id);

  UPDATE public.documents SET
    name = v_name, description = v_description, category = v_category, visibility = v_visibility,
    related_type = v_related_type, related_id = v_related_id, updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_document;

  IF v_previous.name IS DISTINCT FROM v_document.name THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'name_changed', 'Nome do documento alterado.', jsonb_build_object('name', v_previous.name), jsonb_build_object('name', v_document.name));
  END IF;
  IF v_previous.description IS DISTINCT FROM v_document.description THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'metadata_updated', 'Descrição do documento alterada.', NULL, NULL);
  END IF;
  IF v_previous.category IS DISTINCT FROM v_document.category THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'category_changed', 'Categoria do documento alterada.', jsonb_build_object('category', v_previous.category), jsonb_build_object('category', v_document.category));
  END IF;
  IF v_previous.visibility IS DISTINCT FROM v_document.visibility THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'visibility_changed', 'Visibilidade do documento alterada.', jsonb_build_object('visibility', v_previous.visibility), jsonb_build_object('visibility', v_document.visibility));
  END IF;
  IF v_previous.related_type IS DISTINCT FROM v_document.related_type OR v_previous.related_id IS DISTINCT FROM v_document.related_id THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'relationship_changed', 'Relacionamento do documento alterado.',
      jsonb_build_object('related_type', v_previous.related_type, 'related_id', v_previous.related_id),
      jsonb_build_object('related_type', v_document.related_type, 'related_id', v_document.related_id));
  END IF;
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_document_status(p_document_id UUID, p_status TEXT)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR NOT public.can_access_document(p_document_id, 'edit') OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a alterar o status deste documento.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION 'Status de documento inválido.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documents SET status = p_status, updated_at = now() WHERE id = p_document_id RETURNING * INTO v_document;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id,
    CASE WHEN p_status = 'archived' THEN 'document_archived' ELSE 'document_unarchived' END,
    CASE WHEN p_status = 'archived' THEN 'Documento arquivado.' ELSE 'Documento desarquivado.' END,
    NULL, jsonb_build_object('status', p_status));
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_document_version(
  p_document_id UUID,
  p_version_id UUID,
  p_original_name TEXT,
  p_storage_path TEXT,
  p_mime_type TEXT,
  p_size BIGINT,
  p_change_comment TEXT DEFAULT NULL
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_version_number INTEGER;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR NOT public.can_access_document(p_document_id, 'edit') OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a adicionar versão.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_original_name, ''))) = 0 OR p_size < 0 OR NOT public.is_expected_document_storage_path(p_storage_path, v_document.company_id, p_document_id, p_version_id) THEN
    RAISE EXCEPTION 'Dados da versão inválidos.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.assert_document_storage_object(p_storage_path);
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number FROM public.document_versions WHERE document_id = p_document_id;
  INSERT INTO public.document_versions (
    id, document_id, company_id, version_number, original_name, storage_path, mime_type, size, change_comment, created_by
  ) VALUES (
    p_version_id, p_document_id, v_document.company_id, v_version_number, p_original_name, p_storage_path,
    COALESCE(p_mime_type, ''), p_size, NULLIF(btrim(p_change_comment), ''), auth.uid()
  );
  UPDATE public.documents SET
    current_version_id = p_version_id, original_name = p_original_name, storage_path = p_storage_path,
    mime_type = COALESCE(p_mime_type, ''), size = p_size, updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_document;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'version_added', 'Nova versão adicionada.', NULL,
    jsonb_build_object('version', v_version_number, 'comment', NULLIF(btrim(p_change_comment), '')));
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_document_version(p_document_id UUID, p_version_id UUID)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_version public.document_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR NOT public.can_access_document(p_document_id, 'edit') OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a restaurar versão.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_version FROM public.document_versions WHERE id = p_version_id AND document_id = p_document_id AND company_id = v_document.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.documents SET
    current_version_id = v_version.id, original_name = v_version.original_name, storage_path = v_version.storage_path,
    mime_type = v_version.mime_type, size = v_version.size, updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_document;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'version_restored', 'Versão anterior restaurada como atual.', NULL,
    jsonb_build_object('version', v_version.version_number));
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_document_permission(
  p_document_id UUID,
  p_user_id UUID,
  p_access_level TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_existing_access TEXT;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR public.document_access_level(p_document_id) <> 'admin' OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a administrar permissões.' USING ERRCODE = '42501';
  END IF;
  IF p_access_level NOT IN ('view', 'download', 'edit', 'admin') OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND company_id = v_document.company_id
  ) THEN
    RAISE EXCEPTION 'Permissão ou usuário inválido para esta empresa.' USING ERRCODE = '22023';
  END IF;
  SELECT access_level INTO v_existing_access FROM public.document_permissions WHERE document_id = p_document_id AND user_id = p_user_id;
  INSERT INTO public.document_permissions (document_id, company_id, user_id, access_level, granted_by)
  VALUES (p_document_id, v_document.company_id, p_user_id, p_access_level, auth.uid())
  ON CONFLICT (document_id, user_id) DO UPDATE SET access_level = EXCLUDED.access_level, granted_by = EXCLUDED.granted_by, updated_at = now();
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id,
    CASE WHEN v_existing_access IS NULL THEN 'permission_granted' ELSE 'permission_updated' END,
    CASE WHEN v_existing_access IS NULL THEN 'Permissão concedida.' ELSE 'Permissão alterada.' END,
    CASE WHEN v_existing_access IS NULL THEN NULL ELSE jsonb_build_object('access_level', v_existing_access) END,
    jsonb_build_object('user_id', p_user_id, 'access_level', p_access_level));
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_document_permission(p_document_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
  v_previous_access TEXT;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR public.document_access_level(p_document_id) <> 'admin' OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a administrar permissões.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.document_permissions WHERE document_id = p_document_id AND user_id = p_user_id RETURNING access_level INTO v_previous_access;
  IF v_previous_access IS NOT NULL THEN
    PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'permission_removed', 'Permissão removida.',
      jsonb_build_object('user_id', p_user_id, 'access_level', v_previous_access), NULL);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_document_download(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR v_document.deleted_at IS NOT NULL OR NOT public.can_access_document(p_document_id, 'download') THEN
    RAISE EXCEPTION 'Usuário não autorizado a baixar este documento.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'document_downloaded', 'Download do documento solicitado.');
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR public.document_access_level(p_document_id) <> 'admin' OR v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a excluir este documento.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.documents SET status = 'deleted', deleted_at = now(), deleted_by = auth.uid(), updated_at = now() WHERE id = p_document_id;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'document_deleted', 'Documento excluído logicamente; arquivo e histórico preservados.');
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_document(p_document_id UUID)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_document.company_id <> public.get_user_company_id() OR public.document_access_level(p_document_id) <> 'admin' OR v_document.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Usuário não autorizado a restaurar este documento.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.documents SET status = 'active', deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = p_document_id RETURNING * INTO v_document;
  PERFORM public.log_document_audit_event(p_document_id, v_document.company_id, 'document_restored', 'Documento restaurado.');
  RETURN v_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.document_storage_upload_path_allowed(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID := public.get_user_company_id();
BEGIN
  RETURN auth.uid() IS NOT NULL
    AND v_company_id IS NOT NULL
    AND p_storage_path ~ ('^' || v_company_id::TEXT || '/[^/]+/[^/]+/[^/]+$');
END;
$$;

CREATE OR REPLACE FUNCTION public.document_storage_path_is_accessible(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_versions v
    JOIN public.documents d ON d.id = v.document_id
    WHERE v.storage_path = p_storage_path
      AND d.company_id = public.get_user_company_id()
      AND public.can_access_document(d.id, 'view')
      AND (d.deleted_at IS NULL OR public.get_user_role() = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.document_storage_path_is_orphan(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.document_storage_upload_path_allowed(p_storage_path)
    AND NOT EXISTS (SELECT 1 FROM public.document_versions WHERE storage_path = p_storage_path);
$$;

DROP POLICY IF EXISTS "Acesso total dos membros da empresa aos documentos" ON public.documents;
DROP POLICY IF EXISTS "Documentos visíveis conforme permissão" ON public.documents;
CREATE POLICY "Documentos visíveis conforme permissão" ON public.documents
FOR SELECT TO authenticated
USING (public.can_view_document_record(id));

DROP POLICY IF EXISTS "Versões visíveis conforme documento" ON public.document_versions;
CREATE POLICY "Versões visíveis conforme documento" ON public.document_versions
FOR SELECT TO authenticated
USING (public.can_view_document_record(document_id));

DROP POLICY IF EXISTS "Permissões próprias ou administrativas" ON public.document_permissions;
CREATE POLICY "Permissões próprias ou administrativas" ON public.document_permissions
FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id() AND (user_id = auth.uid() OR public.document_access_level(document_id) = 'admin'));

DROP POLICY IF EXISTS "Histórico visível conforme documento" ON public.document_audit_events;
CREATE POLICY "Histórico visível conforme documento" ON public.document_audit_events
FOR SELECT TO authenticated
USING (public.can_view_document_record(document_id));

REVOKE ALL ON public.document_versions, public.document_permissions, public.document_audit_events FROM anon;
GRANT EXECUTE ON FUNCTION public.document_access_level(UUID), public.can_access_document(UUID, TEXT), public.can_view_document_record(UUID),
  public.create_document_with_initial_version(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, UUID),
  public.update_document_metadata(UUID, JSONB), public.set_document_status(UUID, TEXT), public.add_document_version(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT),
  public.restore_document_version(UUID, UUID), public.upsert_document_permission(UUID, UUID, TEXT), public.remove_document_permission(UUID, UUID),
  public.record_document_download(UUID), public.soft_delete_document(UUID), public.restore_document(UUID),
  public.document_storage_upload_path_allowed(TEXT), public.document_storage_path_is_accessible(TEXT), public.document_storage_path_is_orphan(TEXT)
TO authenticated;

-- O bucket deixa de ser público; os limites e MIME types são os já usados pelo
-- módulo legado. Não criamos política UPDATE porque todos os uploads são imutáveis.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf', 'image/png', 'image/jpeg', 'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/xml', 'application/xml'
    ]
WHERE id = 'documents';

DROP POLICY IF EXISTS "Membros da empresa podem enviar documentos" ON storage.objects;
DROP POLICY IF EXISTS "Membros da empresa podem ver documentos" ON storage.objects;
DROP POLICY IF EXISTS "Membros da empresa podem excluir documentos" ON storage.objects;
DROP POLICY IF EXISTS "Uploads imutáveis de documentos" ON storage.objects;
DROP POLICY IF EXISTS "Leitura de documentos conforme permissão" ON storage.objects;
DROP POLICY IF EXISTS "Limpeza de uploads órfãos de documentos" ON storage.objects;

CREATE POLICY "Uploads imutáveis de documentos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.document_storage_upload_path_allowed(name));

CREATE POLICY "Leitura de documentos conforme permissão" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.document_storage_path_is_accessible(name));

CREATE POLICY "Limpeza de uploads órfãos de documentos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.document_storage_path_is_orphan(name));

COMMIT;
