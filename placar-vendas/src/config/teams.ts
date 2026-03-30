// Configuramos a meta diária que irá acionar o evento de comemoração
export const DAILY_GOAL = 20000;

export type TeamName = "TROPA DE ELITE" | "AGUIAS";

export interface SellerConfig {
  name: string;
  team: TeamName;
  photoUrl: string;
}

export interface LeaderConfig {
  name: string;
  photoUrl: string;
}

// Configuração dos Líderes (GUSTAVO e CLAUDENISE)
export const LEADERS_CONFIG: Record<TeamName, LeaderConfig> = {
  "TROPA DE ELITE": {
    name: "GUSTAVO",
    photoUrl: "/img/Gustavo.png",
  },
  "AGUIAS": {
    name: "CLAUDENISE",
    photoUrl: "/img/Claudenise.png",
  },
};
