import type { IncomingMessage } from 'node:http'
import { join } from 'node:path'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { syncRecessoSource } from './recesso-source.ts'
import { createRecessoStore, RecessoError } from './recesso-store.ts'

async function bodyOf(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new RecessoError('Envie os dados em JSON.', 415)
  }
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
    throw new RecessoError('Origem do pedido incompatível.', 403)
  }
  const buffers: Buffer[] = []
  let length = 0
  for await (const part of req) {
    const buffer = Buffer.from(part)
    length += buffer.length
    if (length > 64 * 1024) throw new RecessoError('Pedido grande demais.', 413)
    buffers.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(buffers).toString('utf8'))
  } catch {
    throw new RecessoError('JSON inválido.')
  }
}

function attach(server: ViteDevServer | PreviewServer) {
  const store = createRecessoStore(process.env.RECESSO_DB_PATH || join(server.config.root, '.recesso', 'campaign.sqlite'))
  let syncing = false
  let disposed = false
  let lastAttempt = 0
  const disabled = process.env.RECESSO_DISABLE_SYNC === '1'
  async function syncIfDue() {
    if (disabled || disposed || syncing || Date.now() - lastAttempt < 10000) return
    syncing = true
    lastAttempt = Date.now()
    try {
      await syncRecessoSource(store)
    } catch (error) {
      if (!disposed) store.sourceFailed(error instanceof Error ? error.message : 'A origem INSS não respondeu.')
    } finally {
      syncing = false
      if (disposed) store.close()
    }
  }
  if (disabled) store.sourceFailed('Sincronização INSS desativada neste ambiente.')
  const interval = setInterval(() => void syncIfDue(), 15000)
  interval.unref()
  void syncIfDue()
  server.httpServer?.once('close', () => {
    clearInterval(interval)
    disposed = true
    if (!syncing) store.close()
  })
  server.middlewares.use(async (req, res, next) => {
    const route = req.url?.split('?')[0]
    if (!route || !(route === '/api/recesso' || route.startsWith('/api/recesso/'))) return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    try {
      void syncIfDue()
      if (route === '/api/recesso' && req.method === 'GET') {
        res.end(JSON.stringify(store.getSnapshot()))
        return
      }
      if (req.method !== 'POST') throw new RecessoError('Método indisponível.', 405)
      const input = await bodyOf(req)
      const actions = {
        '/api/recesso/config': store.configure,
        '/api/recesso/entries': store.addEntry,
        '/api/recesso/reset-day': store.resetDay,
        '/api/recesso/team-total': store.setTeamTotal,
        '/api/recesso/day-total': store.setDayTotal,
      }
      const handle = actions[route as keyof typeof actions]
      if (!handle) throw new RecessoError('Operação desconhecida.', 404)
      res.end(JSON.stringify(handle(input)))
    } catch (error) {
      res.statusCode = error instanceof RecessoError ? error.status : 500
      res.end(JSON.stringify({ error: error instanceof RecessoError ? error.message : 'Erro ao acessar a campanha.' }))
      if (res.statusCode === 500) console.error('Meta Recesso:', error)
    }
  })
}

export function recessoApi(): Plugin {
  return { name: 'recesso-api', configureServer: attach, configurePreviewServer: attach }
}
