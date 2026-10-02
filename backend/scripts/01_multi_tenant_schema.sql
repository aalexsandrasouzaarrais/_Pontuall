-- Script de Migração de Banco de Dados Pontuall
-- Suporte a Multi-Empresa (Multi-Tenant) e Relacionamento M:N Gestor ↔ Colaborador
-- Convenção: BNE Standard (TAB_)

-- 1. Criação da Tabela de Empresas
CREATE TABLE IF NOT EXISTS public."TAB_Empresa" (
    "Idf_Empresa" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Num_CNPJ" VARCHAR(18) UNIQUE NOT NULL,
    "Nme_Razao_Social" VARCHAR(200) NOT NULL,
    "Nme_Fantasia" VARCHAR(200),
    "Cod_Codigo_Convite" VARCHAR(20) UNIQUE,
    "Dat_Criacao" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "Flg_Ativa" BOOLEAN DEFAULT TRUE
);

-- 2. Alteração em TAB_Colaborador para adicionar vínculos de empresa e master
ALTER TABLE public."TAB_Colaborador"
    ADD COLUMN IF NOT EXISTS "Idf_Empresa" UUID REFERENCES public."TAB_Empresa"("Idf_Empresa") ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS "Flg_Gestor_Master" BOOLEAN DEFAULT FALSE;

-- 3. Tabela de Vinculação M:N entre Gestores e Colaboradores
CREATE TABLE IF NOT EXISTS public."TAB_Gestor_Colaborador" (
    "Idf_Gestor_Colaborador" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "Idf_Gestor" UUID NOT NULL REFERENCES public."TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Colaborador" UUID NOT NULL REFERENCES public."TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Empresa" UUID REFERENCES public."TAB_Empresa"("Idf_Empresa") ON DELETE CASCADE,
    "Flg_Gestor_Principal" BOOLEAN DEFAULT TRUE,
    "Dat_Vinculo" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT "UK_Gestor_Colaborador" UNIQUE ("Idf_Gestor", "Idf_Colaborador")
);

-- 4. Índices de Desempenho
CREATE INDEX IF NOT EXISTS "IDX_TAB_Colaborador_Empresa" ON public."TAB_Colaborador" ("Idf_Empresa");
CREATE INDEX IF NOT EXISTS "IDX_TAB_Gestor_Colaborador_Gestor" ON public."TAB_Gestor_Colaborador" ("Idf_Gestor");
CREATE INDEX IF NOT EXISTS "IDX_TAB_Gestor_Colaborador_Colaborador" ON public."TAB_Gestor_Colaborador" ("Idf_Colaborador");
CREATE INDEX IF NOT EXISTS "IDX_TAB_Empresa_CNPJ" ON public."TAB_Empresa" ("Num_CNPJ");

-- 5. Habilitar RLS com Políticas de Acesso
ALTER TABLE public."TAB_Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TAB_Gestor_Colaborador" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir Acesso Total TAB_Empresa" ON public."TAB_Empresa";
CREATE POLICY "Permitir Acesso Total TAB_Empresa" ON public."TAB_Empresa" FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir Acesso Total TAB_Gestor_Colaborador" ON public."TAB_Gestor_Colaborador";
CREATE POLICY "Permitir Acesso Total TAB_Gestor_Colaborador" ON public."TAB_Gestor_Colaborador" FOR ALL USING (true) WITH CHECK (true);
