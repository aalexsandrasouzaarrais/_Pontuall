-- ============================================================================
-- SCRIPT 08: SUPORTE A IMAGENS DE GRUPOS E METADADOS DE CANAIS DE CHAT
-- ============================================================================

-- 1. Cria a tabela chat_channels caso ainda não exista no ambiente
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    badge TEXT DEFAULT 'Equipe',
    created_by TEXT DEFAULT '',
    members JSONB DEFAULT '[]'::jsonb,
    avatar TEXT DEFAULT NULL
);

-- 2. Adiciona a coluna avatar na tabela chat_channels caso a tabela já exista
ALTER TABLE public.chat_channels
ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT NULL;

-- 3. Garante que a tabela messages possua a coluna attachment para imagens/arquivos e metadados
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS attachment TEXT DEFAULT NULL;
