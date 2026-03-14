export interface KtdaAccount {
  id: string
  accountCode: string  // e.g. TR0030499
  holderName: string
  holderNationalId?: string
  bankName?: string
  bankAccount?: string
  bushesRegistered?: number
  active: boolean
}

export interface CollectionCentre {
  id: string
  canonicalName: string
  alternateSpellings: string[]
  latitude?: number
  longitude?: number
  active: boolean
  pickingCycleDays: number
  lastPickingDate?: string
}

export interface CathySmsParseResult {
  accountCode: string
  totalCumulativeKg: number
  casualKg: number
  casualPayKes: number
  supervisorFloatKes: number  // negative if overdrawn
  collectionCentre: string
  centreKg: number
  accountAllocations: { letter: 'A' | 'B' | 'C'; kg: number }[]
  parseConfidence: number
}

export interface PickingSession {
  id: string
  sessionDate: string
  centreId: string
  pickerTotalKg?: number
  smsReportedKg?: number
  reconciliationStatus: 'pending' | 'matched' | 'discrepancy'
  discrepancyKg?: number
  notes?: string
}

export interface PickerRecord {
  id: string
  sessionId: string
  staffId: string
  kgPicked: number
  ratePerKg: number
  grossPay: number
}
