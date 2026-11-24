import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createRecessoStore, saoPauloDate } from './recesso-store.ts'
import type { RecessoSourcePayload } from './recesso-store.ts'
import { recessoHistoryWeeks, recessoPeriodTotalCents } from '../src/services/recesso.ts'

const roster: RecessoSourcePayload['roster'] = {
  ivanize: { name: 'Patroas', sourceTeamId: 2, sellerIds: [11,12], members: [], leader: { name: 'Ivanize', photoUrl: '' } },
  claudenise: { name: 'Águias', sourceTeamId: 3, sellerIds: [13], members: [], leader: { name: 'Claudenise', photoUrl: '' } },
}
const temporary: string[] = []
afterEach(() => { for (const folder of temporary.splice(0)) rmSync(folder, { recursive: true, force: true }) })

function fixture(initial = '2026-11-13T12:00:00Z', file = ':memory:') {
  let now = new Date(initial)
  const store = createRecessoStore(file, () => now)
  store.applySource({ roster, events: [] })
  return {
    store, setClock: (iso: string) => { now = new Date(iso) },
    event: (id: string, amountCents: number, createdAt: string) => ({
      id, amountCents, createdAt, teamId: 'ivanize' as const, sellerId: 11,
      date: saoPauloDate(new Date(createdAt)),
    }),
  }
}

test('25 dias úteis com folga em 20/11, alocação por efetivo e fim inclusivo em 18/12', () => {
  const {store, setClock} = fixture()
  const first = store.getSnapshot()
  assert.equal(first.startDate, '2026-11-13')
  assert.equal(first.dates.length, 26)
  assert.equal(first.daysRemaining, 25)
  assert.equal(first.dates.includes('2026-11-20'), true)
  assert.equal(first.dates[0], first.startDate)
  assert.equal(first.dates[1], '2026-11-16')
  assert.equal(first.endDate, '2026-12-18')
  assert.equal(first.dates.at(-1), first.endDate)
  assert.equal(first.sellerCount, 3)
  assert.equal(first.dailyTargetCents, 48000000)
  assert.equal(first.teams[0].dailyTargetCents, 32000000)
  assert.equal(first.teams[1].weeklyTargetCents, 80000000)
  const startingSale = {requestId:'primeiro',teamId:'ivanize' as const,date:first.startDate,amountCents:500}
  store.addEntry(startingSale)
  setClock('2026-11-20T15:00:00Z')
  assert.equal(store.getSnapshot().daysRemaining,20)
  store.setDayTotal({requestId:'folga-edit',teamId:'ivanize',date:'2026-11-20',expectedCents:0,amountCents:100})
  assert.equal(store.getSnapshot().teams[0].days['2026-11-20'], 100)
  assert.equal(store.getSnapshot().soldCents, 600)
  store.setDayTotal({requestId:'folga-zerar',teamId:'ivanize',date:'2026-11-20',expectedCents:100,amountCents:0})
  assert.equal(store.getSnapshot().soldCents, 500)
  setClock('2026-12-18T20:00:00Z')
  assert.equal(store.getSnapshot().daysRemaining, 1)
  assert.equal(store.getSnapshot().dailyTargetCents, first.goalCents - 500)
  const finalSale = {...startingSale, requestId:'ultimo', date:first.endDate, amountCents:800}
  store.addEntry(finalSale)
  store.setDayTotal({...finalSale,requestId:'acerto',expectedCents:800,amountCents:835})
  assert.equal(store.getSnapshot().dayCents, 835)
  assert.equal(store.getSnapshot().soldCents, 1335)
  assert.equal(store.getSnapshot().teams[0].days[first.startDate], 500)
  setClock('2026-12-19T09:00:00Z')
  assert.equal(store.getSnapshot().daysRemaining, 0)
  assert.equal(store.getSnapshot().dailyTargetCents, 0)
  assert.equal(store.getSnapshot().soldCents, 1335)
  assert.throws(() => store.addEntry({...finalSale,requestId:'fora',date:'2026-12-19'}), /dias de campanha/)
  assert.throws(() => store.setDayTotal({...finalSale,requestId:'fora-grade',date:'2026-12-21',expectedCents:0}), /dias da campanha/)
  store.close()
})

