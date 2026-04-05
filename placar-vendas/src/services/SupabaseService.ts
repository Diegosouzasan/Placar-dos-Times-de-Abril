import { supabase } from "./supabaseClient";
import type { TeamName } from "../config/teams";

export interface RankedSeller {
  id: number;
  name: string;
  team: TeamName;
  sales: number;
  photoUrl: string;
}

export interface TeamData {
  id: number;
  teamName: TeamName;
  leader: {
    name: string;
    photoUrl: string;
  };
  totalSales: number;
  isManualMode: boolean;
  manualTotal: number;
  sellers: RankedSeller[];
}

export interface DashboardData {
  teams: TeamData[];
  winningTeam: TeamName | null;
}

export async function fetchPlacarData(): Promise<DashboardData> {
  // 1. Fetch Teams
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .order("id", { ascending: true });

  if (teamsError) throw teamsError;

  // 2. Fetch Sellers
  const { data: sellersData, error: sellersError } = await supabase
    .from("sellers")
    .select("*")
    .order("total_sales", { ascending: false });

  if (sellersError) throw sellersError;

  // 3. Assemble Dashboard Data
  const teams: TeamData[] = teamsData.map((t: any) => {
    const teamSellers = sellersData
      .filter((s: any) => s.team_id === t.id)
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        team: t.name as TeamName,
        sales: Number(s.total_sales),
        photoUrl: s.photo_url || `/img/${encodeURIComponent(s.name.split(" ")[0])}.png`
      }));

    const individualTotal = teamSellers.reduce((sum, s) => sum + s.sales, 0);
    const totalSales = t.is_manual_mode ? Number(t.manual_total) : individualTotal;

    return {
      id: t.id,
      teamName: t.name as TeamName,
      leader: {
        name: t.leader_name,
        photoUrl: t.leader_photo
      },
      totalSales,
      isManualMode: t.is_manual_mode,
      manualTotal: Number(t.manual_total),
      sellers: teamSellers
    };
  });

  // Calculate winning team
  let winningTeam: TeamName | null = null;
  if (teams.length >= 2) {
    if (teams[0].totalSales > teams[1].totalSales) winningTeam = teams[0].teamName;
    else if (teams[1].totalSales > teams[0].totalSales) winningTeam = teams[1].teamName;
  }

  return { teams, winningTeam };
}

// Control Actions
export async function updateSellerSales(sellerId: number, sales: number) {
  const { error } = await supabase
    .from("sellers")
    .update({ total_sales: sales })
    .eq("id", sellerId);
  if (error) throw error;
}

export async function toggleTeamMode(teamId: number, isManual: boolean, manualTotal: number) {
  const { error } = await supabase
    .from("teams")
    .update({ 
      is_manual_mode: isManual,
      manual_total: manualTotal 
    })
    .eq("id", teamId);
  if (error) throw error;
}

export async function addSeller(name: string, teamId: number, photoUrl?: string) {
  const { error } = await supabase
    .from("sellers")
    .insert([{ 
      name, 
      team_id: teamId, 
      photo_url: photoUrl || `/img/${encodeURIComponent(name.split(" ")[0])}.png`,
      total_sales: 0 
    }]);
  if (error) throw error;
}

export async function deleteSeller(sellerId: number) {
  const { error } = await supabase
    .from("sellers")
    .delete()
    .eq("id", sellerId);
  if (error) throw error;
}

export async function moveSeller(sellerId: number, newTeamId: number) {
  const { error } = await supabase
    .from("sellers")
    .update({ team_id: newTeamId })
    .eq("id", sellerId);
  if (error) throw error;
}
