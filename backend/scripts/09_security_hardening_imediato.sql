-- ============================================================================
-- SCRIPT 09: ENDURECIMENTO DE SEGURANÇA IMEDIATO (SEGURO PARA EXECUTAR AGORA)
-- ============================================================================
-- Este script NÃO quebra o funcionamento atual da aplicação nem bloqueia o
-- cliente frontend enquanto a migração de autenticação JWT é concluída.
-- Pode ser executado imediatamente no SQL Editor do Supabase.
-- ============================================================================

-- 1. Extensões necessárias para UUID e hashing bcrypt no banco
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Protege a função SECURITY DEFINER de limpeza de notificações contra search_path hijacking
--    e restringe execução pública (apenas service_role deve executá-la).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_expurgar_notificacoes_antigas_60_dias'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION public.fn_expurgar_notificacoes_antigas_60_dias()
      SET search_path = public, pg_temp;

    REVOKE ALL ON FUNCTION public.fn_expurgar_notificacoes_antigas_60_dias()
      FROM PUBLIC, anon, authenticated;

    GRANT EXECUTE ON FUNCTION public.fn_expurgar_notificacoes_antigas_60_dias()
      TO service_role;
  END IF;
END $$;

-- 3. Tabela persistente para tokens criptográficos de redefinição de senha (uso único / expiração)
--    Essencial para ambientes serverless (ex.: Vercel) onde não há memória compartilhada entre requisições.
CREATE TABLE IF NOT EXISTS public."TAB_Password_Reset_Token" (
  "Idf_Token_Reset" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "Idf_Colaborador" UUID NOT NULL REFERENCES public."TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
  "Cod_Matricula" VARCHAR(60),
  "Cod_Token_Hash" CHAR(64) NOT NULL UNIQUE,
  "Dta_Expira_Em" TIMESTAMP WITH TIME ZONE NOT NULL,
  "Flg_Utilizado" BOOLEAN NOT NULL DEFAULT FALSE,
  "Dta_Utilizado_Em" TIMESTAMP WITH TIME ZONE NULL,
  "Dta_Criacao" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS "IDX_Password_Reset_Token_Hash"
  ON public."TAB_Password_Reset_Token" ("Cod_Token_Hash");

CREATE INDEX IF NOT EXISTS "IDX_Password_Reset_Token_Colab"
  ON public."TAB_Password_Reset_Token" ("Idf_Colaborador");

-- RLS ativo SEM policies públicas: apenas o backend com service_role consegue ler/gravar tokens
ALTER TABLE public."TAB_Password_Reset_Token" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."TAB_Password_Reset_Token" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."TAB_Password_Reset_Token" TO service_role;

-- 4. Converte eventuais senhas ainda em texto puro na TAB_Colaborador para bcrypt (custo 12)
--    Não re-criptografa hashes já iniciados por '$2'.
UPDATE public."TAB_Colaborador"
SET "Des_Senha_Hash" = crypt("Des_Senha_Hash", gen_salt('bf', 12)),
    "Dta_Atualizacao" = TIMEZONE('utc', NOW())
WHERE "Des_Senha_Hash" IS NOT NULL
  AND "Des_Senha_Hash" NOT LIKE '$2%';

-- 5. Segurança de Storage Buckets ('atestados' e 'documentos')
--    RECOMENDAÇÃO MANUAL NO PAINEL DO SUPABASE STORAGE:
--    Após migrar o download no cliente para Signed URLs via backend autenticado,
--    altere os buckets 'atestados' e 'documentos' para Private (public = false):
--      UPDATE storage.buckets SET public = false WHERE id IN ('atestados', 'documentos');
--    E remova políticas públicas de leitura para 'anon' em storage.objects.