test('grade futura persiste, aceita zero e só entra nas vendas na data em São Paulo', () => {
  const folder = mkdtempSync(join(tmpdir(), 'campanha-grade-'))
  temporary.push(folder)
  const file = join(folder, 'grade.sqlite')
  const {store, setClock} = fixture('2026-11-16T10:00:00Z', file)
  const [today, tomorrow, final] = ['2026-11-16', '2026-11-17', '2026-12-18']
  const entry = {teamId: 'ivanize' as const, date: tomorrow, amountCents: 120, requestId:'previsao'}
  store.addEntry({ ...entry, date:today, requestId:'venda-hoje', amountCents: 50 })
  store.addEntry(entry)
  store.addEntry(entry)
  const edit = {...entry, expectedCents:120, amountCents:230, requestId:'editar'}
  assert.throws(() => store.setDayTotal(edit), /dia atual/)
  setClock('2026-11-17T10:00:00Z')
  store.setDayTotal(edit)
  store.setDayTotal(edit)
  const corrected = {...entry, requestId:'reduzir', amountCents:-30}
  store.addEntry(corrected)
  assert.throws(() => store.addEntry({...entry,requestId:'negativo',amountCents:-201}), /negativo/)
  assert.throws(() => store.setDayTotal({...edit,requestId:'desatualizado'}), /mudou/)
  setClock('2026-12-18T10:00:00Z')
  store.setDayTotal({...edit,requestId:'zero',date:final,amountCents:0,expectedCents:0})
  setClock('2026-11-16T10:00:00Z')
  store.setTeamTotal({teamId:'ivanize',requestId:'ate-agora',expectedCents:50,amountCents:80})
  const before = store.getSnapshot()
  assert.equal(before.teams[0].days[tomorrow],200)
  assert.equal(before.teams[0].days[final],0)
  assert.equal(before.dayCents,50)
  assert.equal(before.weekCents,50)
  assert.equal(before.soldCents,80)
  assert.equal(recessoPeriodTotalCents(before.teams[0]),280)
  assert.equal(recessoPeriodTotalCents(before.teams[1]),0)
  store.close()

  let now = new Date('2026-11-17T02:59:59Z')
  const reopened = createRecessoStore(file, () => now)
  assert.equal(reopened.getSnapshot().soldCents,80)
  assert.equal(reopened.getSnapshot().teams[0].days[tomorrow],200)
  assert.equal(reopened.getSnapshot().teams[0].days[final],0)
  now = new Date('2026-11-17T03:00:00Z')
  const after = reopened.getSnapshot()
  assert.equal(after.dayCents,200)
  assert.equal(after.weekCents,250)
  assert.equal(after.soldCents,280)
  assert.equal(recessoPeriodTotalCents(after.teams[0]),280)
  assert.equal(after.remainingCents, after.goalCents - 280)
  reopened.addEntry(corrected)
  assert.equal(reopened.getSnapshot().soldCents,280)
  reopened.setTeamTotal({teamId:'ivanize',requestId:'reconciliar',expectedCents:280,amountCents:400})
  assert.equal(reopened.getSnapshot().soldCents,400)
  now = new Date('2026-11-18T03:00:00Z')
  assert.equal(reopened.getSnapshot().soldCents,400)
  assert.equal(reopened.getSnapshot().dayCents,0)
  reopened.close()
})

test('correção retroativa altera o acumulado mesmo com saldo anterior e sincronização tardia', () => {
  const {store, event, setClock} = fixture('2026-11-16T12:00:00Z')
  const sale = event('s1', 700, '2026-11-13T15:00:00Z')
  store.applySource({ roster, events: [sale] })
  store.setTeamTotal({ teamId: 'ivanize', amountCents: 15000, expectedCents: 700, requestId: 'saldo' })
  setClock('2026-11-16T13:00:00Z')
  const edit = {teamId: 'ivanize' as const, amountCents: 5000, date:'2026-11-13', expectedCents:700, requestId:'detalhe'}
  store.setDayTotal(edit)
  store.setDayTotal(edit)
  assert.equal(store.getSnapshot().soldCents, 19300)
  assert.equal(store.getSnapshot().teams[0].openingCents, 14300)
  store.applySource({roster, events:[sale, event('venda-anterior', 300, '2026-11-13T17:00:00Z')]})
  assert.equal(store.getSnapshot().teams[0].days['2026-11-13'], 5000)
  store.applySource({roster, events:[event('corrente', 950, '2026-11-16T14:00:00Z')]})
  assert.equal(store.getSnapshot().soldCents, 20250)
  store.addEntry({requestId:'retroativo-novo',teamId:'ivanize',date:'2026-11-13',amountCents:250})
  assert.equal(store.getSnapshot().soldCents,20500)
  assert.equal(store.getSnapshot().teams[0].days['2026-11-13'],5250)
  assert.throws(() => store.setDayTotal({...edit,requestId:'concorrente'}), /mudou/)
  store.close()
})

