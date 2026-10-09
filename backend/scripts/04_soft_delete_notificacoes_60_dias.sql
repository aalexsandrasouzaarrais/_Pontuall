-- =========================================================================
-- Script 04 - Soft Delete de Notificações com Retenção de 60 Dias
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.
-- =========================================================================

-- 1. ADICIONA A COLUNA Dta_Exclusao NA TABELA TAB_Notificacao (SE NÃO EXISTIR)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'TAB_Notificacao' 
      AND column_name = 'Dta_Exclusao'
  ) THEN
    ALTER TABLE public."TAB_Notificacao"
      ADD COLUMN "Dta_Exclusao" TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL;
    
    COMMENT ON COLUMN public."TAB_Notificacao"."Dta_Exclusao" IS 
      'Data/hora em que o colaborador apagou a notificação (Soft Delete). Se NULL, está ativa. Registros com mais de 60 dias são expurgados definitivamente.';
  END IF;
END $$;

-- 2. ÍNDICES PARA ALTA PERFORMANCE
-- Permite que consultas de notificações ativas (Dta_Exclusao IS NULL) e limpeza por data sejam ultrarrápidas
CREATE INDEX IF NOT EXISTS "IDX_Notificacao_Ativas" 
  ON public."TAB_Notificacao" ("Idf_Colaborador_Destino") 
  WHERE "Dta_Exclusao" IS NULL;

CREATE INDEX IF NOT EXISTS "IDX_Notificacao_Dta_Exclusao" 
  ON public."TAB_Notificacao" ("Dta_Exclusao") 
  WHERE "Dta_Exclusao" IS NOT NULL;

-- 3. FUNÇÃO PARA EXPURGO AUTOMÁTICO DE NOTIFICAÇÕES COM MAIS DE 60 DIAS
CREATE OR REPLACE FUNCTION public.fn_expurgar_notificacoes_antigas_60_dias()
RETURNS integer AS $$
DECLARE
  v_deletados integer;
BEGIN
  -- Apaga definitivamente apenas os registros onde o colaborador apagou há mais de 60 dias
  DELETE FROM public."TAB_Notificacao"
  WHERE "Dta_Exclusao" IS NOT NULL
    AND "Dta_Exclusao" < (NOW() - INTERVAL '60 days');

  GET DIAGNOSTICS v_deletados = ROW_COUNT;
  RETURN v_deletados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_expurgar_notificacoes_antigas_60_dias() IS 
  'Remove definitivamente do banco de dados as notificações apagadas pelo colaborador há mais de 60 dias.';

-- 4. AGENDAMENTO AUTOMÁTICO VIA PG_CRON (SE A EXTENSÃO ESTIVER DISPONÍVEL NO SUPABASE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove agendamento anterior se houver
    PERFORM cron.unschedule('expurgo-notificacoes-60-dias');
    
    -- Agenda execução diária às 03:30 da madrugada
    PERFORM cron.schedule(
      'expurgo-notificacoes-60-dias',
      '30 3 * * *',
      'SELECT public.fn_expurgar_notificacoes_antigas_60_dias();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Se não tiver permissão de cron ou pg_cron não estiver instalado, 
    -- a rotina continuará sendo garantida pelo backend/frontend da aplicação
    NULL;
END $$;
