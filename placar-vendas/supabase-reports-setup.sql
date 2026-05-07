-- Execute este script no SQL Editor do Supabase

-- 1. Criar a tabela de histórico de vendas
CREATE TABLE IF NOT EXISTS public.sales_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir acesso total (ajuste conforme necessário para produção)
CREATE POLICY "Enable all access for all users" 
ON public.sales_history 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Opcional: Criar índices para melhorar o desempenho das consultas do relatório
CREATE INDEX IF NOT EXISTS idx_sales_history_seller_id ON public.sales_history(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_created_at ON public.sales_history(created_at);
