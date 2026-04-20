import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hxvlvxzsznuaduktzfjh.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Lh77569MWx0MSciPsgws4Q_gteGXkkD";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateSchema() {
    console.log("Iniciando atualização do esquema do banco de dados...");

    try {
        console.log("Verificando colunas da tabela sellers...");
        // Infelizmente pelo REST API não temos como adicionar colunas facilmente sem ser via SQL no dashboard
        // Mas podemos tentar verificar se as colunas já existem fazendo um select
        const { error } = await supabase.from("sellers").select("weekly_sales").limit(1);
        
        if (error && error.message.includes("column \"weekly_sales\" does not exist")) {
             console.error("ERRO: A coluna 'weekly_sales' não existe na tabela 'sellers'.");
             console.log("Por favor, execute o seguinte SQL no seu dashboard do Supabase:");
             console.log(`
                ALTER TABLE sellers ADD COLUMN weekly_sales NUMERIC DEFAULT 0;
                
                CREATE TABLE IF NOT EXISTS placar_settings (
                    id BIGINT PRIMARY KEY DEFAULT 1,
                    daily_goal NUMERIC DEFAULT 20000,
                    weekly_goal NUMERIC DEFAULT 100000,
                    is_meta_active BOOLEAN DEFAULT false,
                    meta_days TEXT DEFAULT 'Seg,Ter,Qua,Qui,Sex',
                    overlay_url TEXT,
                    is_overlay_active BOOLEAN DEFAULT false
                );

                INSERT INTO placar_settings (id, daily_goal, weekly_goal, is_meta_active, meta_days)
                VALUES (1, 20000, 100000, false, 'Seg,Ter,Qua,Qui,Sex')
                ON CONFLICT (id) DO NOTHING;
             `);
        } else {
            console.log("Coluna 'weekly_sales' já existe ou outro erro ocorreu:", error?.message || "Sucesso");
        }

    } catch (err) {
        console.error("Erro ao verificar esquema:", err);
    }
}

updateSchema();
