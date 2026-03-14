import Dexie, { type Table } from 'dexie'
import type {
  MilkProductionRecord,
  PickingSession,
  PickerRecord,
  SyncQueueEntry,
} from '@kathuniri/shared'

export class KathuniriDb extends Dexie {
  milkProduction!: Table<MilkProductionRecord>
  pickingSessions!: Table<PickingSession>
  pickerRecords!: Table<PickerRecord>
  syncQueue!: Table<SyncQueueEntry>

  constructor() {
    super('kathuniri-farm')
    this.version(1).stores({
      milkProduction: 'id, productionDate, cowId, session',
      pickingSessions: 'id, sessionDate, centreId',
      pickerRecords:   'id, sessionId, staffId',
      syncQueue:       '++id, tableName, syncedAt, attemptCount',
    })
  }
}

export const db = new KathuniriDb()

export async function queueSync(entry: Omit<SyncQueueEntry, 'id'>): Promise<void> {
  await db.syncQueue.add(entry)
}

export async function getPendingSyncEntries(): Promise<SyncQueueEntry[]> {
  return db.syncQueue.where('syncedAt').equals('').or('syncedAt').equals(undefined as unknown as string).toArray()
}
