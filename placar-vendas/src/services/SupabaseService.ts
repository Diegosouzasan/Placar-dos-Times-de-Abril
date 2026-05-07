import { supabase } from "./supabaseClient";
import type { TeamName } from "../config/teams";

export interface RankedSeller {
  id: number;
  name: string;
  team: TeamName;
  sales: number;
  weeklySales: number;
  photoUrl: string;
  dailyGoal?: number; // Meta individual opcional
}

export interface TeamData {
  id: number;
  teamName: string;
  category: string;
  leader: {
    name: string;
    photoUrl: string;
  };
  totalSales: number;
  isManualMode: boolean;
  manualTotal: number;
  dailyGoal: number;
  weeklyGoal: number;
  sellers: RankedSeller[];
}

export interface DashboardData {
  teams: TeamData[];
  winningTeam: TeamName | null;
  settings?: PlacarSettings;
}

export interface PlacarSettings {
  id: number;
  daily_goal: number;
  weekly_goal: number;
  is_meta_active: boolean;
  meta_days: string;
  overlay_url: string;
  is_overlay_active: boolean;
}

export async function fetchPlacarData(category: string): Promise<DashboardData> {
  // 1. Fetch Teams for this category
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .eq("category", category)
    .order("id", { ascending: true });

  if (teamsError) throw teamsError;

  // 2. Fetch Sellers
  const { data: sellersData, error: sellersError } = await supabase
    .from("sellers")
    .select("*")
    .order("total_sales", { ascending: false });

  if (sellersError) throw sellersError;

  // 3. Fetch Settings for this category
  const { data: settingsData } = await supabase
    .from("placar_settings")
    .select("*")
    .eq("category", category)
    .single();

  // Parse overlay data once to use for teams and sellers
  let overlayData: any = {};
  try {
    if (settingsData?.overlay_url?.startsWith('{')) {
      overlayData = JSON.parse(settingsData.overlay_url);
    }
  } catch (e) {
    console.error("Error parsing overlay_url", e);
  }

  // 4. Assemble Dashboard Data
  const teams: TeamData[] = teamsData.map((t: any) => {
    const teamSellers = sellersData
      .filter((s: any) => s.team_id === t.id)
      .map((s: any) => {
        // Parse individual seller goal
        const individualGoal = overlayData.sellerGoals?.[s.id];
        
        return {
          id: s.id,
          name: s.name,
          team: t.name as TeamName,
          sales: Number(s.total_sales),
          weeklySales: Number(s.weekly_sales || 0),
          photoUrl: s.photo_url || `/img/${encodeURIComponent(s.name.split(" ")[0])}.png`,
          dailyGoal: individualGoal ? Number(individualGoal) : undefined
        };
      });

    const individualTotal = teamSellers.reduce((sum, s) => sum + s.sales, 0);
    const totalSales = t.is_manual_mode ? Number(t.manual_total) : individualTotal;

    // Parse team goals from overlay_url
    let teamDailyGoal = settingsData?.daily_goal || 20000;
    let teamWeeklyGoal = settingsData?.weekly_goal || 100000;
    
    if (overlayData.teamGoals?.[t.id]) {
      teamDailyGoal = overlayData.teamGoals[t.id].daily || teamDailyGoal;
      teamWeeklyGoal = overlayData.teamGoals[t.id].weekly || teamWeeklyGoal;
    }

    return {
      id: t.id,
      teamName: t.name,
      category: t.category,
      leader: {
        name: t.leader_name,
        photoUrl: t.leader_photo
      },
      totalSales,
      isManualMode: t.is_manual_mode,
      manualTotal: Number(t.manual_total),
      dailyGoal: teamDailyGoal,
      weeklyGoal: teamWeeklyGoal,
      sellers: teamSellers
    };
  });

  // Calculate winning team
  let winningTeam: TeamName | null = null;
  if (teams.length >= 2) {
    if (teams[0].totalSales > teams[1].totalSales) winningTeam = teams[0].teamName as TeamName;
    else if (teams[1].totalSales > teams[0].totalSales) winningTeam = teams[1].teamName as TeamName;
  }

  return { teams, winningTeam, settings: settingsData };
}

// Settings and Meta Actions
export async function updateSettings(category: string, settings: Partial<PlacarSettings>) {
  const { error } = await supabase
    .from("placar_settings")
    .update(settings)
    .eq("category", category);
  if (error) throw error;
}

export async function updateTeam(teamId: number, data: { name?: string, leader_name?: string, leader_photo?: string }) {
  const { error } = await supabase
    .from("teams")
    .update(data)
    .eq("id", teamId);
  if (error) throw error;
}

export async function finalizeWeeklyMeta(category: string) {
  // 1. Get teams of this category
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("category", category);
  
  const teamIds = teams?.map(t => t.id) || [];

  if (teamIds.length > 0) {
    // 2. Reset all weekly_sales and total_sales for these teams
    const { error } = await supabase
      .from("sellers")
      .update({ 
        total_sales: 0,
        weekly_sales: 0 
      })
      .in("team_id", teamIds);
    
    if (error) throw error;
  }

  // 3. Deactivate meta for this category
  await updateSettings(category, { is_meta_active: false });
}

export async function resetDailySales(category: string) {
  // 1. Get teams of this category
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("category", category);
  
  const teamIds = teams?.map(t => t.id) || [];

  if (teamIds.length > 0) {
    // 2. Reset ONLY total_sales to 0 for these teams
    const { error } = await supabase
      .from("sellers")
      .update({ 
        total_sales: 0
      })
      .in("team_id", teamIds);
    
    if (error) throw error;
  }
}

// Control Actions
export async function updateSellerSales(sellerId: number, newDaySales: number) {
  // To handle the weekly accumulation, we first need the current values
  const { data: seller, error: fetchError } = await supabase
    .from("sellers")
    .select("total_sales, weekly_sales")
    .eq("id", sellerId)
    .single();

  if (fetchError) throw fetchError;

  const currentDaySales = Number(seller.total_sales || 0);
  const currentWeeklySales = Number(seller.weekly_sales || 0);

  // The difference between the new input and the current day sales 
  // is what should be added/subtracted from the weekly total.
  const diff = newDaySales - currentDaySales;
  const newWeeklySales = currentWeeklySales + diff;

  const { error } = await supabase
    .from("sellers")
    .update({ 
      total_sales: newDaySales, 
      weekly_sales: Math.max(0, newWeeklySales) 
    })
    .eq("id", sellerId);

  if (error) throw error;

  // Insert to sales_history if there is a difference
  if (diff !== 0) {
    await supabase.from("sales_history").insert({
      seller_id: sellerId,
      amount: diff,
      created_at: new Date().toISOString()
    });
  }
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
      total_sales: 0,
      weekly_sales: 0
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

export async function uploadFile(file: File, path: string, bucket: string = "media") {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Relatórios
export async function fetchSalesHistory(startDate?: string, endDate?: string) {
  let query = supabase
    .from("sales_history")
    .select("*")
    .order('created_at', { ascending: false });

  if (startDate) {
    query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
  }
    
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function resetSalesHistory() {
  const { error } = await supabase
    .from("sales_history")
    .delete()
    .neq("id", 0); // Delete all
  if (error) throw error;
}

export async function fetchAllMetadata() {
  const { data: teams } = await supabase.from("teams").select("*");
  const { data: sellers } = await supabase.from("sellers").select("*");
  return { teams: teams || [], sellers: sellers || [] };
}
