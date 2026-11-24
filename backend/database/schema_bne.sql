-- ============================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS - SISTEMA PONTUALL
-- PADRÃO DE NOMENCLATURA BNE (POSTGRESQL / SUPABASE)
-- ============================================================================
-- Convenções BNE aplicadas:
-- Prefixo de tabelas: TAB_
-- Prefixos de colunas: Idf_, Cod_, Nme_, Des_, Dta_, Eml_, Flg_, Num_, Titulo_, Tpo_, Vlr_
-- Sem acentuação em nomes de identificadores
-- ============================================================================

-- Habilita a extensão para geração de UUID e hashing bcrypt
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABELA DE EMPRESAS MULTILOCATÁRIAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Empresa" (
    "Idf_Empresa" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Nme_Empresa" VARCHAR(150) NOT NULL,
    "Nme_Razao_Social" VARCHAR(150),
    "Num_Cnpj" VARCHAR(20) UNIQUE NOT NULL,
    "Flg_Ativa" BOOLEAN DEFAULT TRUE,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 2. TABELA DE COLABORADORES E USUÁRIOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Colaborador" (
    "Idf_Colaborador" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Empresa" UUID REFERENCES "TAB_Empresa"("Idf_Empresa") ON DELETE CASCADE,
    "Cod_Matricula" VARCHAR(50) UNIQUE,
    "Nme_Colaborador" VARCHAR(150) NOT NULL,
    "Eml_Corporativo" VARCHAR(150) NOT NULL UNIQUE,
    "Eml_Secundario" VARCHAR(150),
    "Des_Senha_Hash" VARCHAR(255) NOT NULL,
    "Tpo_Perfil" VARCHAR(30) NOT NULL DEFAULT 'colaborador', -- 'gestor' ou 'colaborador'
    "Flg_Gestor_Master" BOOLEAN DEFAULT FALSE,
    "Tpo_Cargo" VARCHAR(100),
    "Des_Departamento" VARCHAR(100),
    "Des_Avatar_Url" TEXT,
    "Num_Telefone" VARCHAR(30),
    "Num_Horas_Semanais" INTEGER DEFAULT 40,
    "Tpo_Contrato" VARCHAR(30) DEFAULT 'CLT', -- 'CLT', 'PJ', 'TEMPORARIO'
    "Dta_Inicio_Contrato" DATE,
    "Dta_Fim_Contrato" DATE,
    "Num_Cota_Horas_Mensal" INTEGER DEFAULT 160,
    "Vlr_Hora_Pj" NUMERIC(10, 2) DEFAULT 0.00,
    "Flg_Ativo" BOOLEAN DEFAULT TRUE,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 3. TABELA DE RELACIONAMENTO GESTOR <-> COLABORADOR (QUEM É GESTOR DE QUEM)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Gestor_Colaborador" (
    "Idf_Gestor_Colaborador" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Gestor" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Tpo_Vinculo" VARCHAR(50) DEFAULT 'direto', -- 'direto', 'substituto', 'departamento'
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT "UK_Gestor_Colaborador" UNIQUE ("Idf_Gestor", "Idf_Colaborador")
);

