import type { ApktState } from './types'

// Singleton in-memory — shared across API routes dalam satu process
// Reset saat server restart (intentional, belum pakai DB)
const g = global as typeof global & { _apktState?: ApktState }

export const apktState: ApktState = g._apktState ?? (g._apktState = {
  scraperStatus: 'idle',
  lastSync: null,
  totalRows: 0,
  data: [],
  pendingCommand: null,
  reguAssignments: {},
})
