-- ============================================================================
-- SCRIPT 11: PRIVACIDADE DOS BUCKETS DE DOCUMENTOS ('atestados' e 'documentos')
-- ============================================================================
-- PRÉ-REQUISITO: execute SOMENTE após implantar os endpoints
--   POST /api/storage/upload-url e POST /api/storage/signed-url
-- da branch feat/security-fase-3-sanitizacao-uploads-headers.
-- Pode ser executado com segurança de forma idempotente no SQL Editor do Supabase.
-- ============================================================================

-- 1. Converte os buckets para privados (public = false) e aplica limite de 10 MB + allowlist de MIME
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
WHERE id IN ('atestados', 'documentos');

-- Cria os buckets de forma privada caso algum ambiente novo ainda não os possua
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('atestados', 'atestados', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('documentos', 'documentos', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Remove eventuais policies antigas de acesso público / anon nos objetos desses buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%atestados%'
        OR COALESCE(qual, '') ILIKE '%documentos%'
        OR COALESCE(with_check, '') ILIKE '%atestados%'
        OR COALESCE(with_check, '') ILIKE '%documentos%'
        OR 'anon' = ANY(roles)
        OR 'public' = ANY(roles)
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', pol.policyname);
  END LOOP;
END $$;
