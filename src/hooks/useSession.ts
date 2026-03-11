import { useCallback } from 'react'
import type { SessionConfig, SessionData } from '../types'

const DEFAULT_TTL = 86400 // 24h in seconds
const DEFAULT_KEY = 'sai_chat_session'

export function useSession(config?: SessionConfig) {
  const storageKey = config?.storageKey ?? DEFAULT_KEY
  const ttl = config?.ttl ?? DEFAULT_TTL
  const persist = config?.persist ?? false

  const save = useCallback(
    (fields: Record<string, string>) => {
      if (!persist) return
      const data: SessionData = { fields, savedAt: Date.now() }
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
        // localStorage may be unavailable (private mode, storage full)
      }
    },
    [persist, storageKey]
  )

  const load = useCallback((): Record<string, string> | null => {
    if (!persist) return null
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const data: SessionData = JSON.parse(raw)
      // Check TTL (ttl === 0 means forever)
      if (ttl > 0) {
        const ageSeconds = (Date.now() - data.savedAt) / 1000
        if (ageSeconds > ttl) {
          localStorage.removeItem(storageKey)
          return null
        }
      }
      return data.fields
    } catch {
      return null
    }
  }, [persist, storageKey, ttl])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }, [storageKey])

  return { save, load, clear }
}
