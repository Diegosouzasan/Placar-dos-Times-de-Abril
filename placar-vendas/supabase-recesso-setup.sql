-- ============================================================
-- META RECESSO - Script de configuração no Supabase
-- Execute este script inteiro no SQL Editor do Supabase.
-- ============================================================

-- 1. Configuração da campanha (destinos das TVs, revisão e saldos preservados)
CREATE TABLE IF NOT EXISTS public.recesso_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    revision INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL DEFAULT '2026-11-13',
    destinations JSONB NOT NULL DEFAULT '{}'::jsonb,
    fixed_openings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.recesso_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Lançamentos manuais adicionais ("Adicionar cadastro")
CREATE TABLE IF NOT EXISTS public.recesso_entries (
    id TEXT PRIMARY KEY,
    team TEXT NOT NULL CHECK (team IN ('ivanize', 'claudenise')),
    date TEXT NOT NULL,
    cents BIGINT NOT NULL,
    seller INTEGER,
    paid BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recesso_entries_date_team
    ON public.recesso_entries(date, team);

-- 3. Ajustes manuais de dias (ícone de lápis) e de total da equipe ("Editar total")
CREATE TABLE IF NOT EXISTS public.recesso_adjustments (
    sequence BIGSERIAL PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL,
    team TEXT NOT NULL CHECK (team IN ('ivanize', 'claudenise')),
    scope TEXT NOT NULL CHECK (scope IN ('day', 'team')),
    date TEXT NOT NULL,
    cents BIGINT NOT NULL,
    expected BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recesso_adjustments_team_date
    ON public.recesso_adjustments(team, date);

-- 4. Fechamentos do Diário ("Zerar Diário da campanha")
CREATE TABLE IF NOT EXISTS public.recesso_resets (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recesso_resets_date
    ON public.recesso_resets(date);

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE public.recesso_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recesso_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recesso_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recesso_resets ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acesso (mesmo padrão das demais tabelas do placar)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.recesso_config;
CREATE POLICY "Enable all access for all users"
    ON public.recesso_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.recesso_entries;
CREATE POLICY "Enable all access for all users"
    ON public.recesso_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.recesso_adjustments;
CREATE POLICY "Enable all access for all users"
    ON public.recesso_adjustments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.recesso_resets;
CREATE POLICY "Enable all access for all users"
    ON public.recesso_resets FOR ALL USING (true) WITH CHECK (true);

