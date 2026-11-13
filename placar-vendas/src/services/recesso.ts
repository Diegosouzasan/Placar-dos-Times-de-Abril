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

export const recessoWeekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

export const shortRecessoDate = (iso: string) => iso.slice(8) + '/' + iso.slice(5, 7);

export function recessoHistoryWeeks(dates: string[]) {
  const weeks: string[][] = [];
  const weekday = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay();
  for (let start = 0; start < dates.length; start += recessoWeekdays.length) {
    const week = dates.slice(start, start + recessoWeekdays.length);
    weeks.push(week.sort((a, b) => weekday(a) - weekday(b)));
  }
  return weeks;
}

export function recessoDayCents(team: RecessoTeam, date: string, today: string) {
  return team.days[date] ?? (date <= today ? 0 : null);
}

export function recessoPeriodTotalCents(team: RecessoTeam) {
  return Object.values(team.days).reduce((total, dayCents) => total + dayCents, team.openingCents);
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

async function request(path: string, input?: unknown): Promise<RecessoSnapshot> {
  const response = await fetch('/api/recesso' + path, input === undefined
    ? { cache: 'no-store' }
    : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('O servidor da Meta Recesso está indisponível.')
  }
  if (!response.ok) {
    const failure = await response.json() as { error?: string }
    throw new Error(failure.error || 'Erro ao acessar a Meta Recesso.')
  }
  return response.json() as Promise<RecessoSnapshot>
}

export const getRecesso = () => request('')
export const saveRecessoConfig = (config: RecessoConfigPatch) => request('/config', config)
export const addRecessoEntry = (entry: RecessoEntryInput) => request('/entries', entry)
export const resetRecessoDay = (input: { date: string, requestId: string, occurredAt?: string }) => request('/reset-day', input)
export const setRecessoDayTotal = (input: RecessoTotalInput & {date: string}) => request('/day-total', input)
export const setRecessoTeamTotal = (input: RecessoTotalInput) => request('/team-total', input)

export function isRecessoDestination(
  snapshot: Pick<RecessoSnapshot, 'destinations'>, department: string, tvName: string,
): boolean {
  const mapping = snapshot.destinations
  return mapping[department + ':' + tvName] ?? mapping[department + ':*'] ?? false
}
