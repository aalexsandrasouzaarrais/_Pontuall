-- =========================================================================
-- Script 03 - Lembretes da Gestão + ajustes de vínculo Gestor <-> Colaborador
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.
-- =========================================================================

-- 1. TABELA PRINCIPAL DE LEMBRETES (precisa existir antes da tabela associativa)
CREATE TABLE IF NOT EXISTS public."TAB_Lembrete" (
  "Idf_Lembrete" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "Idf_Criador" UUID NULL,
  "Idf_Empresa" UUID NULL,
  "Titulo_Lembrete" VARCHAR(150) NOT NULL,
  "Des_Lembrete" TEXT NULL,
  "Tpo_Lembrete" VARCHAR(30) NOT NULL DEFAULT 'atividade',
  "Des_Tag" VARCHAR(50) NULL DEFAULT 'Geral',
  "Dta_Lembrete" DATE NOT NULL,
  "Dta_Hora_Lembrete" VARCHAR(10) NOT NULL DEFAULT '08:00',
  "Des_Link_Reuniao" TEXT NULL,
  "Flg_Concluido" BOOLEAN NULL DEFAULT FALSE,
  "Flg_Ativo" BOOLEAN NULL DEFAULT TRUE,
  "Dta_Cadastro" TIMESTAMP WITH TIME ZONE NULL DEFAULT TIMEZONE('utc', NOW()),
  "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT "TAB_Lembrete_pkey" PRIMARY KEY ("Idf_Lembrete"),
  CONSTRAINT "TAB_Lembrete_Idf_Criador_fkey" FOREIGN KEY ("Idf_Criador")
    REFERENCES public."TAB_Colaborador" ("Idf_Colaborador") ON DELETE CASCADE
);

-- 1.1 FK de empresa (adicionada separadamente para funcionar em tabelas já existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TAB_Lembrete_Idf_Empresa_fkey'
  ) THEN
    ALTER TABLE public."TAB_Lembrete"
      ADD CONSTRAINT "TAB_Lembrete_Idf_Empresa_fkey"
      FOREIGN KEY ("Idf_Empresa") REFERENCES public."TAB_Empresa" ("Idf_Empresa") ON DELETE CASCADE;
  END IF;
END $$;

-- 2. TABELA ASSOCIATIVA M:N LEMBRETE <-> COLABORADORES ALOCADOS
CREATE TABLE IF NOT EXISTS public."TAB_Lembrete_Colaborador" (
  "Idf_Lembrete_Colaborador" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "Idf_Lembrete" UUID NOT NULL,
  "Idf_Colaborador" UUID NOT NULL,
  "Dta_Alocacao" TIMESTAMP WITH TIME ZONE NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT "TAB_Lembrete_Colaborador_pkey" PRIMARY KEY ("Idf_Lembrete_Colaborador"),
  CONSTRAINT "UQ_Lembrete_Colaborador" UNIQUE ("Idf_Lembrete", "Idf_Colaborador"),
  CONSTRAINT "TAB_Lembrete_Colaborador_Idf_Lembrete_fkey" FOREIGN KEY ("Idf_Lembrete")
    REFERENCES public."TAB_Lembrete" ("Idf_Lembrete") ON DELETE CASCADE,
  CONSTRAINT "TAB_Lembrete_Colaborador_Idf_Colaborador_fkey" FOREIGN KEY ("Idf_Colaborador")
    REFERENCES public."TAB_Colaborador" ("Idf_Colaborador") ON DELETE CASCADE
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS "IDX_Lembrete_Empresa" ON public."TAB_Lembrete" ("Idf_Empresa");
CREATE INDEX IF NOT EXISTS "IDX_Lembrete_Dta" ON public."TAB_Lembrete" ("Dta_Lembrete");
CREATE INDEX IF NOT EXISTS "IDX_Lembrete_Criador" ON public."TAB_Lembrete" ("Idf_Criador");
CREATE INDEX IF NOT EXISTS "IDX_Lembrete_Colab_Id" ON public."TAB_Lembrete_Colaborador" ("Idf_Colaborador");
CREATE INDEX IF NOT EXISTS "IDX_Lembrete_Colab_Lembrete" ON public."TAB_Lembrete_Colaborador" ("Idf_Lembrete");

-- 4. VÍNCULO GESTOR <-> COLABORADOR: garante as colunas usadas pelo frontend
--    (o schema_bne.sql original criava a tabela sem elas)
ALTER TABLE public."TAB_Gestor_Colaborador"
  ADD COLUMN IF NOT EXISTS "Idf_Empresa" UUID REFERENCES public."TAB_Empresa"("Idf_Empresa") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "Flg_Gestor_Principal" BOOLEAN DEFAULT TRUE;

-- 5. RLS (mesmo padrão permissivo já usado no script 02)
ALTER TABLE public."TAB_Lembrete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TAB_Lembrete_Colaborador" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir Acesso TAB_Lembrete" ON public."TAB_Lembrete";
CREATE POLICY "Permitir Acesso TAB_Lembrete" ON public."TAB_Lembrete"
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir Acesso TAB_Lembrete_Colaborador" ON public."TAB_Lembrete_Colaborador";
CREATE POLICY "Permitir Acesso TAB_Lembrete_Colaborador" ON public."TAB_Lembrete_Colaborador"
  FOR ALL USING (true) WITH CHECK (true);

-- 6. CORREÇÃO DE DADOS ANTIGOS: colaboradores cadastrados sem empresa herdam a
--    empresa do gestor ao qual estão vinculados (causa de "sumir após F5").
UPDATE public."TAB_Colaborador" c
SET "Idf_Empresa" = g."Idf_Empresa"
FROM public."TAB_Gestor_Colaborador" gc
JOIN public."TAB_Colaborador" g ON g."Idf_Colaborador" = gc."Idf_Gestor"
WHERE gc."Idf_Colaborador" = c."Idf_Colaborador"
  AND c."Idf_Empresa" IS NULL
  AND g."Idf_Empresa" IS NOT NULL;
