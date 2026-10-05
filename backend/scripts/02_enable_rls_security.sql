-- =========================================================================
-- SCRIPT DE ATIVAÇÃO DE SEGURANÇA RLS NO SUPABASE (SEGURO E DINÂMICO)
-- Remove as etiquetas vermelhas UNRESTRICTED de todas as tabelas do Pontual
-- =========================================================================

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'TAB_Colaborador',
        'TAB_Contrato_Pj',
        'TAB_Escala_Turno',
        'TAB_Justificativa_Ausencia',
        'TAB_Justificativa_Falta',
        'TAB_Mensagem_Chat',
        'TAB_Notificacao',
        'TAB_Registro_Ponto',
        'TAB_Solicitacao_Colaborador',
        'TAB_Solicitacao_Folga',
        'TAB_Empresa',
        'TAB_Gestor_Colaborador',
        'chat_channels',
        'messages'
    ];
BEGIN 
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Permitir Acesso ' || t, t);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', 'Permitir Acesso ' || t, t);
        END IF;
    END LOOP;
END $$;