test('reset só zera o diário; grade, semana, transferências e reenvio conservam o resultado', () => {
  const {store, event, setClock} = fixture('2026-11-17T12:00:00Z')
  const before = event('a', 2000, '2026-11-17T11:00:00Z')
  store.applySource({roster, events:[before, event('ontem', 300, '2026-11-16T12:00:00Z')]})
  const reset = {requestId:'reset-1', date:'2026-11-17'}
  store.resetDay(reset)
  assert.equal(store.getSnapshot().dayCents, 0)
  assert.equal(store.getSnapshot().weekCents, 2300)
  setClock('2026-11-17T15:00:00Z')
  const adjustment = {requestId:'pago',teamId:'ivanize' as const,date:'2026-11-17',amountCents:600,paid:false}
  store.addEntry(adjustment)
  store.addEntry(adjustment)
  store.resetDay(reset)
  const extra = event('tardio', 700, '2026-11-17T11:15:00Z')
  store.applySource({roster, events:[{...before, teamId:'claudenise'}, extra]})
  assert.equal(store.getSnapshot().dayCents, 600)
  assert.equal(store.getSnapshot().teams[0].days['2026-11-17'], 3300)
  assert.equal(store.getSnapshot().weekCents, 3600)
  assert.equal(store.getSnapshot().teams[1].soldCents, 0)
  setClock('2026-11-18T10:00:00Z')
  assert.equal(store.getSnapshot().dayCents, 0)
  assert.equal(store.getSnapshot().weekCents, 3600)
  assert.throws(() => store.addEntry({...adjustment,amountCents:7}), /outro lançamento/)
  store.close()
})

test('alterar uma célula substitui o valor e mantém vendas seguintes, inclusive estornos', () => {
  const {store, event, setClock} = fixture('2026-11-16T12:00:00Z')
  const sale = event('1', 800, '2026-11-16T11:00:00Z')
  store.applySource({roster,events:[sale]})
  store.setDayTotal({requestId:'celula',teamId:'ivanize',date:'2026-11-16',amountCents:1400,expectedCents:800})
  setClock('2026-11-16T16:00:00Z')
  const refund = event('2', -300, '2026-11-16T15:00:00Z')
  store.applySource({roster,events:[sale,refund]})
  assert.equal(store.getSnapshot().soldCents,1100)
  store.setDayTotal({requestId:'corrigir-zero',teamId:'ivanize',date:'2026-11-16',amountCents:0,expectedCents:1100})
  assert.equal(store.getSnapshot().soldCents,0)
  store.close()
})

test('estado persiste ao reabrir a base e configuração concorrente é rejeitada', () => {
  const folder = mkdtempSync(join(tmpdir(), 'campanha-recesso-'))
  temporary.push(folder)
  const file = join(folder, 'campanha.sqlite')
  const {store} = fixture(undefined,file)
  const revision = store.getSnapshot().revision
  store.configure({revision, destinations:{'INSS:*':true,'INSS:Recepção':false}})
  assert.throws(() => store.configure({revision,destinations:{'INSS:*':false}}), /configuração mudou/)
  store.setTeamTotal({requestId:'abertura',teamId:'ivanize',amountCents:14000,expectedCents:0})
  store.close()
  const reopened = createRecessoStore(file)
  assert.equal(reopened.getSnapshot().soldCents,14000)
  assert.equal(reopened.getSnapshot().destinations['INSS:Recepção'],false)
  reopened.close()
})

test('reset, correções e recibos tardios distinguem a ordem dentro do mesmo milissegundo', () => {
  const {store, event, setClock} = fixture('2026-11-13T12:00:00.500Z')
  const sale = event('aj', 200, '2026-11-13T11:59:00.100500Z')
  store.applySource({roster,events:[sale]})
  store.resetDay({requestId:'antes',date:'2026-11-13'})
  store.setDayTotal({requestId:'depois',teamId:'ivanize',date:'2026-11-13',amountCents:250,expectedCents:200})
  assert.equal(store.getSnapshot().dayCents,50)
  store.addEntry({requestId:'outro',date:'2026-11-13',amountCents:75,teamId:'ivanize'})
  assert.equal(store.getSnapshot().dayCents,125)
  setClock('2026-11-14T15:00:00Z')
  store.resetDay({requestId:'resposta-tardia',date:'2026-11-13',occurredAt:'2026-11-13T11:00:00Z'})
  assert.equal(store.getSnapshot().daysRemaining,24)
  assert.equal(store.getSnapshot().dayCents,0)
  assert.equal(store.getSnapshot().weekCents,325)
  assert.throws(() => store.addEntry({requestId:'fimsemana',teamId:'ivanize',date:'2026-11-14',amountCents:1}),/dias de campanha/)
  store.close()
})

