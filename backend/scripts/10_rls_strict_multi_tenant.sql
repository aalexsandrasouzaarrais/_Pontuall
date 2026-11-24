-- ============================================================================
-- SCRIPT 10: RLS MULTI-TENANT ESTRITO (NÃO EXECUTAR ANTES DO PRÉ-REQUISITO!)
-- ============================================================================
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ATENÇÃO / PRÉ-REQUISITO OBRIGATÓRIO:
-- NÃO execute este script no Supabase enquanto o frontend estiver consultando
-- tabelas diretamente com a ANON KEY sem sessão Supabase Auth contendo claims
-- em app_metadata ('company_id', 'colaborador_id', 'perfil') OU sem que todas
-- as leituras/escritas tenham sido migradas para endpoints backend autenticados
-- com service_role.
--
-- Se executado antes dessa migração, todas as consultas feitas diretamente
-- pelo navegador via anon key passarão a ser bloqueadas (retornando vazio/403).
-- ============================================================================

-- 1. Funções auxiliares de RLS baseadas exclusivamente em app_metadata do JWT autenticado
--    (app_metadata só pode ser definido pelo servidor/service_role, nunca editado pelo usuário)
CREATE OR REPLACE FUNCTION public.fn_rls_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.fn_rls_colaborador_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'colaborador_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.fn_rls_is_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT LOWER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'perfil', '')) IN ('gestor', 'rh', 'admin');
$$;

REVOKE ALL ON FUNCTION public.fn_rls_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_rls_colaborador_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_rls_is_gestor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_rls_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_rls_colaborador_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_rls_is_gestor() TO authenticated, service_role;

-- 2. Remove policies permissivas antigas (USING true / WITH CHECK true) dos scripts 01 a 07
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname LIKE 'Permitir Acesso%'
        OR policyname LIKE 'Permitir acesso%'
        OR COALESCE(qual, '') IN ('true', '(true)')
        OR COALESCE(with_check, '') IN ('true', '(true)')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Garante RLS ativado em todas as tabelas de negócio
ALTER TABLE IF EXISTS public."TAB_Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Colaborador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Gestor_Colaborador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Escala_Turno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Registro_Ponto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Solicitacao_Colaborador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Justificativa_Ausencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Relatorio_Pj" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Notificacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Mensagem_Chat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Nota_Pessoal_Pj" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Escala_Pessoal_Pj" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Lembrete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Lembrete_Colaborador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."TAB_Password_Reset_Token" ENABLE ROW LEVEL SECURITY;

-- 3. Policies estritas multi-tenant para papel `authenticated`

-- TAB_Empresa: somente usuários autenticados da própria empresa
CREATE POLICY "rls_empresa_select_own" ON public."TAB_Empresa"
  FOR SELECT TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id());

CREATE POLICY "rls_empresa_update_gestor" ON public."TAB_Empresa"
  FOR UPDATE TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor())
  WITH CHECK ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor());

-- TAB_Colaborador: vê própria linha ou colegas da mesma empresa; gestão apenas por gestor da mesma empresa
CREATE POLICY "rls_colaborador_select_tenant" ON public."TAB_Colaborador"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR ("Idf_Empresa" IS NOT NULL AND "Idf_Empresa" = public.fn_rls_company_id())
  );

CREATE POLICY "rls_colaborador_manage_gestor" ON public."TAB_Colaborador"
  FOR ALL TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor())
  WITH CHECK ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor());

-- TAB_Gestor_Colaborador: isolado por empresa
CREATE POLICY "rls_gestor_colab_select_tenant" ON public."TAB_Gestor_Colaborador"
  FOR SELECT TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id());

CREATE POLICY "rls_gestor_colab_manage_gestor" ON public."TAB_Gestor_Colaborador"
  FOR ALL TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor())
  WITH CHECK ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor());

-- TAB_Escala_Turno: própria empresa (gestor gerencia, colaborador lê própria escala ou da empresa)
CREATE POLICY "rls_escala_select_tenant" ON public."TAB_Escala_Turno"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public."TAB_Colaborador" c
      WHERE c."Idf_Colaborador" = "TAB_Escala_Turno"."Idf_Colaborador"
        AND c."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

