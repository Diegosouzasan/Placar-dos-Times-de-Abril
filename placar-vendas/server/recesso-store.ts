import { DatabaseSync } from 'node:sqlite'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import type {
  RecessoConfigPatch, RecessoEntryInput, RecessoMember, RecessoSnapshot,
  RecessoSourceStatus, RecessoTeam, RecessoTeamConfig, RecessoTeamId, RecessoTotalInput,
} from '../src/services/recesso.ts'

const ids: RecessoTeamId[] = ['ivanize', 'claudenise']
const names = { ivanize: 'Time Ivanize', claudenise: 'Time Claudenise' }
const goalCents = 1_200_000_000
const firstDate = '2026-11-13'
const endDate = '2026-12-18'
const campaignDaysOff = new Set(['2026-11-20'])
const dayMs = 86_400_000
const calendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})
export const saoPauloDate = (instant: Date) => calendar.format(instant)

interface Roster {
  name: string
  sellerIds: number[]
  sourceTeamId: number
  leader: { name: string, photoUrl: string }
  members: RecessoMember[]
}
export interface RecessoSourcePayload {
  roster: Record<RecessoTeamId, Roster>
  events: {
    id: string, date: string, teamId: RecessoTeamId, sellerId: number,
    amountCents: number, createdAt: string,
  }[]
}

interface Config {
  revision: number
  startDate: string
  teams: Record<RecessoTeamId, RecessoTeamConfig>
  destinations: Record<string, boolean>
}

export class RecessoError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RecessoError(message)
}

function validDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(value + 'T12:00:00Z')
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

function validAmount(value: number) {
  return Number.isSafeInteger(value) && Math.abs(value) <= 100_000_000_000_00
}

function requestIdValid(id: string) {
  return typeof id === 'string' && /^[\w-]{1,120}$/.test(id)
}

// Canonical UTC timestamp with six fractional digits, including Supabase's microseconds.
function utcStamp(value: string) {
  const base = new Date(value).toISOString().slice(0, -1)
  const extra = (/\.(\d+)/.exec(value)?.[1] ?? '').slice(3, 6).padEnd(3, '0')
  return base + extra + 'Z'
}

function businessDates(start: string, end: string): string[] {
  const dates: string[] = []
  const lastInstant = Date.parse(end + 'T12:00:00Z')
  for (let instant = Date.parse(start + 'T12:00:00Z'); instant <= lastInstant; instant += dayMs) {
    const date = new Date(instant)
    const iso = date.toISOString().slice(0, 10)
    if (date.getUTCDay() % 6 !== 0) dates.push(iso)
  }
  return dates
}

function mondayOf(date: string): string {
  const noon = new Date(date + 'T12:00:00Z')
  return new Date(noon.getTime() - (noon.getUTCDay() + 6) % 7 * dayMs).toISOString().slice(0, 10)
}

function emptyTeam(): RecessoTeamConfig {
  return { openingCents: 0, sellerCount: 0, sellerIds: [], sourceTeamId: null }
}

