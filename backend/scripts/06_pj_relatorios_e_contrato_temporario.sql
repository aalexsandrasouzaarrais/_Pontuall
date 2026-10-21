-- ============================================================================
-- SCRIPT DE MIGRAÇÃO: RELATÓRIOS & COMPROVAÇÕES PJ E CONTRATO TEMPORÁRIO
-- ============================================================================

-- 1. Remoção da tabela antiga não utilizada TAB_Contrato_Pj
DROP TABLE IF EXISTS "TAB_Contrato_Pj" CASCADE;

-- 2. Atualização da tabela TAB_Colaborador para suporte aos contratos PJ e Temporário
ALTER TABLE "TAB_Colaborador"
ADD COLUMN IF NOT EXISTS "Tpo_Contrato" VARCHAR(30) DEFAULT 'CLT',
ADD COLUMN IF NOT EXISTS "Dta_Inicio_Contrato" DATE,
ADD COLUMN IF NOT EXISTS "Dta_Fim_Contrato" DATE,
ADD COLUMN IF NOT EXISTS "Num_Cota_Horas_Mensal" INTEGER DEFAULT 160;

-- 3. Criação da tabela dedicada TAB_Relatorio_Pj para envio de entregas, horas, links e imagens
CREATE TABLE IF NOT EXISTS "TAB_Relatorio_Pj" (
    "Idf_Relatorio_Pj" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Des_Periodo_Referencia" VARCHAR(50) NOT NULL, -- Ex: 'Outubro/2026' ou '01/10/2026 a 31/10/2026'
    "Num_Horas_Trabalhadas" NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    "Des_Atividades" TEXT NOT NULL,
    "Des_Timesheet_Json" JSONB DEFAULT '[]'::jsonb, -- Array de tarefas detalhadas: [{"id": "...", "date": "...", "project": "...", "taskDescription": "...", "startTime": "...", "endTime": "...", "breakMinutes": 0, "durationHours": 3.5, ...}]
    "Des_Links_Json" JSONB DEFAULT '[]'::jsonb,    -- Array de objetos: [{"title": "PR GitHub", "url": "..."}]
    "Des_Imagens_Json" JSONB DEFAULT '[]'::jsonb,  -- Array de URLs / Base64 de imagens e prints comprobatórios
    "Tpo_Status" VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "Des_Parecer_Gestor" TEXT,
    "Dta_Envio" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Avaliacao" TIMESTAMP WITH TIME ZONE
);

-- 4. Índices de performance para busca por colaborador e status
CREATE INDEX IF NOT EXISTS "IX_Relatorio_Pj_Colaborador" ON "TAB_Relatorio_Pj" ("Idf_Colaborador");
CREATE INDEX IF NOT EXISTS "IX_Relatorio_Pj_Status" ON "TAB_Relatorio_Pj" ("Tpo_Status");

-- 5. Habilita RLS (Row Level Security) na nova tabela
ALTER TABLE "TAB_Relatorio_Pj" ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acesso permissivas para o anon/service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'TAB_Relatorio_Pj' AND policyname = 'Permitir acesso completo a TAB_Relatorio_Pj'
    ) THEN
        CREATE POLICY "Permitir acesso completo a TAB_Relatorio_Pj" 
        ON "TAB_Relatorio_Pj" 
        FOR ALL 
        TO anon, authenticated, service_role 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
