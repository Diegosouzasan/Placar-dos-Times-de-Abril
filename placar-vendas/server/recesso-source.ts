import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/services/supabaseConfig.ts'
import type { RecessoTeamId } from '../src/services/recesso'
import type { RecessoSourcePayload } from './recesso-store'

interface InssTeam {
  id: number
  name: string
  leader_name: string
  leader_photo: string | null
}

interface InssSeller {
  id: number
  name: string
  team_id: number
  photo_url: string | null
}

interface RecessoSourceStore {
  getSnapshot(): { startDate: string; endDate: string }
  applySource(source: RecessoSourcePayload): void
}

interface InssSale {
  id: string
  seller_id: number
  amount: number | string
  created_at: string
}

const saoPaulo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

async function readRows<T>(table: string, query: Record<string, string>): Promise<T[]> {
  const url = new URL('/rest/v1/' + table, SUPABASE_URL)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('Consulta INSS indisponível (' + response.status + ').')
  return response.json() as Promise<T[]>
}

function findTeam(teams: InssTeam[], supervisor: string): InssTeam {
  const matches = teams.filter(team => (team.leader_name || '').toLocaleLowerCase('pt-BR')
    .trim().split(/\s+/).includes(supervisor))
  if (matches.length !== 1) throw new Error('Confira o vínculo de ' + supervisor + ' no cadastro INSS.')
  return matches[0]
}

function rosterFrom(team: InssTeam, sellers: InssSeller[]): RecessoSourcePayload['roster'][RecessoTeamId] {
  const members = sellers.filter(seller => seller.team_id === team.id).map(seller => ({
    id: seller.id,
    name: seller.name.trim(),
    photoUrl: seller.photo_url?.trim() || '',
  }))
  return {
    name: team.name,
    sourceTeamId: team.id,
    sellerIds: members.map(member => member.id),
    leader: { name: team.leader_name.trim(), photoUrl: team.leader_photo?.trim() || '' },
    members,
  }
}

export async function syncRecessoSource(store: RecessoSourceStore): Promise<void> {
  const teams = await readRows<InssTeam>('teams', {
    select: 'id,name,leader_name,leader_photo', category: 'eq.INSS', order: 'id.asc',
  })
  const ivanize = findTeam(teams, 'ivanize')
  const claudenise = findTeam(teams, 'claudenise')
  const sellers = await readRows<InssSeller>('sellers', {
    select: 'id,name,team_id,photo_url',
    team_id: 'in.(' + [ivanize.id, claudenise.id].join(',') + ')',
    order: 'id.asc',
  })
  const roster = { ivanize: rosterFrom(ivanize, sellers), claudenise: rosterFrom(claudenise, sellers) }
  const teamBySeller = new Map<number, RecessoTeamId>()
  for (const id of ['ivanize', 'claudenise'] as const) {
    for (const sellerId of roster[id].sellerIds) teamBySeller.set(sellerId, id)
  }
  const { startDate, endDate } = store.getSnapshot()
  const events: RecessoSourcePayload['events'] = []
  const pageSize = 500
  if (teamBySeller.size > 0) {
    for (let offset = 0; ; offset += pageSize) {
      const rows = await readRows<InssSale>('sales_history', {
        select: 'id,created_at,amount,seller_id',
        seller_id: 'in.(' + [...teamBySeller.keys()].join(',') + ')',
        and: '(created_at.gte.' + startDate + 'T00:00:00-03:00,created_at.lte.' + endDate + 'T23:59:59.999999-03:00)',
        order: 'created_at.asc,id.asc', offset: String(offset), limit: String(pageSize),
      })
      for (const row of rows) {
        const teamId = teamBySeller.get(row.seller_id)
        const date = saoPaulo.format(new Date(row.created_at))
        const amountCents = Math.round(Number(row.amount) * 100)
        if (!teamId || !Number.isSafeInteger(amountCents)) throw new Error('Lançamento INSS inválido.')
        events.push({ id: String(row.id), sellerId: row.seller_id, date, createdAt: row.created_at, teamId, amountCents })
      }
      if (rows.length < pageSize) break
    }
  }
  store.applySource({ roster, events })
}
