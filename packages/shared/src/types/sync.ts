export interface SyncQueueEntry {
  id?: number           // auto-increment, assigned by IndexedDB
  tableName: string
  recordId: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>
  createdAt: string     // ISO timestamp (device time)
  syncedAt?: string     // ISO timestamp when confirmed by server
  attemptCount: number
  lastError?: string
}

export interface SyncUploadPayload {
  deviceId: string
  lastSyncAt: string
  entries: SyncQueueEntry[]
}

export interface SyncDownloadPayload {
  serverTime: string
  records: {
    tableName: string
    records: Record<string, unknown>[]
    deletedIds: string[]
  }[]
  pendingParseResults: PendingParseResult[]
}

export interface PendingParseResult {
  parseJobId: string
  tableName: string
  recordId: string
  parsedData: Record<string, unknown>
  parseConfidence: number
  requiresReview: boolean
}
