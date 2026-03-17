import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SW = ['', 'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba']

function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Types ────────────────────────────────────────────────────────────────────

type Enterprise = 'tea' | 'dairy' | 'rental' | 'crops' | 'staff' | 'general'

interface Expense {
  id: string
  expenseDate: string
  enterprise: string
  account: string
  amountKes: number
  description: string | null
  vendor: string | null
  paymentMethod: string | null
  mpesaRef: string | null
  approved: boolean
}

const ENTERPRISES: { value: Enterprise; en: string; sw: string }[] = [
  { value: 'tea',     en: 'Tea',     sw: 'Chai' },
  { value: 'dairy',   en: 'Dairy',   sw: 'Maziwa' },
  { value: 'rental',  en: 'Rental',  sw: 'Nyumba' },
  { value: 'crops',   en: 'Crops',   sw: 'Mazao' },
  { value: 'staff',   en: 'Staff',   sw: 'Wafanyakazi' },
  { value: 'general', en: 'General', sw: 'Jumla' },
]

// ─── ExpensePage ──────────────────────────────────────────────────────────────

export function ExpensePage() {
  const { t, lang } = useLang()
  const months = lang === 'sw' ? MONTHS_SW : MONTHS_EN

  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record')

  // ── Record form state ─────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    expenseDate:   today,
    enterprise:    'general' as Enterprise,
    account:       '',
    amountKes:     '',
    vendor:        '',
    paymentMethod: 'cash',
    mpesaRef:      '',
  })
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk]     = useState(false)

  function field(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amountKes)
    if (!form.account.trim()) {
      setSaveError(t('Item/account is required', 'Bidhaa/akaunti inahitajika'))
      return
    }
    if (!amount || amount <= 0) {
      setSaveError(t('Enter a positive amount', 'Weka kiasi sahihi'))
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const body: Record<string, unknown> = {
        expenseDate:   form.expenseDate,
        enterprise:    form.enterprise,
        account:       form.account.trim(),
        amountKes:     amount,
        vendor:        form.vendor.trim() || undefined,
        paymentMethod: form.paymentMethod,
        mpesaRef:      form.paymentMethod === 'mpesa' ? (form.mpesaRef.trim() || undefined) : undefined,
      }
      const r = await fetch(`${API}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error()
      setSaveOk(true)
      setForm(f => ({ ...f, account: '', amountKes: '', vendor: '', mpesaRef: '', expenseDate: today }))
      setTimeout(() => setSaveOk(false), 3000)
    } catch {
      setSaveError(t('Failed to save expense', 'Imeshindwa kuhifadhi matumizi'))
    } finally {
      setSaving(false)
    }
  }

  // ── History state ─────────────────────────────────────────────────────────
  const now = new Date()
  const [histYear, setHistYear]       = useState(now.getFullYear())
  const [histMonth, setHistMonth]     = useState(now.getMonth() + 1)
  const [histEnterprise, setHistEnterprise] = useState<Enterprise | ''>('')
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError]     = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setHistLoading(true)
    setHistError(null)
    try {
      const params = new URLSearchParams({
        year:  String(histYear),
        month: String(histMonth),
      })
      if (histEnterprise) params.set('enterprise', histEnterprise)
      const r = await fetch(`${API}/api/expenses?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!r.ok) throw new Error()
      const data: Expense[] = await r.json()
      setExpenses(data)
    } catch {
      setHistError(t('Failed to load expenses', 'Imeshindwa kupakia matumizi'))
    } finally {
      setHistLoading(false)
    }
  }, [histYear, histMonth, histEnterprise, t])

  useEffect(() => {
    if (activeTab === 'history') fetchExpenses()
  }, [activeTab, fetchExpenses])

  // Also refresh history after a save
  useEffect(() => {
    if (saveOk && activeTab === 'history') fetchExpenses()
  }, [saveOk, activeTab, fetchExpenses])

  // ── History grouping ──────────────────────────────────────────────────────

  type Group = { enterprise: string; label: string; total: number; items: Expense[] }

  function groupExpenses(list: Expense[]): Group[] {
    const map = new Map<string, Group>()
    for (const exp of list) {
      const ent = ENTERPRISES.find(e => e.value === exp.enterprise)
      const label = ent ? (lang === 'sw' ? ent.sw : ent.en) : exp.enterprise
      if (!map.has(exp.enterprise)) {
        map.set(exp.enterprise, { enterprise: exp.enterprise, label, total: 0, items: [] })
      }
      const g = map.get(exp.enterprise)!
      g.items.push(exp)
      g.total += exp.amountKes
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const groups = groupExpenses(expenses)
  const grandTotal = expenses.reduce((s, e) => s + e.amountKes, 0)

  const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-green-800 mb-4">{t('Expenses', 'Matumizi')}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['record', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
              activeTab === tab
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab === 'record' ? t('Record', 'Rekodi') : t('History', 'Historia')}
          </button>
        ))}
      </div>

      {/* ── Record tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'record' && (
        <form onSubmit={submitExpense} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
          {saveOk && (
            <p className="text-xs text-green-700 font-semibold">
              {t('Expense saved!', 'Matumizi yamehifadhiwa!')}
            </p>
          )}

          {/* Enterprise pill selector */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">{t('Enterprise', 'Biashara')}</label>
            <div className="flex flex-wrap gap-2">
              {ENTERPRISES.map(ent => (
                <button
                  key={ent.value}
                  type="button"
                  onClick={() => field('enterprise', ent.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    form.enterprise === ent.value
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {lang === 'sw' ? ent.sw : ent.en}
                </button>
              ))}
            </div>
          </div>

          {/* Account / Item */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('Item / Account', 'Bidhaa / Akaunti')} *</label>
            <input
              type="text"
              value={form.account}
              onChange={e => field('account', e.target.value)}
              placeholder={t('e.g. Fertiliser, Vet drugs, Labour', 'mfano: Mbolea, Dawa, Kazi')}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {/* Amount + Vendor row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('Amount (KES)', 'Kiasi (KES)')} *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.amountKes}
                onChange={e => field('amountKes', e.target.value)}
                placeholder="e.g. 2500"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('Vendor (optional)', 'Muuzaji (si lazima)')}</label>
              <input
                type="text"
                value={form.vendor}
                onChange={e => field('vendor', e.target.value)}
                placeholder={t('e.g. Agrovet Plus', 'mfano: Agrovet Plus')}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Payment method + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('Method', 'Njia ya Malipo')}</label>
              <select
                value={form.paymentMethod}
                onChange={e => field('paymentMethod', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="cash">{t('Cash', 'Taslimu')}</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('Date', 'Tarehe')}</label>
              <input
                type="date"
                value={form.expenseDate}
                onChange={e => field('expenseDate', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* M-Pesa ref */}
          {form.paymentMethod === 'mpesa' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">M-Pesa Ref ({t('optional', 'si lazima')})</label>
              <input
                type="text"
                value={form.mpesaRef}
                onChange={e => field('mpesaRef', e.target.value)}
                placeholder="e.g. QGH4XXXX"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-green-800"
          >
            {saving ? t('Saving...', 'Inahifadhi...') : t('Save Expense', 'Hifadhi Matumizi')}
          </button>
        </form>
      )}

      {/* ── History tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t('Month', 'Mwezi')}</label>
                <select
                  value={histMonth}
                  onChange={e => setHistMonth(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>{months[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t('Year', 'Mwaka')}</label>
                <select
                  value={histYear}
                  onChange={e => setHistYear(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {/* Enterprise filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setHistEnterprise('')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  histEnterprise === ''
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t('All', 'Zote')}
              </button>
              {ENTERPRISES.map(ent => (
                <button
                  key={ent.value}
                  onClick={() => setHistEnterprise(prev => prev === ent.value ? '' : ent.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    histEnterprise === ent.value
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {lang === 'sw' ? ent.sw : ent.en}
                </button>
              ))}
            </div>
          </div>

          {histError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
              {histError}
            </div>
          )}

          {histLoading && (
            <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
          )}

          {!histLoading && expenses.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-gray-400 text-sm">
                {t(
                  `No expenses recorded for ${months[histMonth]} ${histYear}.`,
                  `Hakuna matumizi yaliyorekodiwa kwa ${months[histMonth]} ${histYear}.`,
                )}
              </p>
            </div>
          )}

          {!histLoading && expenses.length > 0 && (
            <>
              {/* Grand total */}
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex justify-between items-center">
                <p className="text-sm font-semibold text-green-800">
                  {t('Total for', 'Jumla ya')} {months[histMonth]} {histYear}
                </p>
                <p className="text-lg font-bold text-green-800">KES {grandTotal.toLocaleString()}</p>
              </div>

              {/* Groups */}
              {groups.map(group => (
                <div key={group.enterprise} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Group header */}
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="font-semibold text-gray-700 text-sm">{group.label}</span>
                    <span className="font-bold text-gray-800 text-sm">KES {group.total.toLocaleString()}</span>
                  </div>
                  {/* Group rows */}
                  <div className="divide-y divide-gray-50">
                    {group.items.map(exp => (
                      <div key={exp.id} className="px-4 py-3 flex justify-between items-start">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-gray-800 truncate">{exp.account}</p>
                          <div className="flex gap-2 flex-wrap mt-0.5">
                            <span className="text-xs text-gray-400">
                              {new Date(exp.expenseDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                            {exp.vendor && (
                              <span className="text-xs text-gray-400">{exp.vendor}</span>
                            )}
                            {exp.paymentMethod && (
                              <span className="text-xs text-gray-400">
                                {exp.paymentMethod === 'mpesa' ? 'M-Pesa' : t('Cash', 'Taslimu')}
                                {exp.mpesaRef ? ` · ${exp.mpesaRef}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                          KES {exp.amountKes.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Group subtotal row */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between text-xs font-semibold text-gray-500">
                    <span>{group.items.length} {t('item(s)', 'rekodi')}</span>
                    <span>KES {group.total.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
