import Papa from "papaparse";
import { LEADERS_CONFIG } from "../config/teams";
import type { SellerConfig, TeamName, LeaderConfig } from "../config/teams";

const SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSkAYh7soArRp0zRAE9CvW89RGjIf9lAoX98vdZNge05j-nUw5XpkLohEHD9Zey2vLqF9sdaf7ZMQW7/pub?output=csv";

// Estrutura que compõe um Vendedor na UI
export interface RankedSeller extends SellerConfig {
  sales: number;
}

// Retorna os dados agrupados por equipes para facilitar o render
export interface TeamData {
  teamName: TeamName;
  leader: LeaderConfig;
  totalSales: number;
  sellers: RankedSeller[];
}

export interface DashboardData {
  teams: TeamData[];
  winningTeam: TeamName | null;
}

export async function fetchPlacarData(): Promise<DashboardData> {
  // Limpar cache forçando timestamp
  const url = `${SHEETS_CSV_URL}&_t=${new Date().getTime()}`;

  const response = await fetch(url);
  const csvText = await response.text();

  return new Promise((resolve) => {
    Papa.parse<{ "NOME DO VENDEDOR": string; "VALOR VENDIDO": string; "TIME": string }>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<{ "NOME DO VENDEDOR": string; "VALOR VENDIDO": string; "TIME": string }>) => {
        const rawData = results.data;

        // Construímos a lista de vendedores mapeando linha a linha
        const rankedSellers: RankedSeller[] = [];
        
        for (const row of rawData) {
          const name = row["NOME DO VENDEDOR"]?.trim();
          if (!name) continue;

          // Converter Valores Monetários
          let rawSales = row["VALOR VENDIDO"] || "0";
          rawSales = rawSales.replace(/[^0-9,-]+/g, ""); 
          rawSales = rawSales.replace(",", "."); 
          let sales = parseFloat(rawSales);
          if (isNaN(sales)) sales = 0;

          // Converter Time (1 = TROPA, 2 = AGUIAS)
          const timeCode = row["TIME"]?.toString().trim();
          let team: TeamName = "TROPA DE ELITE"; // default
          if (timeCode === "2") {
            team = "AGUIAS";
          } else if (timeCode === "1") {
            team = "TROPA DE ELITE";
          } else {
             // Caso venha escrito o nome do time diretamente ou esteja vazio
             if (timeCode?.toUpperCase().includes("AGUIA")) {
                team = "AGUIAS";
             }
          }

          // Busca a foto localmente baseado no nome do vendedor
          const safeNameUrl = encodeURIComponent(name);
          const photoUrl = `/img/${safeNameUrl}.jpg`;

          rankedSellers.push({
            name,
            team,
            sales,
            photoUrl
          });
        }

        // Ordenar do maior para o menor (Ranking)
        rankedSellers.sort((a, b) => b.sales - a.sales);

        // Agrupar por equipes
        const teams: TeamData[] = [
          groupTeam("TROPA DE ELITE", rankedSellers),
          groupTeam("AGUIAS", rankedSellers)
        ];

        // Definir time vencedor (caso o placar não esteja 0 a 0 e não seja empate rigoroso)
        let winningTeam: TeamName | null = null;
        if (teams[0].totalSales > teams[1].totalSales) winningTeam = teams[0].teamName;
        else if (teams[1].totalSales > teams[0].totalSales) winningTeam = teams[1].teamName;

        resolve({ teams, winningTeam });
      },
      error: () => {
        // Fallback caso dê erro no parsing
        resolve({ teams: [], winningTeam: null });
      }
    });
  });
}

function groupTeam(teamName: TeamName, allSellers: RankedSeller[]): TeamData {
  const sellers = allSellers.filter(s => s.team === teamName);
  const totalSales = sellers.reduce((sum, s) => sum + s.sales, 0);

  return {
    teamName,
    leader: LEADERS_CONFIG[teamName],
    totalSales,
    sellers
  };
}
