export interface Cow {
  id: string
  name: string
  tagNumber?: string
  breed?: string
  dateOfBirth?: string
  status: 'milking' | 'dry' | 'heifer' | 'calf' | 'sold' | 'dead'
  currentLactationNumber?: number
  dateLastCalved?: string
  expectedDryOffDate?: string
  expectedCalvingDate?: string
  lastHeatObserved?: string
  lastInseminationDate?: string
  pregnancyConfirmedDate?: string
  active: boolean
}

export interface MilkProductionRecord {
  id: string
  productionDate: string
  cowId?: string
  session: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'AM' | 'PM'
  litres: number
  withdrawalActive: boolean
  saleable: boolean
  notes?: string
  source: 'manual' | 'image_parsed' | 'whatsapp_parsed'
}

export interface MilkDelivery {
  id: string
  deliveryDate: string
  buyerId: string
  litres: number
  pricePerLitre: number
  totalValue: number
  paymentReceived: boolean
  paymentDate?: string
}

export interface MilkBuyer {
  id: string
  canonicalName: 'Duka' | 'Hotel' | 'Fred' | string
  paymentType: 'cash' | 'account' | 'mpesa'
  pricePerLitre?: number
  currentBalance: number
  phone?: string
  active: boolean
}
