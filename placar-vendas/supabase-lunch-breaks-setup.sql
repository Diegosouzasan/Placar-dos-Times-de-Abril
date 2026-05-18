-- ============================================================
-- SCRIPT: Tabela de Intervalos de Lanche (Lunch Breaks)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Criar a tabela de intervalos de lanche
CREATE TABLE IF NOT EXISTS public.lunch_breaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,          -- NULL = timer ainda ativo
    duration_seconds INTEGER DEFAULT 0           -- calculado ao parar o timer
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.lunch_breaks ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir acesso total (ajuste conforme necessário para produção)
CREATE POLICY "Enable all access for all users"
ON public.lunch_breaks
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Índices para desempenho nas consultas de relatório
CREATE INDEX IF NOT EXISTS idx_lunch_breaks_seller_id ON public.lunch_breaks(seller_id);
CREATE INDEX IF NOT EXISTS idx_lunch_breaks_started_at ON public.lunch_breaks(started_at);
CREATE INDEX IF NOT EXISTS idx_lunch_breaks_ended_at ON public.lunch_breaks(ended_at);