test('edições de hoje e de semanas anteriores recalculam metas e preservam o outro time', () => {
  const { store } = fixture('2026-11-24T15:00:00Z')
  store.addEntry({ requestId:'outra-equipe', teamId:'claudenise', date:'2026-11-24', amountCents:50000 })
  const other = store.getSnapshot().teams[1]
  const edit = (id: string, date: string, amountCents: number, expectedCents: number) =>
    store.setDayTotal({ requestId:id, teamId:'ivanize', date, amountCents, expectedCents })
  edit('semana-passada', '2026-11-17', 100000, 0)
  edit('ontem', '2026-11-23', 200000, 0)
  edit('hoje', '2026-11-24', 300000, 0)
  let result = edit('corrigir-passado', '2026-11-17', 150000, 100000)
  assert.equal(result.soldCents, 700000)
  assert.equal(result.weekCents, 550000)
  assert.equal(result.dayCents, 350000)
  result = edit('reduzir-hoje', '2026-11-24', 10000, 300000)
  assert.equal(result.soldCents, 410000)
  assert.equal(result.weekCents, 260000)
  assert.equal(result.dayCents, 60000)
  result = edit('zerar-ontem', '2026-11-23', 0, 200000)
  assert.equal(result.soldCents, 210000)
  assert.equal(result.weekCents, 60000)
  assert.equal(result.remainingCents, result.goalCents - 210000)
  assert.equal(result.dailyTargetCents, Math.round(result.remainingCents / result.daysRemaining))
  assert.equal(result.perSellerCents, Math.round(result.dailyTargetCents / 3))
  assert.equal(result.weeklyTargetCents, result.dailyTargetCents * 5)
  assert.equal(result.teams[0].dailyTargetCents + result.teams[1].dailyTargetCents, result.dailyTargetCents)
  assert.equal(result.teams[1].soldCents, other.soldCents)
  assert.deepEqual(result.teams[1].days, other.days)
  assert.deepEqual(edit('zerar-ontem', '2026-11-23', 0, 200000), result)
  assert.throws(() => edit('concorrente', '2026-11-24', 123, 300000), /mudou/)
  assert.throws(() => edit('negativo', '2026-11-24', -100, 10000), /total válido/)
  assert.throws(() => edit('futuro', '2026-11-25', 100, 0), /dia atual/)
  store.close()
})

test('saldo legado é preservado ao abrir, mas não absorve novas correções após reinício', () => {
  const folder = mkdtempSync(join(tmpdir(), 'campanha-legado-'))
  temporary.push(folder)
  const file = join(folder, 'campaign.sqlite')
  const {store} = fixture('2026-11-17T12:00:00Z', file)
  store.addEntry({requestId:'venda-original',teamId:'ivanize',date:'2026-11-16',amountCents:800})
  const legacy = new DatabaseSync(file)
  legacy.prepare('INSERT INTO adjustments(request_id,team,scope,date,cents,expected,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('saldo-legado', 'ivanize', 'team', '2026-11-17', 20000, 800, '2026-11-17T13:00:00.000000Z')
  legacy.close()
  assert.equal(store.getSnapshot().soldCents, 20000)
  const input = {requestId:'correcao-nova',teamId:'ivanize' as const,date:'2026-11-16',amountCents:1500,expectedCents:800}
  assert.equal(store.setDayTotal(input).soldCents,20700)
  store.close()
  const reopened = createRecessoStore(file, () => new Date('2026-11-17T15:00:00Z'))
  assert.equal(reopened.getSnapshot().soldCents,20700)
  assert.equal(reopened.setDayTotal(input).soldCents,20700)
  assert.equal(reopened.setDayTotal({...input,requestId:'reduzir',amountCents:0,expectedCents:1500}).soldCents,19200)
  reopened.close()
})

test('histórico agrupa semanas reais e mantém lacunas antes do início da campanha', () => {
  const {store} = fixture()
  const weeks = recessoHistoryWeeks(store.getSnapshot().dates)
  assert.equal(weeks.length, 6)
  assert.deepEqual(weeks[0], [null,null,null,null,'2026-11-13'])
  assert.deepEqual(weeks[1], ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'])
  assert.deepEqual(weeks[2], ['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27'])
  assert.deepEqual(weeks.flat().filter(Boolean), store.getSnapshot().dates)
  store.close()
})
