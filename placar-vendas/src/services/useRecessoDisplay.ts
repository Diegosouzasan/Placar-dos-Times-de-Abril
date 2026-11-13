import { useEffect, useState } from 'react'
import { getRecesso, type RecessoSnapshot } from './recesso'

export function useRecessoDisplay(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<RecessoSnapshot | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    let closed = false
    let busy = false
    async function refresh() {
      if (closed || busy) return
      busy = true
      try {
        const data = await getRecesso()
        if (!closed) {
          setSnapshot(data)
          setError('')
        }
      } catch {
        if (!closed) setError('Conexão interrompida. Tentando atualizar o placar…')
      } finally {
        busy = false
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      closed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [enabled])
  return { snapshot, error }
}