-- ----------------------------------------------------------------------------
-- 2. TABELA DE ESCALAS E TURNOS PROGRAMADOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Escala_Turno" (
    "Idf_Turno" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Dta_Turno" DATE NOT NULL,
    "Dta_Hora_Inicio" VARCHAR(10) NOT NULL, -- Ex: '08:00'
    "Dta_Hora_Fim" VARCHAR(10) NOT NULL,    -- Ex: '17:00'
    "Num_Minutos_Intervalo" INTEGER DEFAULT 60,
    "Tpo_Status_Escala" VARCHAR(30) DEFAULT 'published', -- 'draft' ou 'published'
    "Tpo_Status_Presenca" VARCHAR(30) DEFAULT 'pending', -- 'pending', 'present', 'absent', 'justified', 'late'
    "Tpo_Turno" VARCHAR(30) DEFAULT 'regular', -- 'regular', 'meeting', 'on_call', 'training'
    "Titulo_Turno" VARCHAR(150),
    "Des_Observacao" TEXT,
    "Des_Link_Reuniao" TEXT,
    "Flg_Ativo" BOOLEAN DEFAULT TRUE,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 3. TABELA DE REGISTRO DE PONTO DIGITAL COM GPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Registro_Ponto" (
    "Idf_Registro_Ponto" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Turno" UUID REFERENCES "TAB_Escala_Turno"("Idf_Turno") ON DELETE SET NULL,
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Dta_Hora_Registro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Tpo_Registro" VARCHAR(30) NOT NULL, -- 'entrada', 'intervalo_inicio', 'intervalo_fim', 'saida'
    "Num_Latitude" NUMERIC(10, 8),
    "Num_Longitude" NUMERIC(11, 8),
    "Des_Endereco" TEXT,
    "Flg_Gps_Validado" BOOLEAN DEFAULT FALSE,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 4. TABELA DE SOLICITAÇÕES (TROCAS DE TURNO E PEDIDOS DE FOLGA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Solicitacao_Colaborador" (
    "Idf_Solicitacao" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador_Solicitante" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Colaborador_Destino" UUID REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE SET NULL,
    "Idf_Turno" UUID REFERENCES "TAB_Escala_Turno"("Idf_Turno") ON DELETE SET NULL,
    "Tpo_Solicitacao" VARCHAR(30) NOT NULL, -- 'time_off' ou 'swap'
    "Dta_Solicitada" DATE NOT NULL,
    "Des_Motivo" TEXT NOT NULL,
    "Tpo_Status_Solicitacao" VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "Des_Parecer_Gestor" TEXT,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 5. TABELA DE JUSTIFICATIVAS DE AUSÊNCIA E ATESTADOS MÉDICOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Justificativa_Ausencia" (
    "Idf_Justificativa" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Turno" UUID REFERENCES "TAB_Escala_Turno"("Idf_Turno") ON DELETE SET NULL,
    "Dta_Ausencia" DATE NOT NULL,
    "Des_Motivo" TEXT NOT NULL,
    "Cod_Cid_Atestado" VARCHAR(20),
    "Nme_Documento" VARCHAR(255),
    "Tpo_Documento" VARCHAR(50), -- 'pdf', 'image/jpeg', 'image/png'
    "Des_Url_Documento" TEXT,    -- Link do bucket no Supabase Storage
    "Tpo_Status" VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "Des_Parecer_Gestor" TEXT,
    "Dta_Envio" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 6. TABELA DE RELATÓRIOS E ENTREGAS PJ (HORAS, LINKS E COMPROVAÇÕES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Relatorio_Pj" (
    "Idf_Relatorio_Pj" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Des_Periodo_Referencia" VARCHAR(50) NOT NULL, -- Ex: 'Outubro/2026' ou '01/10/2026 a 31/10/2026'
    "Num_Horas_Trabalhadas" NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    "Des_Atividades" TEXT NOT NULL,
    "Des_Links_Json" JSONB DEFAULT '[]'::jsonb,
    "Des_Imagens_Json" JSONB DEFAULT '[]'::jsonb,
    "Tpo_Status" VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "Des_Parecer_Gestor" TEXT,
    "Dta_Envio" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Avaliacao" TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------------------------------------------
-- 7. TABELA DE NOTIFICAÇÕES OPERACIONAIS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Notificacao" (
    "Idf_Notificacao" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador_Destino" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Titulo_Notificacao" VARCHAR(150) NOT NULL,
    "Des_Mensagem" TEXT NOT NULL,
    "Tpo_Notificacao" VARCHAR(50) NOT NULL, -- 'shift_change', 'approval', 'justification', 'reminder', 'system', 'swap'
    "Flg_Lida" BOOLEAN DEFAULT FALSE,
    "Flg_Acao_Requerida" BOOLEAN DEFAULT FALSE,
    "Dta_Envio" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    "Dta_Exclusao" TIMESTAMP WITH TIME ZONE NULL DEFAULT NULL -- Soft delete: expurgo físico após 60 dias
);

-- ----------------------------------------------------------------------------
-- 8. TABELA DE MENSAGENS DO CHAT DA EQUIPE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Mensagem_Chat" (
    "Idf_Mensagem" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador_Remetente" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Idf_Colaborador_Destinatario" UUID REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE SET NULL, -- NULL indica canal publico/equipe
    "Des_Conteudo" TEXT NOT NULL,
    "Dta_Envio" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 9. TABELA DE BLOCO DE NOTAS PESSOAL DO COLABORADOR PJ
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Nota_Pessoal_Pj" (
    "Idf_Nota" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Titulo_Nota" VARCHAR(120) DEFAULT '',
    "Des_Conteudo_Html" TEXT DEFAULT '',
    "Num_Ordem" INTEGER DEFAULT 0,
    "Dta_Atualizacao" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ----------------------------------------------------------------------------
-- 10. TABELA DE ESCALA / AGENDA PESSOAL PRIVADA DO COLABORADOR PJ
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TAB_Escala_Pessoal_Pj" (
    "Idf_Escala_Pj" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Idf_Colaborador" UUID NOT NULL REFERENCES "TAB_Colaborador"("Idf_Colaborador") ON DELETE CASCADE,
    "Dta_Bloco" DATE NOT NULL,
    "Dta_Hora_Inicio" VARCHAR(10) NOT NULL,
    "Dta_Hora_Fim" VARCHAR(10) NOT NULL,
    "Titulo_Bloco" VARCHAR(150) NOT NULL,
    "Des_Observacao" TEXT,
    "Dta_Cadastro" TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
