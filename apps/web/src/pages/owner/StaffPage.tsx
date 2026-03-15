import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface Advance {
  id: string
  advanceDate: string
  amountKes: number
  reason: string | null
  amountRecovered: number
  fullyRecovered: boolean
  outstandingBalance: number
}

interface StaffMember {
  id: string
  fullName: string
  phone: string | null
  employmentType: string
  monthlySalary: number | null
  paymentMethod: string
  mpesaNumber: string | null
  active: boolean
  outstandingAdvanceKes: number
}

function AdvanceForm({ staffId, staffName, onSaved, onCancel, t }: {
  staffId: string; staffName: string
  onSaved: () => void; onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const today = new Date().toISOString().split('T')[0]
  const [advanceDate, setAdvanceDate] = useState(today)
  const [amountKes, setAmountKes] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountKes)
    if (!amount || amount <= 0) { setError(t('Enter a positive amount', 'Weka kiasi sahihi')); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/staff/${staffId}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advanceDate, amountKes: amount, reason: reason || undefined }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-amber-50 rounded-2xl p-4 space-y-3 mt-3 border border-amber-200">
      <p className="font-semibold text-amber-800 text-sm">{t('Record Advance', 'Rekodi Mkopo')} — {staffName}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <label className="text-xs text-gray-500">{t('Amount (KES)', 'Kiasi (KES)')}</label>
        <input type="number" min="1" step="100" placeholder="e.g. 5000"
          value={amountKes} onChange={e => setAmountKes(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
        <input type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Reason (optional)', 'Sababu (si lazima)')}</label>
        <input type="text" placeholder={t('e.g. Medical, school fees', 'mfano: Dawa, ada ya shule')}
          value={reason} onChange={e => setReason(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-amber-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? t('Saving...', 'Inahifadhi...') : t('Save', 'Hifadhi')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </form>
  )
}

function StaffCard({ member, onRefresh, t }: {
  member: StaffMember
  onRefresh: () => void
  t: (en: string, sw: string) => string
}) {
  const [showAdvanceForm, setShowAdvanceForm] = useState(false)
  const [advances, setAdvances] = useState<Advance[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function loadAdvances() {
    const r = await fetch(`${API}/api/staff/${member.id}`)
    const d = await r.json()
    setAdvances(d.advances?.filter((a: Advance) => !a.fullyRecovered) ?? [])
  }

  function toggle() {
    if (!expanded && advances === null) loadAdvances()
    setExpanded(e => !e)
  }

  const empTypeLabel = member.employmentType === 'permanent'
    ? t('Permanent', 'Kudumu')
    : member.employmentType === 'casual'
      ? t('Casual', 'Kawaida')
      : t('Contract', 'Mkataba')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-gray-800">{member.fullName}</p>
            <p className="text-xs text-gray-400">{empTypeLabel}
              {member.monthlySalary ? ` · KES ${Number(member.monthlySalary).toLocaleString()}/mo` : ''}
            </p>
            {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
          </div>
          <div className="text-right">
            {member.outstandingAdvanceKes > 0 && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {t('Advance', 'Mkopo')}: KES {member.outstandingAdvanceKes.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={toggle}
            className="flex-1 border border-gray-200 rounded-xl py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            {expanded ? '▲ ' : '▼ '}{t('Advances', 'Mikopo')}
          </button>
          <button onClick={() => setShowAdvanceForm(s => !s)}
            className="flex-1 border border-amber-300 text-amber-700 rounded-xl py-1.5 text-xs font-semibold hover:bg-amber-50">
            + {t('Advance', 'Mkopo')}
          </button>
        </div>
      </div>

      {showAdvanceForm && (
        <div className="px-4 pb-4">
          <AdvanceForm
            staffId={member.id} staffName={member.fullName}
            onSaved={() => { setShowAdvanceForm(false); setAdvances(null); loadAdvances(); onRefresh() }}
            onCancel={() => setShowAdvanceForm(false)}
            t={t}
          />
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {advances === null
            ? <p className="text-xs text-gray-400">{t('Loading...', 'Inapakia...')}</p>
            : advances.length === 0
              ? <p className="text-xs text-gray-400">{t('No outstanding advances', 'Hakuna mkopo unaodaiwa')}</p>
              : <div className="space-y-2">
                  {advances.map(adv => (
                    <div key={adv.id} className="flex justify-between text-xs">
                      <div>
                        <p className="font-medium text-gray-700">{new Date(adv.advanceDate).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}</p>
                        {adv.reason && <p className="text-gray-400">{adv.reason}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-700">KES {adv.outstandingBalance.toLocaleString()}</p>
                        <p className="text-gray-400">{t('of', 'ya')} KES {adv.amountKes.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}
    </div>
  )
}

export function StaffPage() {
  const { t } = useLang()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(false)
  const [totalOutstanding, setTotalOutstanding] = useState(0)

  const fetchStaff = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/staff`)
      .then(r => r.json())
      .then((data: StaffMember[]) => {
        setStaff(data)
        setTotalOutstanding(data.reduce((s, m) => s + m.outstandingAdvanceKes, 0))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const permanent = staff.filter(s => s.employmentType === 'permanent')
  const others = staff.filter(s => s.employmentType !== 'permanent')

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-green-800 mb-1">{t('Staff', 'Wafanyakazi')}</h1>

      {totalOutstanding > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 flex justify-between items-center">
          <p className="text-sm text-amber-800">{t('Total advances outstanding', 'Jumla ya mikopo inayodaiwa')}</p>
          <p className="font-bold text-amber-800">KES {totalOutstanding.toLocaleString()}</p>
        </div>
      )}

      {loading
        ? <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
        : (
          <div className="space-y-3">
            {permanent.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('Permanent', 'Kudumu')}</p>
                {permanent.map(m => <StaffCard key={m.id} member={m} onRefresh={fetchStaff} t={t} />)}
              </>
            )}
            {others.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">{t('Casual / Contract', 'Kawaida / Mkataba')}</p>
                {others.map(m => <StaffCard key={m.id} member={m} onRefresh={fetchStaff} t={t} />)}
              </>
            )}
            {staff.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">👷</p>
                <p>{t('No staff records yet.', 'Hakuna rekodi za wafanyakazi bado.')}</p>
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}