export function createRecessoStore(file: string, clock: () => Date = () => new Date()) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, team TEXT NOT NULL, date TEXT NOT NULL,
      cents INTEGER NOT NULL, seller INTEGER, paid INTEGER, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entries_date ON entries(date,team);
    CREATE TABLE IF NOT EXISTS resets (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS adjustments (
      sequence INTEGER PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
      team TEXT NOT NULL, scope TEXT NOT NULL, date TEXT NOT NULL,
      cents INTEGER NOT NULL, expected INTEGER NOT NULL, created_at TEXT NOT NULL
    );
  `)
  const configDefault: Config = {
    revision: 1, startDate: firstDate,
    teams: { ivanize: emptyTeam(), claudenise: emptyTeam() }, destinations: {},
  }
  db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('config', JSON.stringify(configDefault))

  function read<T>(key: string, fallback: T): T {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
    return row ? JSON.parse(String(row.value)) as T : fallback
  }
  function write(key: string, value: unknown) {
    db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value))
  }
  function nextStamp() {
    const at = clock().getTime() * 1000
    const micros = Math.max(at, read('lastMicros', 0) + 1)
    write('lastMicros', micros)
    return new Date(Math.floor(micros / 1000)).toISOString().slice(0, -1) + String(micros % 1000).padStart(3, '0') + 'Z'
  }
  function transaction(action: () => void) {
    db.exec('BEGIN IMMEDIATE')
    try {
      action()
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  let syncState: RecessoSourceStatus['state'] = 'loading'
  let syncMessage: string | null = null

  function getSnapshot(): RecessoSnapshot {
    const config = read('config', configDefault)
    const dates = businessDates(config.startDate, endDate)
    const today = saoPauloDate(clock())
    const weekMonday = mondayOf(today)
    const daysRemaining = dates.filter(date => date >= today && !campaignDaysOff.has(date)).length
    const roster = read<Partial<RecessoSourcePayload['roster']>>('roster', {})
    const rows = db.prepare(`
      SELECT team,date,cents,created_at FROM entries WHERE date BETWEEN ? AND ?
    `).all(dates[0], endDate)
    const adjustments = db.prepare('SELECT * FROM adjustments ORDER BY sequence').all()
    const resetAt = String(db.prepare('SELECT MAX(created_at) AS at FROM resets WHERE date=?').get(today)?.at ?? '')
    const teams: RecessoTeam[] = ids.map(id => {
      const source = roster[id]
      const cfg = config.teams[id]
      const team: RecessoTeam = {
        ...cfg, id, name: names[id], sourceTeamName: source?.name ?? '',
        members: source?.members ?? [], leader: source?.leader ?? null,
        sourceTeamId: source?.sourceTeamId ?? cfg.sourceTeamId,
        sellerIds: source?.sellerIds ?? cfg.sellerIds,
        sellerCount: source?.sellerIds.length ?? cfg.sellerCount,
        soldCents: cfg.openingCents, dayCents: 0, weekCents: 0,
        dailyTargetCents: 0, weeklyTargetCents: 0, days: {},
      }
      const teamAdjustments = adjustments.filter(row => row.team === id)
      const anchor = teamAdjustments.filter(row => row.scope === 'team').at(-1)
      const fixedOpening = read<number | null>('fixedOpening:' + id, null)
      let attributedAtAnchor = 0
      for (const date of dates) {
        const events = rows.filter(row => row.team === id && row.date === date)
        const edits = teamAdjustments.filter(row => row.scope === 'day' && row.date === date)
        if (!events.length && !edits.length) continue
        // An absolute cell includes upstream sales made through its edit timestamp,
        // even when a previously disconnected source delivers those rows later.
        const valueAt = (through: string) => {
          const edit = edits.filter(row => String(row.created_at) <= through).at(-1)
          return events.reduce((sum, event) => {
            const at = String(event.created_at)
            return at <= through && (!edit || at > String(edit.created_at)) ? sum + Number(event.cents) : sum
          }, Number(edit?.cents ?? 0))
        }
        const total = valueAt('9999')
        team.days[date] = total
        // Future cells stay editable; only the business date determines when they
        // join the actual sales and the reconciliation of an opening balance.
        if (date > today) continue
        team.soldCents += total
        if (date >= weekMonday) team.weekCents += total
        if (date === today) team.dayCents = Math.max(0, total - (resetAt ? valueAt(resetAt) : 0))
        if (anchor && date <= String(anchor.date)) {
          // Operators can add a newly discovered registration to an earlier day.
          // Its recording time separates new money from a breakdown of the opening balance.
          const newlyRecorded = events.reduce((sum, e) =>
            String(e.created_at) > String(anchor.created_at) ? sum + Number(e.cents) : sum, 0)
          attributedAtAnchor += Math.max(0, total - newlyRecorded)
        }
      }
      if (fixedOpening !== null) {
        team.openingCents = fixedOpening
        team.soldCents += fixedOpening - cfg.openingCents
      } else if (anchor) {
        team.openingCents = Math.max(0, Number(anchor.cents) - attributedAtAnchor)
        team.soldCents += team.openingCents - cfg.openingCents
      }
      return team
    })
    const soldCents = teams.reduce((sum, t) => sum + t.soldCents, 0)
    const sellerCount = teams.reduce((sum, t) => sum + t.sellerCount, 0)
    const remainingCents = Math.max(0, goalCents - soldCents)
    const dailyTargetCents = daysRemaining ? Math.round(remainingCents / daysRemaining) : 0
    if (sellerCount) {
      const leftShare = Math.round(dailyTargetCents * teams[0].sellerCount / sellerCount)
      teams[0].dailyTargetCents = leftShare
      teams[1].dailyTargetCents = dailyTargetCents - leftShare
      for (const team of teams) team.weeklyTargetCents = team.dailyTargetCents * 5
    }
    return {
      revision: config.revision, today, startDate: config.startDate, endDate, dates,
      goalCents, soldCents, remainingCents, daysRemaining, sellerCount, dailyTargetCents,
      perSellerCents: sellerCount ? Math.round(dailyTargetCents / sellerCount) : 0,
      weeklyTargetCents: dailyTargetCents * 5,
      dayCents: teams[0].dayCents + teams[1].dayCents,
      weekCents: teams[0].weekCents + teams[1].weekCents,
      teams, destinations: config.destinations,
      sourceStatus: { state: syncState, lastSuccessAt: read('syncedAt', null), message: syncMessage },
    }
  }
  function configure(patch: RecessoConfigPatch) {
    transaction(() => {
      const config = read('config', configDefault)
      requireValue(patch && typeof patch === 'object', 'Configuração inválida.')
      if (patch.revision !== config.revision) {
        throw new RecessoError('A configuração mudou. Atualize o painel e tente novamente.', 409)
      }
      requireValue(Object.keys(patch).every(key => key === 'revision' || key === 'destinations'), 'A configuração aceita apenas destinos de exibição.')
      requireValue(patch.destinations && typeof patch.destinations === 'object' && !Array.isArray(patch.destinations), 'Destinos inválidos.')
      for (const [dest, enabled] of Object.entries(patch.destinations)) {
        requireValue(/^INSS:.{1,200}$/.test(dest) && typeof enabled === 'boolean', 'Destino inválido. Selecione uma TV INSS.')
        config.destinations[dest] = enabled
      }
      config.revision++
      write('config', config)
    })
    return getSnapshot()
  }
  const insertEntry = db.prepare('INSERT OR IGNORE INTO entries(id,team,date,cents,seller,paid,created_at) VALUES (?,?,?,?,?,?,?)')
  function addEntry(input: RecessoEntryInput) {
    transaction(() => {
      requireValue(input && requestIdValid(input.requestId) && ids.includes(input.teamId), 'Lançamento inválido.')
      requireValue(validDate(input.date) && validAmount(input.amountCents) && input.amountCents !== 0, 'Informe uma data e um valor válido.')
      requireValue(input.sellerId === undefined || Number.isSafeInteger(input.sellerId) && input.sellerId > 0, 'Vendedor inválido.')
      requireValue(input.paid === undefined || typeof input.paid === 'boolean', 'Situação de pagamento inválida.')
      const key = 'manual:' + input.requestId
      const existing = db.prepare('SELECT * FROM entries WHERE id=?').get(key)
      const seller = input.sellerId ?? null
      const paid = input.paid === undefined ? null : Number(input.paid)
      if (existing) {
        if (existing.team !== input.teamId || existing.date !== input.date || existing.cents !== input.amountCents || existing.seller !== seller || existing.paid !== paid) {
          throw new RecessoError('Identificador já utilizado para outro lançamento.', 409)
        }
        return
      }
      const snapshot = getSnapshot()
      requireValue(snapshot.dates.includes(input.date), 'Data fora dos dias de campanha.')
      const team = snapshot.teams.find(t => t.id === input.teamId)!
      requireValue((team.days[input.date] ?? 0) + input.amountCents >= 0, 'A correção tornaria negativo o valor desse dia.')
      if (input.date <= snapshot.today) {
        requireValue(team.soldCents + input.amountCents >= 0, 'A correção tornaria negativo o total da equipe.')
      }
      insertEntry.run(key, input.teamId, input.date, input.amountCents, seller, paid, nextStamp())
    })
    return getSnapshot()
  }
  function resetDay(input: { requestId: string, date: string, occurredAt?: string }) {
    transaction(() => {
      requireValue(input && requestIdValid(input.requestId) && validDate(input.date), 'Dados do encerramento diário inválidos.')
      const existing = db.prepare('SELECT date FROM resets WHERE id=?').get(input.requestId)
      if (existing && existing.date !== input.date) throw new RecessoError('Identificador reutilizado em outra data.', 409)
      if (existing) return
      let stamp: string
      if (input.occurredAt !== undefined) {
        const instant = new Date(input.occurredAt)
        requireValue(Number.isFinite(instant.getTime()) && instant.getTime() <= clock().getTime() + 60000 && saoPauloDate(instant) === input.date, 'Horário do reset inválido.')
        stamp = utcStamp(input.occurredAt)
      } else {
        requireValue(input.date === saoPauloDate(clock()), 'O reset deve corresponder ao dia atual.')
        stamp = nextStamp()
      }
      db.prepare('INSERT INTO resets VALUES (?,?,?)').run(input.requestId, input.date, stamp)
    })
    return getSnapshot()
  }
  function setTotal(input: RecessoTotalInput & { date?: string }, scope: 'team' | 'day') {
    transaction(() => {
      requireValue(input && requestIdValid(input.requestId) && ids.includes(input.teamId), 'Ajuste inválido.')
      requireValue(validAmount(input.amountCents) && input.amountCents >= 0 && validAmount(input.expectedCents), 'Informe um total válido.')
      const snapshot = getSnapshot()
      const date = scope === 'team' ? snapshot.today : input.date
      requireValue(date && validDate(date), 'Data inválida.')
      const existing = db.prepare('SELECT * FROM adjustments WHERE request_id=?').get(input.requestId)
      if (existing) {
        if (existing.team !== input.teamId || existing.scope !== scope || (scope === 'day' && existing.date !== date) || existing.cents !== input.amountCents || existing.expected !== input.expectedCents) {
          throw new RecessoError('Identificador já utilizado para outro ajuste.', 409)
        }
        return
      }
      if (scope === 'day') {
        requireValue(snapshot.dates.includes(date), 'Escolha um dos dias da campanha.')
        requireValue(date <= snapshot.today, 'Só é possível editar dias anteriores ou o dia atual.')
      }
      const team = snapshot.teams.find(t => t.id === input.teamId)!
      const current = scope === 'day' ? (team.days[date] ?? 0) : team.soldCents
      if (current !== input.expectedCents) throw new RecessoError('O valor mudou desde a última leitura. Atualize e confira o total.', 409)
      if (scope === 'team') {
        requireValue(input.amountCents >= team.soldCents - team.openingCents, 'O total não pode ser menor que as células já preenchidas. Corrija o histórico primeiro.')
      }
      // Preserve legacy balances until the first edit. From then on, a correction
      // must change sales by its full difference, never consume an opening balance.
      // Keep this in the same transaction as the adjustment and its idempotency key.
      write('fixedOpening:' + input.teamId, scope === 'team'
        ? input.amountCents - (team.soldCents - team.openingCents)
        : team.openingCents)
      db.prepare('INSERT INTO adjustments(request_id,team,scope,date,cents,expected,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(input.requestId, input.teamId, scope, date, input.amountCents, input.expectedCents, nextStamp())
    })
    return getSnapshot()
  }
  function applySource({ roster, events }: RecessoSourcePayload) {
    transaction(() => {
      write('roster', roster)
      for (const event of events) {
        requireValue(ids.includes(event.teamId) && validDate(event.date) && validAmount(event.amountCents) && Number.isFinite(Date.parse(event.createdAt)), 'Registro inválido recebido do INSS.')
        insertEntry.run('inss:' + event.id, event.teamId, event.date, event.amountCents, event.sellerId, null, utcStamp(event.createdAt))
      }
      write('syncedAt', clock().toISOString())
    })
    syncState = 'ok'
    syncMessage = null
  }
  function sourceFailed(message: string) {
    syncState = 'error'
    syncMessage = message
  }
  return {
    getSnapshot, configure, addEntry, resetDay, applySource, sourceFailed,
    setTeamTotal: (input: RecessoTotalInput) => setTotal(input, 'team'),
    setDayTotal: (input: RecessoTotalInput & { date: string }) => setTotal(input, 'day'),
    close: () => db.close(),
  }
}
