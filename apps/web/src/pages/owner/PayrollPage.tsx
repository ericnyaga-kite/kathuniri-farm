import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SW = ['', 'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba']

function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollStaff {
  fullName: string
  employmentType: string
  paymentMethod: string
  mpesaNumber: string | null
}

interface PayrollRecord {
  id: string
  staffId: string
  grossSalary: number
  advanceDeduction: number
  nhifDeduction: number
  nssfDeduction: number
  otherDeductions: number
  netPay: number
  paymentMethod: string
  paymentDate: string | null
  mpesaRef: string | null
  staff: PayrollStaff
}

interface PayrollRun {
  id: string
  periodMonth: number
  periodYear: number
  status: 'draft' | 'approved'
  records: PayrollRecord[]
}

interface PastRun {
  id: string
  periodMonth: number
  periodYear: number
  status: string
}

// ─── PayrollPage ──────────────────────────────────────────────────────────────

export function PayrollPage() {
  const { t, lang } = useLang()
  const months = lang === 'sw' ? MONTHS_SW : MONTHS_EN

  const now = new Date()
  const [selYear, setSelYear]   = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  const [run, setRun]           = useState<PayrollRun | null>(null)
  const [loading, setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Local overrides for otherDeductions while editing draft
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const [pastRuns, setPastRuns] = useState<PastRun[]>([])
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')

  // ── Fetch run for selected month ────────────────────────────────────────────

  const fetchRun = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API}/api/payroll/runs?year=${selYear}&month=${selMonth}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!r.ok) throw new Error('fetch failed')
      const data = await r.json()
      if (data && data.id) {
        // Got a run summary; fetch full detail
        const r2 = await fetch(`${API}/api/payroll/runs/${data.id}`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        if (!r2.ok) throw new Error('detail fetch failed')
        const detail: PayrollRun = await r2.json()
        setRun(detail)
        // Seed overrides from existing data
        const init: Record<string, string> = {}
        detail.records.forEach(rec => { init[rec.id] = String(rec.otherDeductions) })
        setOverrides(init)
      } else {
        setRun(null)
        setOverrides({})
      }
    } catch {
      setError(t('Failed to load payroll data', 'Imeshindwa kupakia data ya mishahara'))
    } finally {
      setLoading(false)
    }
  }, [selYear, selMonth, t])

  useEffect(() => { fetchRun() }, [fetchRun])

  // ── Fetch past runs ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API}/api/payroll/runs`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: PastRun[]) => setPastRuns(Array.isArray(data) ? data : []))
      .catch(() => {/* silent */})
  }, [run]) // refresh when run changes

  // ── Generate payroll ─────────────────────────────────────────────────────────

  async function generatePayroll() {
    setGenerating(true)
    setError(null)
    try {
      const r = await fetch(`${API}/api/payroll/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ periodMonth: selMonth, periodYear: selYear }),
      })
      if (!r.ok) throw new Error('generate failed')
      const detail: PayrollRun = await r.json()
      setRun(detail)
      const init: Record<string, string> = {}
      detail.records.forEach(rec => { init[rec.id] = String(rec.otherDeductions) })
      setOverrides(init)
    } catch {
      setError(t('Failed to generate payroll', 'Imeshindwa kuunda mishahara'))
    } finally {
      setGenerating(false)
    }
  }

  // ── Save other-deductions override ──────────────────────────────────────────

  async function saveOtherDeductions(recordId: string) {
    const val = parseFloat(overrides[recordId] ?? '0') || 0
    try {
      const r = await fetch(`${API}/api/payroll/records/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ otherDeductions: val }),
      })
      if (!r.ok) throw new Error()
      const updated: PayrollRecord = await r.json()
      setRun(prev => prev
        ? { ...prev, records: prev.records.map(rec => rec.id === recordId ? updated : rec) }
        : prev)
    } catch {
      setError(t('Failed to save deduction', 'Imeshindwa kuhifadhi punguzo'))
    }
  }

  // ── Approve run ─────────────────────────────────────────────────────────────

  async function approveRun() {
    if (!run) return
    if (!window.confirm(t(
      `Approve payroll for ${months[selMonth]} ${selYear}? This cannot be undone.`,
      `Thibitisha mishahara ya ${months[selMonth]} ${selYear}? Haiwezekani kubadilisha.`,
    ))) return
    setApproving(true)
    setError(null)
    try {
      const r = await fetch(`${API}/api/payroll/runs/${run.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!r.ok) throw new Error()
      await fetchRun()
    } catch {
      setError(t('Failed to approve payroll', 'Imeshindwa kuidhinisha mishahara'))
    } finally {
      setApproving(false)
    }
  }

  // ── Mark paid ────────────────────────────────────────────────────────────────

  async function markPaid(recordId: string) {
    const today = new Date().toISOString().split('T')[0]
    try {
      const r = await fetch(`${API}/api/payroll/records/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ paymentDate: today }),
      })
      if (!r.ok) throw new Error()
      const updated: PayrollRecord = await r.json()
      setRun(prev => prev
        ? { ...prev, records: prev.records.map(rec => rec.id === recordId ? updated : rec) }
        : prev)
    } catch {
      setError(t('Failed to mark as paid', 'Imeshindwa kuthibitisha malipo'))
    }
  }

  // ── Computed totals ──────────────────────────────────────────────────────────

  const totals = run
    ? run.records.reduce(
        (acc, rec) => {
          const other = parseFloat(overrides[rec.id] ?? String(rec.otherDeductions)) || rec.otherDeductions
          const net = Math.max(0, rec.grossSalary - rec.advanceDeduction - rec.nhifDeduction - rec.nssfDeduction - other)
          acc.gross  += rec.grossSalary
          acc.advance += rec.advanceDeduction
          acc.net    += net
          return acc
        },
        { gross: 0, advance: 0, net: 0 },
      )
    : null

  // ─── Year options ─────────────────────────────────────────────────────────

  const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <h1 className="text-xl font-bold text-green-800 mb-4">{t('Payroll', 'Mishahara')}</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['current', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
              activeTab === tab
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab === 'current' ? t('Current', 'Sasa') : t('History', 'Historia')}
          </button>
        ))}
      </div>

      {/* ── History tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {pastRuns.length === 0
            ? <p className="text-gray-400 text-sm py-4 text-center">{t('No past runs', 'Hakuna rekodi za zamani')}</p>
            : pastRuns.map(pr => (
                <button
                  key={pr.id}
                  onClick={() => {
                    setSelYear(pr.periodYear)
                    setSelMonth(pr.periodMonth)
                    setActiveTab('current')
                  }}
                  className="w-full bg-white rounded-2xl border border-gray-200 p-3 flex justify-between items-center hover:bg-gray-50"
                >
                  <span className="font-semibold text-gray-700">
                    {months[pr.periodMonth]} {pr.periodYear}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    pr.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {pr.status === 'approved' ? t('Approved', 'Imeidhinishwa') : t('Draft', 'Rasimu')}
                  </span>
                </button>
              ))
          }
        </div>
      )}

      {/* ── Current tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'current' && (
        <>
          {/* Month / Year selector */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">{t('Month', 'Mwezi')}</label>
                <select
                  value={selMonth}
                  onChange={e => setSelMonth(parseInt(e.target.value))}
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
                  value={selYear}
                  onChange={e => setSelYear(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <span className="text-sm font-semibold text-gray-600">
                {months[selMonth]} {selYear}
                {run && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
                    run.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {run.status === 'approved' ? t('Approved', 'Imeidhinishwa') : t('Draft', 'Rasimu')}
                  </span>
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
          )}

          {/* No run yet */}
          {!loading && !run && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-3xl mb-3">💰</p>
              <p className="text-gray-500 mb-4">
                {t(
                  `No payroll run for ${months[selMonth]} ${selYear} yet.`,
                  `Bado hakuna mishahara ya ${months[selMonth]} ${selYear}.`,
                )}
              </p>
              <button
                onClick={generatePayroll}
                disabled={generating}
                className="bg-green-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {generating ? t('Generating...', 'Inaunda...') : t('Generate Payroll', 'Unda Mishahara')}
              </button>
            </div>
          )}

          {/* Run exists — show table */}
          {!loading && run && (
            <div className="space-y-4">
              {/* Totals banner */}
              {totals && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">{t('Gross', 'Jumla Ghafi')}</p>
                    <p className="font-bold text-green-800">KES {totals.gross.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('Advances', 'Mikopo')}</p>
                    <p className="font-bold text-amber-700">KES {totals.advance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('Net Pay', 'Malipo Halisi')}</p>
                    <p className="font-bold text-green-800">KES {totals.net.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Records */}
              {run.records.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                  {t('No permanent or contract staff with salary found.', 'Hakuna wafanyakazi wa kudumu au mkataba wenye mshahara.')}
                </div>
              ) : (
                run.records.map(rec => {
                  const otherVal = overrides[rec.id] ?? String(rec.otherDeductions)
                  const otherNum = parseFloat(otherVal) || 0
                  const liveNet  = Math.max(0, rec.grossSalary - rec.advanceDeduction - rec.nhifDeduction - rec.nssfDeduction - otherNum)
                  const isDraft  = run.status === 'draft'
                  const isPaid   = Boolean(rec.paymentDate)

                  return (
                    <div key={rec.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="p-4 space-y-2">
                        {/* Name + type */}
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-gray-800">{rec.staff.fullName}</p>
                            <p className="text-xs text-gray-400">
                              {rec.staff.employmentType === 'permanent'
                                ? t('Permanent', 'Kudumu')
                                : t('Contract', 'Mkataba')}
                              {' · '}
                              {rec.staff.paymentMethod === 'mpesa' ? 'M-Pesa' : t('Cash', 'Taslimu')}
                            </p>
                          </div>
                          {isPaid && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                              {t('Paid', 'Imelipwa')} {new Date(rec.paymentDate!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>

                        {/* Deductions grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t('Gross', 'Ghafi')}</span>
                            <span className="font-medium">KES {rec.grossSalary.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">{t('Advance', 'Mkopo')}</span>
                            <span className={rec.advanceDeduction > 0 ? 'text-amber-700 font-medium' : ''}>
                              {rec.advanceDeduction > 0 ? `- KES ${rec.advanceDeduction.toLocaleString()}` : '—'}
                            </span>
                          </div>
                          {rec.nhifDeduction > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">NHIF</span>
                              <span>- KES {rec.nhifDeduction.toLocaleString()}</span>
                            </div>
                          )}
                          {rec.nssfDeduction > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">NSSF</span>
                              <span>- KES {rec.nssfDeduction.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Other deductions — editable if draft */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 shrink-0">{t('Other deductions', 'Punguzo nyingine')}</span>
                          {isDraft ? (
                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-gray-400">KES</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={otherVal}
                                onChange={e => setOverrides(ov => ({ ...ov, [rec.id]: e.target.value }))}
                                onBlur={() => saveOtherDeductions(rec.id)}
                                className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right"
                              />
                            </div>
                          ) : (
                            <span className="ml-auto font-medium">
                              {rec.otherDeductions > 0 ? `- KES ${rec.otherDeductions.toLocaleString()}` : '—'}
                            </span>
                          )}
                        </div>

                        {/* Net pay */}
                        <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                          <span className="text-sm font-bold text-gray-700">{t('Net Pay', 'Malipo Halisi')}</span>
                          <span className="text-base font-bold text-green-700">
                            KES {(isDraft ? liveNet : rec.netPay).toLocaleString()}
                          </span>
                        </div>

                        {/* M-Pesa number */}
                        {rec.staff.paymentMethod === 'mpesa' && rec.staff.mpesaNumber && (
                          <p className="text-xs text-gray-400">M-Pesa: {rec.staff.mpesaNumber}</p>
                        )}

                        {/* Approved: payment date + mark paid */}
                        {!isDraft && !isPaid && (
                          <button
                            onClick={() => markPaid(rec.id)}
                            className="w-full mt-1 border border-green-300 text-green-700 rounded-xl py-1.5 text-xs font-semibold hover:bg-green-50"
                          >
                            {t('Mark Paid', 'Thibitisha Malipo')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}

              {/* Approve button */}
              {run.status === 'draft' && run.records.length > 0 && (
                <button
                  onClick={approveRun}
                  disabled={approving}
                  className="w-full bg-green-700 text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-50 hover:bg-green-800"
                >
                  {approving
                    ? t('Approving...', 'Inaidhinisha...')
                    : t('Approve & Finalise Payroll', 'Idhinisha na Kamilisha Mishahara')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
