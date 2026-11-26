import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syncRecessoSource } from './recesso-source.ts'
import type { RecessoSourcePayload } from './recesso-store.ts'

test('a origem do INSS identifica as supervisoras e importa inclusive a segunda página sem filtrar por pagamento', async t => {
  const sales = Array.from({ length: 501 }, (_, i) => ({
    id: String(i), seller_id: i % 2 === 0 ? 22 : 31, amount: i === 500 ? '-123.45' : '15.08',
    created_at: i === 500 ? '2026-12-19T02:59:59.999999Z' : '2026-11-03T01:30:00Z',
  }))
  const offsets: number[] = []
  t.mock.method(globalThis, 'fetch', (url: URL) => {
    const query = url.searchParams
    const table = url.pathname.split('/').at(-1)
    if (table === 'teams') {
      assert.equal(query.get('category'), 'eq.INSS')
      return Response.json([
        {id: 9, name: 'Patroas', leader_name: ' IVANIZE ', leader_photo: null},
        {id: 4, name: 'Águias', leader_name: 'Claudenise', leader_photo: null},
      ])
    }
    if (table === 'sellers') {
      assert.equal(query.get('team_id'), 'in.(9,4)')
      return Response.json([
        {id: 22, name: 'A', team_id: 9, photo_url: null}, {id: 31, name: 'B', team_id: 4, photo_url: null},
      ])
    }
    assert.equal(table, 'sales_history')
    assert.equal(query.get('seller_id'), 'in.(22,31)')
    assert.equal(query.get('and'), '(created_at.gte.2026-11-02T00:00:00-03:00,created_at.lte.2026-12-18T23:59:59.999999-03:00)')
    const offset = Number(query.get('offset'))
    offsets.push(offset)
    return Response.json(sales.slice(offset, offset + Number(query.get('limit'))))
  })
  const writes: RecessoSourcePayload[] = []
  await syncRecessoSource({
    getSnapshot: () => ({startDate: '2026-11-02', endDate: '2026-12-18'}),
    applySource: source => { writes.push(source) },
  })
  assert.deepEqual(offsets, [0, 500])
  assert.equal(writes.length, 1)
  assert.equal(writes[0].events.length, 501)
  assert.equal(writes[0].events[0].date, '2026-11-02')
  assert.equal(writes[0].events[500].date, '2026-12-18')
  assert.equal(writes[0].events[500].amountCents, -12345)
  assert.equal(writes[0].events[1].teamId, 'claudenise')
  assert.deepEqual(writes[0].roster.ivanize.sellerIds, [22])
})
