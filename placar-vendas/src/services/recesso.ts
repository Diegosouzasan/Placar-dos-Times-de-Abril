import { supabase } from './supabaseClient.ts'

export type RecessoTeamId = 'ivanize' | 'claudenise'

export interface RecessoMember {
  id: number
  name: string
  photoUrl: string
}

export interface RecessoSourceStatus {
  state: 'loading' | 'ok' | 'error'
  lastSuccessAt: string | null
  message: string | null
}

export interface RecessoTeamConfig {
  sourceTeamId: number | null
  sellerIds: number[]
  sellerCount: number
  openingCents: number
}

export interface RecessoTeam extends RecessoTeamConfig {
  id: RecessoTeamId
  name: string
  sourceTeamName: string
  members: RecessoMember[]
  leader: { name: string, photoUrl: string } | null
  soldCents: number
  dayCents: number
  weekCents: number
  dailyTargetCents: number
  weeklyTargetCents: number
  days: Record<string, number>
}

export interface RecessoSnapshot {
  revision: number
  today: string
  startDate: string
  endDate: string
  dates: string[]
  daysRemaining: number
  goalCents: number
  soldCents: number
  remainingCents: number
  dayCents: number
  weekCents: number
  sellerCount: number
  perSellerCents: number
  dailyTargetCents: number
  weeklyTargetCents: number
  teams: RecessoTeam[]
  sourceStatus: RecessoSourceStatus
  destinations: Record<string, boolean>
}

export const recessoWeekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

export const shortRecessoDate = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7)

export function recessoHistoryWeeks(dates: string[]) {
  const weeks = new Map<string, (string | null)[]>()
  for (const date of [...dates].sort()) {
    const noon = new Date(date + 'T12:00:00Z')
    const weekday = (noon.getUTCDay() + 6) % 7
    if (weekday > 4) continue
    noon.setUTCDate(noon.getUTCDate() - weekday)
    const monday = noon.toISOString().slice(0, 10)
    const week = weeks.get(monday) ?? Array<string | null>(5).fill(null)
    week[weekday] = date
    weeks.set(monday, week)
  }
  return [...weeks.values()]
}

export function recessoDayCents(team: RecessoTeam, date: string, today: string) {
  return team.days[date] ?? (date <= today ? 0 : null)
}

export function recessoPeriodTotalCents(team: RecessoTeam) {
  return Object.values(team.days).reduce((total, dayCents) => total + dayCents, team.openingCents)
}

export interface RecessoConfigPatch {
  revision: number
  destinations: Record<string, boolean>
}

export interface RecessoEntryInput {
  requestId: string
  date: string
  teamId: RecessoTeamId
  sellerId?: number
  amountCents: number
  paid?: boolean
}

export interface RecessoTotalInput {
  requestId: string
  teamId: RecessoTeamId
  amountCents: number
  expectedCents: number
}

// ============================================================
// Implementação direta via Supabase (compatível com Vercel)
// ============================================================

const teamIds: RecessoTeamId[] = ['ivanize', 'claudenise']
const teamDisplayNames: Record<RecessoTeamId, string> = {
  ivanize: 'Time Ivanize',
  claudenise: 'Time Claudenise',
}
const GOAL_CENTS = 1_200_000_000
const DEFAULT_START_DATE = '2026-11-13'
const END_DATE = '2026-12-18'
const CAMPAIGN_DAYS_OFF = new Set(['2026-11-20'])
const DAY_MS = 86_400_000

const saoPauloFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function saoPauloDate(instant: Date) {
  return saoPauloFormatter.format(instant)
}

function utcStamp(value: string) {
  const base = new Date(value).toISOString().slice(0, -1)
  const extra = (/\.(\d+)/.exec(value)?.[1] ?? '').slice(3, 6).padEnd(3, '0')
  return base + extra + 'Z'
}

function campaignWeekdays(start: string, end: string): string[] {
  const dates: string[] = []
  const lastInstant = Date.parse(end + 'T12:00:00Z')
  for (let instant = Date.parse(start + 'T12:00:00Z'); instant <= lastInstant; instant += DAY_MS) {
    const date = new Date(instant)
    const iso = date.toISOString().slice(0, 10)
    if (date.getUTCDay() % 6 !== 0) dates.push(iso)
  }
  return dates
}

