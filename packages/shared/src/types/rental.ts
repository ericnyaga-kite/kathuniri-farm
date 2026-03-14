export interface RentalRoom {
  id: string
  roomNumber: number
  tenantName?: string
  tenantPhone?: string
  monthlyRentKes?: number
  electricityRatePerUnit: number
  occupancyStatus: 'occupied' | 'vacant'
  rentDueDay: number
  notes?: string
  active: boolean
}

export interface ElectricityReading {
  id: string
  roomId: string
  readingDate: string
  meterReading: number
  previousReading?: number
  unitsConsumed?: number
  amountKes?: number
  source: 'whatsapp' | 'manual'
  rawMessage?: string
  parseConfidence?: number
}

export interface RentPayment {
  id: string
  roomId: string
  paymentDate: string
  periodMonth: number
  periodYear: number
  rentAmountKes: number
  electricityAmountKes: number
  totalAmountKes: number
  paymentMethod: 'mpesa' | 'cash'
  mpesaRef?: string
  notes?: string
}
