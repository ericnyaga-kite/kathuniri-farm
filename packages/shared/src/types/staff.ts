export interface StaffMember {
  id: string
  fullName: string
  nationalId?: string
  phone?: string
  employmentType: 'permanent' | 'casual_picker' | 'casual_worker' | 'external'
  startDate?: string
  monthlySalary?: number
  dailyRate?: number
  pickerRatePerKg?: number
  paymentMethod: 'cash' | 'mpesa'
  mpesaNumber?: string
  nhifNumber?: string
  nssfNumber?: string
  statutoryDeductionsActive: boolean
  active: boolean
}

export interface Advance {
  id: string
  staffId: string
  advanceDate: string
  amountKes: number
  reason?: string
  amountRecovered: number
  amountOutstanding: number
  fullyRecovered: boolean
  recordedBy?: string
}

export interface MonthlyPayrollRun {
  id: string
  periodMonth: number
  periodYear: number
  status: 'draft' | 'approved' | 'paid'
  approvedBy?: string
  approvedAt?: string
}

export interface MonthlyPayrollRecord {
  id: string
  payrollRunId: string
  staffId: string
  grossSalary: number
  advanceDeduction: number
  nhifDeduction: number
  nssfDeduction: number
  otherDeductions: number
  netPay: number
  paymentMethod: 'cash' | 'mpesa'
  paymentDate?: string
  mpesaRef?: string
}
