import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

type PageTab = 'kazi' | 'matumizi' | 'historia'

interface StaffMember {
  id: string
  fullName: string
  employmentType: string
  dailyRate: number | null
}

interface AttendanceRecord {
  staffId: string
  present: boolean
}

interface CasualRow {
  id: string
  name: string
  task: string
  amount: string
}

interface ExpenseRecord {
  id: string
  expenseDate: string
  enterprise: string
  account: string
  amountKes: number
  paymentMethod: string | null
}

const ENTERPRISES = [
  { key: 'tea',    icon: '🍃', en: 'Tea',      sw: 'Chai'        },
  { key: 'dairy',  icon: '🥛', en: 'Dairy',    sw: 'Maziwa'      },
  { key: 'rental', icon: '🏠', en: 'House',    sw: 'Nyumba'      },
  { key: 'crops',  icon: '🌾', en: 'Crops',    sw: 'Mazao'       },
  { key: 'staff',  icon: '👷', en: 'Workers',  sw: 'Wafanyakazi' },
  { key: 'general',icon: '📦', en: 'General',  sw: 'Jumla'       },
]

// ─── Kazi Tab ────────────────────────────────────────────────────────────────

function KaziTab({ t }: { t: (en: string, sw: string) => string }) {
  const today = new Date().toISOString().split('T')[0]
  const [date,       setDate]       = useState(today)
  const [staff,      setStaff]      = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [casuals,    setCasuals]    = useState<CasualRow[]>([])
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch(`${API}/api/staff`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: StaffMember[]) => {
        if (Array.isArray(data)) {
          const perm = data.filter(s => s.employmentType === 'permanent' || s.employmentType === 'contract')
          setStaff(perm)
          // Default everyone to present
          const init: Record<string, boolean> = {}
          perm.forEach(s => { init[s.id] = true })
          setAttendance(init)
        }
      })
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false))
  }, [])

  // Load saved attendance when date changes
  useEffect(() => {
    fetch(`${API}/api/staff/attendance?date=${date}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.records && Array.isArray(data.records)) {
          const saved: Record<string, boolean> = {}
          ;(data.records as AttendanceRecord[]).forEach((r: AttendanceRecord) => { saved[r.staffId] = r.present })
          setAttendance(prev => ({ ...prev, ...saved }))
        }
        if (data?.casuals && Array.isArray(data.casuals)) {
          setCasuals((data.casuals as Array<{ name: string; task: string; amountKes: number }>).map(c => ({
            id: crypto.randomUUID(),
            name: c.name,
            task: c.task,
            amount: String(c.amountKes),
          })))
        }
      })
      .catch(() => {})
  }, [date])

  function toggleAttendance(staffId: string) {
    setAttendance(prev => ({ ...prev, [staffId]: !prev[staffId] }))
  }

  function addCasual() {
    setCasuals(prev => [...prev, { id: crypto.randomUUID(), name: '', task: '', amount: '' }])
  }

  function updateCasual(id: string, field: keyof Omit<CasualRow, 'id'>, value: string) {
    setCasuals(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function removeCasual(id: string) {
    setCasuals(prev => prev.filter(c => c.id !== id))
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const records = staff.map(s => ({ staffId: s.id, present: attendance[s.id] ?? true }))
      const casualsData = casuals
        .filter(c => c.name.trim())
        .map(c => ({ name: c.name.trim(), task: c.task.trim(), amountKes: Number(c.amount) || 0 }))

      const r = await fetch(`${API}/api/staff/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ date, records, casuals: casualsData }),
      })
      if (!r.ok) throw new Error()
      setSaved(true)
    } catch {
      setError(t('Failed. Try again.', 'Imeshindwa. Jaribu tena.'))
    } finally {
      setSaving(false)
    }
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Attendance saved!', 'Mahudhurio yamehifadhiwa!')}</p>
      <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl" onClick={() => setSaved(false)}>
        {t('Edit', 'Hariri')}
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Date */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('Date', 'Tarehe')}</p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>

      {/* Permanent/Contract staff */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {t('Staff Attendance', 'Mahudhurio ya Wafanyakazi')}
        </p>
        {loadingStaff ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('Loading…', 'Inapakia…')}</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('No permanent staff found', 'Hakuna wafanyakazi wa kudumu')}</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {staff.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-3 px-3 ${i < staff.length - 1 ? 'border-b border-gray-100' : ''}`} style={{height:'44px'}}>
                <span className="flex-1 text-sm font-semibold text-gray-700">👷 {s.fullName}</span>
                <button
                  onClick={() => toggleAttendance(s.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-sm transition-all min-w-[80px] ${
                    attendance[s.id] !== false
                      ? 'bg-green-100 text-green-700 border-2 border-green-400'
                      : 'bg-red-100 text-red-700 border-2 border-red-400'
                  }`}>
                  {attendance[s.id] !== false ? `✅ ${t('Present', 'Yupo')}` : `❌ ${t('Absent', 'Hayupo')}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Casuals */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {t('Casual Workers', 'Vibarua')}
        </p>
        <div className="space-y-1.5">
          {casuals.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 bg-gray-50 rounded-xl border border-gray-200 px-2" style={{height:'40px'}}>
              <input type="text" placeholder={t('Name', 'Jina')} value={c.name}
                onChange={e => updateCasual(c.id, 'name', e.target.value)}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white min-w-0" />
              <input type="text" placeholder={t('Task', 'Kazi')} value={c.task}
                onChange={e => updateCasual(c.id, 'task', e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white min-w-0" />
              <span className="text-xs text-gray-500 font-medium flex-shrink-0">KES</span>
              <input type="number" inputMode="numeric" placeholder="0" value={c.amount}
                onChange={e => updateCasual(c.id, 'amount', e.target.value)}
                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white" />
              <button onClick={() => removeCasual(c.id)}
                className="w-6 h-6 flex items-center justify-center text-red-500 flex-shrink-0 text-base leading-none">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addCasual}
          className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold text-sm">
          + {t('Add Casual Worker', 'Ongeza Kibarua')}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl text-base disabled:opacity-40">
        {saving ? t('Saving…', 'Inahifadhi…') : `✓ ${t('Save Attendance', 'Hifadhi Mahudhurio')}`}
      </button>
    </div>
  )
}

// ─── Matumizi Tab ─────────────────────────────────────────────────────────────

function MatumiziTab({ t }: { t: (en: string, sw: string) => string }) {
  const today = new Date().toISOString().split('T')[0]
  const [enterprise,  setEnterprise]  = useState('')
  const [account,     setAccount]     = useState('')
  const [amount,      setAmount]      = useState('')
  const [payMethod,   setPayMethod]   = useState<'cash' | 'mpesa'>('cash')
  const [date,        setDate]        = useState(today)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')

  async function handleSave() {
    if (!enterprise) { setError(t('Select enterprise', 'Chagua biashara')); return }
    if (!account.trim()) { setError(t('Enter item/account', 'Weka kitu kilichonunuliwa')); return }
    if (!amount)     { setError(t('Enter amount', 'Weka kiasi')); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          expenseDate: date,
          enterprise,
          account: account.trim(),
          amountKes: Number(amount),
          paymentMethod: payMethod,
        }),
      })
      if (!r.ok) throw new Error()
      setSaved(true)
      setAccount(''); setAmount('')
    } catch {
      setError(t('Failed. Try again.', 'Imeshindwa. Jaribu tena.'))
    } finally {
      setSaving(false)
    }
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Expense saved!', 'Gharama imehifadhiwa!')}</p>
      <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl" onClick={() => setSaved(false)}>
        {t('Record Another', 'Ingiza Nyingine')}
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Enterprise */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {t('Enterprise', 'Biashara')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ENTERPRISES.map(e => (
            <button key={e.key} onClick={() => setEnterprise(e.key)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl border-2 font-bold text-xs transition-all ${
                enterprise === e.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
              <span className="text-xl">{e.icon}</span>
              {t(e.en, e.sw)}
            </button>
          ))}
        </div>
      </div>

      {/* Item / account */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('Item / Account', 'Kitu / Akaunti')}
        </p>
        <input type="text" value={account} onChange={e => setAccount(e.target.value)}
          placeholder={t('What was bought?', 'Kitu gani kilinunuliwa?')}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm" />
      </div>

      {/* Amount */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('Amount (KES)', 'Kiasi (KES)')}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-medium">KES</span>
          <input type="number" inputMode="numeric" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 text-3xl font-bold text-center border-b-2 border-blue-400 focus:outline-none py-2 bg-transparent" />
        </div>
      </div>

      {/* Payment method */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('Payment Method', 'Njia ya Malipo')}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setPayMethod('cash')}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-sm border-2 transition-all ${
              payMethod === 'cash' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            💵 {t('Cash', 'Taslimu')}
          </button>
          <button onClick={() => setPayMethod('mpesa')}
            className={`flex-1 py-2.5 rounded-2xl font-bold text-sm border-2 transition-all ${
              payMethod === 'mpesa' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'
            }`}>
            📱 M-Pesa
          </button>
        </div>
      </div>

      {/* Date */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('Date', 'Tarehe')}</p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm" />
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleSave} disabled={saving || !enterprise || !account.trim() || !amount}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-base disabled:opacity-40">
        {saving ? t('Saving…', 'Inahifadhi…') : `✓ ${t('Save Expense', 'Hifadhi Gharama')}`}
      </button>
    </div>
  )
}

// ─── Historia Tab ─────────────────────────────────────────────────────────────

function HistoriaTab({ t, lang }: { t: (en: string, sw: string) => string; lang: string }) {
  const [records,  setRecords]  = useState<ExpenseRecord[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const now = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1
    fetch(`${API}/api/expenses?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: ExpenseRecord[]) => {
        if (!Array.isArray(data)) { setRecords([]); return }
        const cutoff = Date.now() - 7 * 86400000
        setRecords(data.filter(e => new Date(e.expenseDate).getTime() >= cutoff))
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [])

  const ENT_MAP = Object.fromEntries(ENTERPRISES.map(e => [e.key, e]))

  if (loading) return <p className="text-sm text-gray-400 text-center py-8">{t('Loading…', 'Inapakia…')}</p>
  if (records.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-2">💰</p>
      <p className="text-gray-400 text-sm">{t('No expenses in the last 7 days', 'Hakuna gharama siku 7 zilizopita')}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {records.map(e => {
        const ent = ENT_MAP[e.enterprise]
        return (
          <div key={e.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span>{ent?.icon ?? '📦'}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {ent ? (lang === 'en' ? ent.en : ent.sw) : e.enterprise}
                  </span>
                </div>
                <p className="font-semibold text-gray-800 text-sm">{e.account}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(e.expenseDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  {e.paymentMethod && ` · ${e.paymentMethod}`}
                </p>
              </div>
              <span className="font-bold text-blue-700 text-base whitespace-nowrap">
                KES {Number(e.amountKes).toLocaleString()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LabourPage() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState<PageTab>('kazi')

  const TABS = [
    { key: 'kazi' as PageTab,     icon: '👷', en: 'Work',     sw: 'Kazi'     },
    { key: 'matumizi' as PageTab, icon: '💰', en: 'Expenses', sw: 'Matumizi' },
    { key: 'historia' as PageTab, icon: '📖', en: 'History',  sw: 'Historia' },
  ]

  return (
    <div className="p-3 max-w-md mx-auto">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-green-800">{t('Work & Expenses', 'Kazi na Matumizi')}</h1>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-3">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-all ${
              tab === tb.key ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-600'
            }`}>
            {tb.icon} {t(tb.en, tb.sw)}
          </button>
        ))}
      </div>

      {tab === 'kazi'     && <KaziTab     t={t} />}
      {tab === 'matumizi' && <MatumiziTab t={t} />}
      {tab === 'historia' && <HistoriaTab t={t} lang={lang} />}
    </div>
  )
}
