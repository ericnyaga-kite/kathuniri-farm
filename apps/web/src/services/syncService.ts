import { db } from '../db/localDb'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
let syncing = false

export async function flushSyncQueue(): Promise<{ synced: number; pending: number }> {
  if (syncing) return { synced: 0, pending: 0 }
  if (!navigator.onLine) return { synced: 0, pending: await db.syncQueue.filter(e => !e.syncedAt).count() }

  syncing = true
  try {
    const pending = await db.syncQueue.filter(e => !e.syncedAt).toArray()
    if (pending.length === 0) return { synced: 0, pending: 0 }

    const res = await fetch(`${API}/api/sync/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: pending }),
    })

    if (!res.ok) return { synced: 0, pending: pending.length }

    const result: {
      synced: number
      errors: { recordId: string }[]
      serverTime: string
    } = await res.json()

    const errorIds = new Set((result.errors ?? []).map(e => e.recordId))
    const syncedAt = result.serverTime ?? new Date().toISOString()

    const toMark = pending.filter(e => !errorIds.has(e.recordId))
    for (const entry of toMark) {
      if (entry.id != null) {
        await db.syncQueue.update(entry.id, { syncedAt })
      }
    }

    return { synced: toMark.length, pending: errorIds.size }
  } catch {
    return { synced: 0, pending: -1 }
  } finally {
    syncing = false
  }
}

export async function pendingSyncCount(): Promise<number> {
  return db.syncQueue.filter(e => !e.syncedAt).count()
}

export function initSyncService(): void {
  // Flush on startup
  flushSyncQueue()

  // Flush when coming back online
  window.addEventListener('online', () => flushSyncQueue())

  // Flush every 5 minutes
  setInterval(() => flushSyncQueue(), 5 * 60 * 1000)
}
