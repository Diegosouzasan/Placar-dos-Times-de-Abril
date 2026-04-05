import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";

const SUPABASE_URL = "https://hxvlvxzsznuaduktzfjh.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_Lh77569MWx0MSciPsgws4Q_gteGXkkD";
const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkAYh7soArRp0zRAE9CvW89RGjIf9lAoX98vdZNge05j-nUw5XpkLohEHD9Zey2vLqF9sdaf7ZMQW7/pub?output=csv";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function migrate() {
    console.log("Iniciando migração dos vendedores...");

    try {
        // 1. Buscar CSV
        const response = await fetch(SHEETS_CSV_URL);
        const csvText = await response.text();

        // 2. Parsear CSV
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });

        const rawData = results.data as any[];
        console.log(`Encontrados ${rawData.length} registros no CSV.`);

        // 3. Obter IDs dos times do Supabase
        const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name");
        if (teamsError) throw teamsError;

        const teamMap: Record<string, number> = {};
        teams.forEach(t => teamMap[t.name] = t.id);

        // 4. Limpar vendedores atuais (opcional, mas evita duplicados de teste)
        console.log("Limpando vendedores atuais...");
        await supabase.from("sellers").delete().neq("id", 0);

        // 5. Preparar e Inserir
        const sellersToInsert = [];
        for (const row of rawData) {
            const name = row["NOME DO VENDEDOR"]?.trim();
            if (!name) continue;

            // Converter Valor
            let rawSales = row["VALOR VENDIDO"] || "0";
            rawSales = rawSales.replace(/[^0-9,-]+/g, "").replace(",", ".");
            const sales = parseFloat(rawSales) || 0;

            // Mapear Time
            const timeCode = row["TIME"]?.toString().trim();
            let teamId = teamMap["TROPA DE ELITE"]; // Default
            if (timeCode === "2" || (typeof timeCode === 'string' && timeCode.toUpperCase().includes("AGUIA"))) {
                teamId = teamMap["AGUIAS"];
            }

            sellersToInsert.push({
                name,
                team_id: teamId,
                total_sales: sales,
                photo_url: `/img/${encodeURIComponent(name)}.jpg`
            });
        }

        console.log(`Inserindo ${sellersToInsert.length} vendedores...`);
        const { error: insertError } = await supabase.from("sellers").insert(sellersToInsert);
        
        if (insertError) throw insertError;

        console.log("Migração concluída com sucesso!");
    } catch (err) {
        console.error("Erro na migração:", err);
    }
}

migrate();