function mondayOf(date: string): string {
  const noon = new Date(date + 'T12:00:00Z')
  return new Date(noon.getTime() - ((noon.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10)
}

function validDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(value + 'T12:00:00Z')
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function validAmount(value: number) {
  return Number.isSafeInteger(value) && Math.abs(value) <= 100_000_000_000_00
}

function handleSupabaseError(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.includes('recesso_')) {
    throw new Error('As tabelas da Meta Recesso ainda não foram criadas no Supabase. Execute o script supabase-recesso-setup.sql no SQL Editor.')
  }
  throw new Error(error?.message || fallback)
}

interface ConfigRow {
  id: number
  revision: number
  start_date: string
  destinations: Record<string, boolean> | null
  fixed_openings: Partial<Record<RecessoTeamId, number>> | null
}

interface EntryRow {
  id: string
  team: RecessoTeamId
  date: string
  cents: number | string
  seller: number | null
  paid: boolean | null
  created_at: string
}

interface AdjustmentRow {
  sequence: number
  request_id: string
  team: RecessoTeamId
  scope: 'day' | 'team'
  date: string
  cents: number | string
  expected: number | string
  created_at: string
}

interface ResetRow {
  id: string
  date: string
  created_at: string
}

interface InssTeamRow {
  id: number
  name: string
  leader_name: string | null
  leader_photo: string | null
}

interface InssSellerRow {
  id: number
  name: string
  team_id: number
  photo_url: string | null
}

interface InssSaleRow {
  id: string
  seller_id: number
  amount: number | string
  created_at: string
}

function findSupervisorTeam(teams: InssTeamRow[], supervisor: string): InssTeamRow | null {
  const matches = teams.filter(team =>
    (team.leader_name || '').toLocaleLowerCase('pt-BR').trim().split(/\s+/).includes(supervisor)
  )
  return matches.length === 1 ? matches[0] : null
}

async function readAllSalesHistory(sellerIds: number[], startDate: string, endDate: string): Promise<InssSaleRow[]> {
  if (sellerIds.length === 0) return []
  const all: InssSaleRow[] = []
  const pageSize = 1000
  const fromIso = `${startDate}T00:00:00-03:00`
  const toIso = `${endDate}T23:59:59.999999-03:00`
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('sales_history')
      .select('id,seller_id,amount,created_at')
      .in('seller_id', sellerIds)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const rows = (data || []) as InssSaleRow[]
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

async function ensureConfig(): Promise<ConfigRow> {
  const { data, error } = await supabase
    .from('recesso_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) handleSupabaseError(error, 'Falha ao ler configuração da Meta Recesso.')
  if (data) return data as ConfigRow

  const { data: inserted, error: insertError } = await supabase
    .from('recesso_config')
    .upsert({ id: 1, revision: 1, start_date: DEFAULT_START_DATE, destinations: {}, fixed_openings: {} }, { onConflict: 'id' })
    .select('*')
    .single()

  if (insertError) handleSupabaseError(insertError, 'Falha ao inicializar configuração da Meta Recesso.')
  return inserted as ConfigRow
}

export async function getRecesso(): Promise<RecessoSnapshot> {
  const today = saoPauloDate(new Date())
  const weekMonday = mondayOf(today)

  const [config, entriesRes, adjustmentsRes, resetsRes, teamsRes] = await Promise.all([
    ensureConfig(),
    supabase.from('recesso_entries').select('*').gte('date', DEFAULT_START_DATE).lte('date', END_DATE),
    supabase.from('recesso_adjustments').select('*').order('sequence', { ascending: true }),
    supabase.from('recesso_resets').select('*').eq('date', today).order('created_at', { ascending: false }).limit(1),
    supabase.from('teams').select('id,name,leader_name,leader_photo').eq('category', 'INSS').order('id', { ascending: true }),
  ])

  if (entriesRes.error) handleSupabaseError(entriesRes.error, 'Falha ao ler lançamentos da Meta Recesso.')
  if (adjustmentsRes.error) handleSupabaseError(adjustmentsRes.error, 'Falha ao ler ajustes da Meta Recesso.')
  if (resetsRes.error) handleSupabaseError(resetsRes.error, 'Falha ao ler fechamento diário da Meta Recesso.')

  const startDate = config.start_date || DEFAULT_START_DATE
  const dates = campaignWeekdays(startDate, END_DATE)
  const daysRemaining = dates.filter(date => date >= today && !CAMPAIGN_DAYS_OFF.has(date)).length
  const destinations = (config.destinations && typeof config.destinations === 'object') ? config.destinations : {}
  const fixedOpenings = (config.fixed_openings && typeof config.fixed_openings === 'object') ? config.fixed_openings : {}

  const manualEntries = (entriesRes.data || []) as EntryRow[]
  const adjustments = (adjustmentsRes.data || []) as AdjustmentRow[]
  const latestReset = (resetsRes.data?.[0] as ResetRow | undefined)
  const resetAt = latestReset ? utcStamp(latestReset.created_at) : ''

  // Read INSS teams, sellers and sales_history
  let sourceStatus: RecessoSourceStatus = { state: 'ok', lastSuccessAt: new Date().toISOString(), message: null }
  const roster: Record<RecessoTeamId, {
    name: string
    sourceTeamId: number | null
    sellerIds: number[]
    members: RecessoMember[]
    leader: { name: string, photoUrl: string } | null
  }> = {
    ivanize: { name: '', sourceTeamId: null, sellerIds: [], members: [], leader: null },
    claudenise: { name: '', sourceTeamId: null, sellerIds: [], members: [], leader: null },
  }
  const allEvents: { team: RecessoTeamId; date: string; cents: number; created_at: string }[] = []

  for (const entry of manualEntries) {
    allEvents.push({
      team: entry.team,
      date: entry.date,
      cents: Number(entry.cents),
      created_at: utcStamp(entry.created_at),
    })
  }

  try {
    if (teamsRes.error) throw teamsRes.error
    const inssTeams = (teamsRes.data || []) as InssTeamRow[]
    const ivanizeTeam = findSupervisorTeam(inssTeams, 'ivanize')
    const claudeniseTeam = findSupervisorTeam(inssTeams, 'claudenise')
    const matchedTeamIds = [ivanizeTeam?.id, claudeniseTeam?.id].filter((id): id is number => id != null)

    if (matchedTeamIds.length > 0) {
      const { data: sellersData, error: sellersError } = await supabase
        .from('sellers')
        .select('id,name,team_id,photo_url')
        .in('team_id', matchedTeamIds)
        .order('id', { ascending: true })
      if (sellersError) throw sellersError

      const sellers = (sellersData || []) as InssSellerRow[]
      const teamBySeller = new Map<number, RecessoTeamId>()

      const assignRoster = (key: RecessoTeamId, teamRow: InssTeamRow | null) => {
        if (!teamRow) return
        const members = sellers
          .filter(s => s.team_id === teamRow.id)
          .map(s => ({
            id: s.id,
            name: s.name.trim(),
            photoUrl: s.photo_url?.trim() || '',
          }))
        roster[key] = {
          name: teamRow.name,
          sourceTeamId: teamRow.id,
          sellerIds: members.map(m => m.id),
          members,
          leader: { name: (teamRow.leader_name || '').trim(), photoUrl: teamRow.leader_photo?.trim() || '' },
        }
        for (const m of members) teamBySeller.set(m.id, key)
      }

      assignRoster('ivanize', ivanizeTeam)
      assignRoster('claudenise', claudeniseTeam)

      const salesRows = await readAllSalesHistory([...teamBySeller.keys()], startDate, END_DATE)
      for (const row of salesRows) {
        const teamId = teamBySeller.get(row.seller_id)
        if (!teamId) continue
        const amountCents = Math.round(Number(row.amount) * 100)
        if (!Number.isSafeInteger(amountCents)) continue
        allEvents.push({
          team: teamId,
          date: saoPauloDate(new Date(row.created_at)),
          cents: amountCents,
          created_at: utcStamp(row.created_at),
        })
      }
    }
  } catch (err) {
    sourceStatus = {
      state: 'error',
      lastSuccessAt: null,
      message: err instanceof Error ? err.message : 'A origem INSS não respondeu.',
    }
  }

  const teams: RecessoTeam[] = teamIds.map(id => {
    const source = roster[id]
    const team: RecessoTeam = {
      id,
      name: teamDisplayNames[id],
      sourceTeamName: source.name,
      sourceTeamId: source.sourceTeamId,
      sellerIds: source.sellerIds,
      sellerCount: source.sellerIds.length,
      members: source.members,
      leader: source.leader,
      openingCents: 0,
      soldCents: 0,
      dayCents: 0,
      weekCents: 0,
      dailyTargetCents: 0,
      weeklyTargetCents: 0,
      days: {},
    }

    const teamAdjustments = adjustments
      .filter(row => row.team === id)
      .map(row => ({ ...row, cents: Number(row.cents), created_at: utcStamp(row.created_at) }))
    const anchor = teamAdjustments.filter(row => row.scope === 'team').at(-1)
    const fixedOpening = fixedOpenings[id] != null ? Number(fixedOpenings[id]) : null
    let attributedAtAnchor = 0

    for (const date of dates) {
      const events = allEvents.filter(row => row.team === id && row.date === date)
      const edits = teamAdjustments.filter(row => row.scope === 'day' && row.date === date)
      if (!events.length && !edits.length) continue

      const valueAt = (through: string) => {
        const edit = edits.filter(row => row.created_at <= through).at(-1)
        return events.reduce((sum, event) => {
          const at = event.created_at
          return at <= through && (!edit || at > edit.created_at) ? sum + event.cents : sum
        }, edit ? edit.cents : 0)
      }

      const total = valueAt('9999')
      team.days[date] = total
      if (date > today) continue

      team.soldCents += total
      if (date >= weekMonday) team.weekCents += total
      if (date === today) team.dayCents = Math.max(0, total - (resetAt ? valueAt(resetAt) : 0))
      if (anchor && date <= anchor.date) {
        const newlyRecorded = events.reduce(
          (sum, e) => (e.created_at > anchor.created_at ? sum + e.cents : sum),
          0
        )
        attributedAtAnchor += Math.max(0, total - newlyRecorded)
      }
    }

    if (fixedOpening !== null) {
      team.openingCents = fixedOpening
      team.soldCents += fixedOpening
    } else if (anchor) {
      team.openingCents = Math.max(0, anchor.cents - attributedAtAnchor)
      team.soldCents += team.openingCents
    }

    return team
  })

  const soldCents = teams.reduce((sum, t) => sum + t.soldCents, 0)
  const sellerCount = teams.reduce((sum, t) => sum + t.sellerCount, 0)
  const remainingCents = Math.max(0, GOAL_CENTS - soldCents)
  const dailyTargetCents = daysRemaining ? Math.round(remainingCents / daysRemaining) : 0

  if (sellerCount) {
    const leftShare = Math.round((dailyTargetCents * teams[0].sellerCount) / sellerCount)
    teams[0].dailyTargetCents = leftShare
    teams[1].dailyTargetCents = dailyTargetCents - leftShare
    for (const team of teams) team.weeklyTargetCents = team.dailyTargetCents * 5
  }

  return {
    revision: config.revision,
    today,
    startDate,
    endDate: END_DATE,
    dates,
    goalCents: GOAL_CENTS,
    soldCents,
    remainingCents,
    daysRemaining,
    sellerCount,
    dailyTargetCents,
    perSellerCents: sellerCount ? Math.round(dailyTargetCents / sellerCount) : 0,
    weeklyTargetCents: dailyTargetCents * 5,
    dayCents: teams[0].dayCents + teams[1].dayCents,
    weekCents: teams[0].weekCents + teams[1].weekCents,
    teams,
    destinations,
    sourceStatus,
  }
}

export async function saveRecessoConfig(patch: RecessoConfigPatch): Promise<RecessoSnapshot> {
  const current = await ensureConfig()
  if (patch.revision !== current.revision) {
    throw new Error('A configuração mudou. Atualize o painel e tente novamente.')
  }
  const nextDestinations: Record<string, boolean> = {
    ...(current.destinations || {}),
    ...patch.destinations,
  }
  const { data, error } = await supabase
    .from('recesso_config')
    .update({
      revision: current.revision + 1,
      destinations: nextDestinations,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .eq('revision', patch.revision)
    .select('id')
    .maybeSingle()

  if (error) handleSupabaseError(error, 'Falha ao salvar configuração.')
  if (!data) throw new Error('A configuração mudou. Atualize o painel e tente novamente.')
  return getRecesso()
}

export async function addRecessoEntry(entry: RecessoEntryInput): Promise<RecessoSnapshot> {
  if (!teamIds.includes(entry.teamId) || !validDate(entry.date) || !validAmount(entry.amountCents) || entry.amountCents === 0) {
    throw new Error('Informe uma data e um valor válido.')
  }
  const key = 'manual:' + entry.requestId
  const { data: existing, error: findError } = await supabase
    .from('recesso_entries')
    .select('*')
    .eq('id', key)
    .maybeSingle()

  if (findError) handleSupabaseError(findError, 'Falha ao verificar lançamento.')
  if (existing) return getRecesso()

  const snapshot = await getRecesso()
  if (!snapshot.dates.includes(entry.date)) {
    throw new Error('Data fora dos dias de campanha.')
  }
  const team = snapshot.teams.find(t => t.id === entry.teamId)!
  if ((team.days[entry.date] ?? 0) + entry.amountCents < 0) {
    throw new Error('A correção tornaria negativo o valor desse dia.')
  }
  if (entry.date <= snapshot.today && team.soldCents + entry.amountCents < 0) {
    throw new Error('A correção tornaria negativo o total da equipe.')
  }

  const { error: insertError } = await supabase.from('recesso_entries').insert({
    id: key,
    team: entry.teamId,
    date: entry.date,
    cents: entry.amountCents,
    seller: entry.sellerId ?? null,
    paid: entry.paid ?? null,
    created_at: new Date().toISOString(),
  })
  if (insertError) handleSupabaseError(insertError, 'Falha ao adicionar lançamento.')
  return getRecesso()
}

export async function resetRecessoDay(input: { date: string; requestId: string; occurredAt?: string }): Promise<RecessoSnapshot> {
  if (!validDate(input.date)) {
    throw new Error('Dados do encerramento diário inválidos.')
  }
  const { data: existing, error: findError } = await supabase
    .from('recesso_resets')
    .select('id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (findError) handleSupabaseError(findError, 'Falha ao verificar fechamento diário.')
  if (existing) return getRecesso()

  const { error: insertError } = await supabase.from('recesso_resets').insert({
    id: input.requestId,
    date: input.date,
    created_at: input.occurredAt || new Date().toISOString(),
  })
  if (insertError) handleSupabaseError(insertError, 'Falha ao zerar o Diário da campanha.')
  return getRecesso()
}

async function setTotal(input: RecessoTotalInput & { date?: string }, scope: 'team' | 'day'): Promise<RecessoSnapshot> {
  if (!teamIds.includes(input.teamId) || !validAmount(input.amountCents) || input.amountCents < 0 || !validAmount(input.expectedCents)) {
    throw new Error('Informe um total válido.')
  }

  const { data: existing, error: findError } = await supabase
    .from('recesso_adjustments')
    .select('*')
    .eq('request_id', input.requestId)
    .maybeSingle()

  if (findError) handleSupabaseError(findError, 'Falha ao verificar ajuste.')
  if (existing) return getRecesso()

  const snapshot = await getRecesso()
  const date = scope === 'team' ? snapshot.today : input.date
  if (!date || !validDate(date)) throw new Error('Data inválida.')

  if (scope === 'day') {
    if (!snapshot.dates.includes(date)) throw new Error('Escolha um dos dias da campanha.')
    if (date > snapshot.today) throw new Error('Só é possível editar dias anteriores ou o dia atual.')
  }

  const team = snapshot.teams.find(t => t.id === input.teamId)!
  const current = scope === 'day' ? (team.days[date] ?? 0) : team.soldCents
  if (current !== input.expectedCents) {
    throw new Error('O valor mudou desde a última leitura. Atualize e confira o total.')
  }
  if (scope === 'team' && input.amountCents < team.soldCents - team.openingCents) {
    throw new Error('O total não pode ser menor que as células já preenchidas. Corrija o histórico primeiro.')
  }

  const config = await ensureConfig()
  const nextFixedOpenings: Partial<Record<RecessoTeamId, number>> = {
    ...(config.fixed_openings || {}),
    [input.teamId]: scope === 'team'
      ? input.amountCents - (team.soldCents - team.openingCents)
      : team.openingCents,
  }

  const { error: cfgError } = await supabase
    .from('recesso_config')
    .update({
      fixed_openings: nextFixedOpenings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (cfgError) handleSupabaseError(cfgError, 'Falha ao preservar saldo da equipe.')

  const { error: insertError } = await supabase.from('recesso_adjustments').insert({
    request_id: input.requestId,
    team: input.teamId,
    scope,
    date,
    cents: input.amountCents,
    expected: input.expectedCents,
    created_at: new Date().toISOString(),
  })
  if (insertError) handleSupabaseError(insertError, 'Falha ao salvar o ajuste.')

  return getRecesso()
}

export const setRecessoDayTotal = (input: RecessoTotalInput & { date: string }) => setTotal(input, 'day')
export const setRecessoTeamTotal = (input: RecessoTotalInput) => setTotal(input, 'team')

export function isRecessoDestination(
  snapshot: Pick<RecessoSnapshot, 'destinations'>,
  department: string,
  tvName: string,
): boolean {
  const mapping = snapshot.destinations
  return mapping[department + ':' + tvName] ?? mapping[department + ':*'] ?? false
}
