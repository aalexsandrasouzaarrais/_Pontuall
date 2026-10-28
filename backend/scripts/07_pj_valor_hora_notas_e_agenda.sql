-- ============================================================================
-- SCRIPT DE MIGRAÇÃO 07: VALOR DA HORA PJ, BLOCO DE NOTAS E ESCALA PESSOAL PJ
-- ============================================================================

-- 1. Adiciona coluna de Valor da Hora (R$/h) e garante Cota de Horas Mensais na TAB_Colaborador
ALTER TABLE "TAB_Colaborador"
ADD COLUMN IF NOT EXISTS "Vlr_Hora_Pj" NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "Num_Cota_Horas_Mensal" INTEGER DEFAULT 160;


-- 2. Criação da tabela de Notas Pessoais do Colaborador PJ (Bloco de Notas)
CREATE TABLE IF NOT EXISTS "TAB_Nota_Pessoal_Pj" (
    "Idf_Nota_Pj" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Titulo_Nota" VARCHAR(100) DEFAULT '',
    "Des_Conteudo_Html" TEXT DEFAULT '',
    "Des_Data_Exibicao" VARCHAR(80),
    "Num_Ordem" INTEGER DEFAULT 0,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS "IX_Nota_Pessoal_Pj_Colaborador" ON "TAB_Nota_Pessoal_Pj" ("Idf_Colaborador");

ALTER TABLE "TAB_Nota_Pessoal_Pj" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'TAB_Nota_Pessoal_Pj' AND policyname = 'Permitir acesso completo a TAB_Nota_Pessoal_Pj'
    ) THEN
        CREATE POLICY "Permitir acesso completo a TAB_Nota_Pessoal_Pj" 
        ON "TAB_Nota_Pessoal_Pj" 
        FOR ALL 
        TO anon, authenticated, service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 3. Criação da tabela de Escala / Agenda Pessoal Privada do Colaborador PJ
-- (Separada de TAB_Escala_Turno para que o gestor não tenha acesso à agenda pessoal do PJ)
CREATE TABLE IF NOT EXISTS "TAB_Escala_Pessoal_Pj" (
    "Idf_Escala_Pessoal_Pj" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Dta_Agenda" DATE NOT NULL,
    "Dta_Hora_Inicio" VARCHAR(10) NOT NULL,
    "Dta_Hora_Fim" VARCHAR(10) NOT NULL,
    "Num_Minutos_Intervalo" INTEGER DEFAULT 0,
    "Titulo_Atividade" VARCHAR(150) NOT NULL,
    "Des_Local_Ou_Cliente" VARCHAR(150),
    "Des_Observacao" TEXT,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS "IX_Escala_Pessoal_Pj_Colaborador" ON "TAB_Escala_Pessoal_Pj" ("Idf_Colaborador");

ALTER TABLE "TAB_Escala_Pessoal_Pj" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'TAB_Escala_Pessoal_Pj' AND policyname = 'Permitir acesso completo a TAB_Escala_Pessoal_Pj'
    ) THEN
        CREATE POLICY "Permitir acesso completo a TAB_Escala_Pessoal_Pj" 
        ON "TAB_Escala_Pessoal_Pj" 
        FOR ALL 
        TO anon, authenticated, service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
