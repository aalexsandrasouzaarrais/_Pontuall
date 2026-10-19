-- ============================================================================
-- SCRIPT DE CRIPTOGRAFIA / HASHING DE SENHAS EXISTENTES (SUPABASE / POSTGRESQL)
-- ============================================================================
-- Este script garante que todas as senhas armazenadas na tabela TAB_Colaborador
-- sejam convertidas para hashes seguros bcrypt com Salt (pgcrypto).
-- ============================================================================

-- 1. Habilita a extensão pgcrypto no PostgreSQL (caso ainda não esteja ativa)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Converte todas as senhas em texto puro para hash bcrypt seguro com fator de custo 10.
-- Obs: Hashes gerados pelo bcrypt iniciam obrigatoriamente com '$2a$', '$2b$' ou '$2y$'.
-- O filtro WHERE evita re-criptografar senhas que já estejam em formato de hash.
UPDATE "TAB_Colaborador"
SET "Des_Senha_Hash" = crypt("Des_Senha_Hash", gen_salt('bf', 10)),
    "Dta_Atualizacao" = TIMEZONE('utc', NOW())
WHERE "Des_Senha_Hash" IS NOT NULL
  AND "Des_Senha_Hash" NOT LIKE '$2%';

-- 3. Confirma a quantidade de senhas já protegidas
SELECT 
    COUNT(*) AS total_usuarios,
    COUNT(CASE WHEN "Des_Senha_Hash" LIKE '$2%' THEN 1 END) AS senhas_criptografadas_bcrypt,
    COUNT(CASE WHEN "Des_Senha_Hash" NOT LIKE '$2%' THEN 1 END) AS senhas_em_texto_plano
FROM "TAB_Colaborador";