CREATE POLICY "rls_escala_manage_gestor" ON public."TAB_Escala_Turno"
  FOR ALL TO authenticated
  USING (
    public.fn_rls_is_gestor()
    AND EXISTS (
      SELECT 1 FROM public."TAB_Colaborador" c
      WHERE c."Idf_Colaborador" = "TAB_Escala_Turno"."Idf_Colaborador"
        AND c."Idf_Empresa" = public.fn_rls_company_id()
    )
  )
  WITH CHECK (
    public.fn_rls_is_gestor()
    AND EXISTS (
      SELECT 1 FROM public."TAB_Colaborador" c
      WHERE c."Idf_Colaborador" = "TAB_Escala_Turno"."Idf_Colaborador"
        AND c."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

-- TAB_Registro_Ponto: colaborador lê/insere próprio ponto; gestor lê pontos da empresa
CREATE POLICY "rls_ponto_select" ON public."TAB_Registro_Ponto"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR (
      public.fn_rls_is_gestor()
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Registro_Ponto"."Idf_Colaborador"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  );

CREATE POLICY "rls_ponto_insert_self" ON public."TAB_Registro_Ponto"
  FOR INSERT TO authenticated
  WITH CHECK ("Idf_Colaborador" = public.fn_rls_colaborador_id());

-- TAB_Solicitacao_Colaborador: solicitante, destinatário ou gestor da mesma empresa
CREATE POLICY "rls_solicitacao_select" ON public."TAB_Solicitacao_Colaborador"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador_Solicitante" = public.fn_rls_colaborador_id()
    OR "Idf_Colaborador_Destino" = public.fn_rls_colaborador_id()
    OR (
      public.fn_rls_is_gestor()
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Solicitacao_Colaborador"."Idf_Colaborador_Solicitante"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  );

CREATE POLICY "rls_solicitacao_insert_self" ON public."TAB_Solicitacao_Colaborador"
  FOR INSERT TO authenticated
  WITH CHECK ("Idf_Colaborador_Solicitante" = public.fn_rls_colaborador_id());

CREATE POLICY "rls_solicitacao_update_gestor_or_dest" ON public."TAB_Solicitacao_Colaborador"
  FOR UPDATE TO authenticated
  USING (
    "Idf_Colaborador_Destino" = public.fn_rls_colaborador_id()
    OR (
      public.fn_rls_is_gestor()
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Solicitacao_Colaborador"."Idf_Colaborador_Solicitante"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  );

-- TAB_Justificativa_Ausencia: próprio colaborador ou gestor da mesma empresa
CREATE POLICY "rls_justificativa_select" ON public."TAB_Justificativa_Ausencia"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR (
      public.fn_rls_is_gestor()
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Justificativa_Ausencia"."Idf_Colaborador"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  );

CREATE POLICY "rls_justificativa_insert_self" ON public."TAB_Justificativa_Ausencia"
  FOR INSERT TO authenticated
  WITH CHECK ("Idf_Colaborador" = public.fn_rls_colaborador_id());

CREATE POLICY "rls_justificativa_update_gestor" ON public."TAB_Justificativa_Ausencia"
  FOR UPDATE TO authenticated
  USING (
    public.fn_rls_is_gestor()
    AND EXISTS (
      SELECT 1 FROM public."TAB_Colaborador" c
      WHERE c."Idf_Colaborador" = "TAB_Justificativa_Ausencia"."Idf_Colaborador"
        AND c."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

-- TAB_Relatorio_Pj: próprio PJ ou gestor da mesma empresa
CREATE POLICY "rls_relatorio_pj_select" ON public."TAB_Relatorio_Pj"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR (
      public.fn_rls_is_gestor()
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Relatorio_Pj"."Idf_Colaborador"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  );

CREATE POLICY "rls_relatorio_pj_write_self" ON public."TAB_Relatorio_Pj"
  FOR ALL TO authenticated
  USING ("Idf_Colaborador" = public.fn_rls_colaborador_id())
  WITH CHECK ("Idf_Colaborador" = public.fn_rls_colaborador_id());

-- TAB_Notificacao: somente destinatário lê/atualiza/deleta próprias notificações
CREATE POLICY "rls_notificacao_self" ON public."TAB_Notificacao"
  FOR ALL TO authenticated
  USING ("Idf_Colaborador_Destino" = public.fn_rls_colaborador_id())
  WITH CHECK ("Idf_Colaborador_Destino" = public.fn_rls_colaborador_id());

CREATE POLICY "rls_notificacao_insert_tenant" ON public."TAB_Notificacao"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."TAB_Colaborador" c
      WHERE c."Idf_Colaborador" = "TAB_Notificacao"."Idf_Colaborador_Destino"
        AND c."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

-- TAB_Mensagem_Chat: remetente/destinatário ou colegas da mesma empresa
CREATE POLICY "rls_mensagem_chat_tenant" ON public."TAB_Mensagem_Chat"
  FOR ALL TO authenticated
  USING (
    "Idf_Colaborador_Remetente" = public.fn_rls_colaborador_id()
    OR "Idf_Colaborador_Destinatario" = public.fn_rls_colaborador_id()
    OR (
      "Idf_Colaborador_Destinatario" IS NULL
      AND EXISTS (
        SELECT 1 FROM public."TAB_Colaborador" c
        WHERE c."Idf_Colaborador" = "TAB_Mensagem_Chat"."Idf_Colaborador_Remetente"
          AND c."Idf_Empresa" = public.fn_rls_company_id()
      )
    )
  )
  WITH CHECK ("Idf_Colaborador_Remetente" = public.fn_rls_colaborador_id());

-- TAB_Nota_Pessoal_Pj & TAB_Escala_Pessoal_Pj: exclusivamente dono da nota/agenda pessoal
CREATE POLICY "rls_nota_pj_self" ON public."TAB_Nota_Pessoal_Pj"
  FOR ALL TO authenticated
  USING ("Idf_Colaborador" = public.fn_rls_colaborador_id())
  WITH CHECK ("Idf_Colaborador" = public.fn_rls_colaborador_id());

CREATE POLICY "rls_escala_pj_self" ON public."TAB_Escala_Pessoal_Pj"
  FOR ALL TO authenticated
  USING ("Idf_Colaborador" = public.fn_rls_colaborador_id())
  WITH CHECK ("Idf_Colaborador" = public.fn_rls_colaborador_id());

-- TAB_Lembrete & TAB_Lembrete_Colaborador: isolados por Idf_Empresa e vínculo
CREATE POLICY "rls_lembrete_select_tenant" ON public."TAB_Lembrete"
  FOR SELECT TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id());

CREATE POLICY "rls_lembrete_manage_gestor" ON public."TAB_Lembrete"
  FOR ALL TO authenticated
  USING ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor())
  WITH CHECK ("Idf_Empresa" = public.fn_rls_company_id() AND public.fn_rls_is_gestor());

CREATE POLICY "rls_lembrete_colab_select" ON public."TAB_Lembrete_Colaborador"
  FOR SELECT TO authenticated
  USING (
    "Idf_Colaborador" = public.fn_rls_colaborador_id()
    OR EXISTS (
      SELECT 1 FROM public."TAB_Lembrete" l
      WHERE l."Idf_Lembrete" = "TAB_Lembrete_Colaborador"."Idf_Lembrete"
        AND l."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

CREATE POLICY "rls_lembrete_colab_manage_gestor" ON public."TAB_Lembrete_Colaborador"
  FOR ALL TO authenticated
  USING (
    public.fn_rls_is_gestor()
    AND EXISTS (
      SELECT 1 FROM public."TAB_Lembrete" l
      WHERE l."Idf_Lembrete" = "TAB_Lembrete_Colaborador"."Idf_Lembrete"
        AND l."Idf_Empresa" = public.fn_rls_company_id()
    )
  )
  WITH CHECK (
    public.fn_rls_is_gestor()
    AND EXISTS (
      SELECT 1 FROM public."TAB_Lembrete" l
      WHERE l."Idf_Lembrete" = "TAB_Lembrete_Colaborador"."Idf_Lembrete"
        AND l."Idf_Empresa" = public.fn_rls_company_id()
    )
  );

-- 4. Tabelas chat_channels e messages (escopo de tenant via prefixo cmp_<companyId>__)
DO $$
BEGIN
  IF to_regclass('public.chat_channels') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "rls_chat_channels_tenant" ON public.chat_channels;';
    EXECUTE $p$
      CREATE POLICY "rls_chat_channels_tenant" ON public.chat_channels
        FOR ALL TO authenticated
        USING (starts_with(id, 'cmp_' || public.fn_rls_company_id()::text || '__'))
        WITH CHECK (starts_with(id, 'cmp_' || public.fn_rls_company_id()::text || '__'));
    $p$;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "rls_messages_tenant" ON public.messages;';
    EXECUTE $p$
      CREATE POLICY "rls_messages_tenant" ON public.messages
        FOR ALL TO authenticated
        USING (
          starts_with(channel, 'cmp_' || public.fn_rls_company_id()::text || '__')
          OR sender_id = public.fn_rls_colaborador_id()::text
          OR recipient_id = public.fn_rls_colaborador_id()::text
        )
        WITH CHECK (
          sender_id = public.fn_rls_colaborador_id()::text
          OR starts_with(channel, 'cmp_' || public.fn_rls_company_id()::text || '__')
        );
    $p$;
  END IF;
END $$;
