import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface Room {
  id: string
  roomNumber: number
  tenantName: string | null
  monthlyRentKes: number | null
  occupancyStatus: string
  currentMonthRentPaid: number
  currentMonthTotalPaid: number
  latestElectricityReading: { meterReading: number } | null
}

type SubTab = 'rent' | 'electricity'

export function RentalEntryPage() {
  const { t } = useLang()
  const [rooms,      setRooms]     = useState<Room[]>([])
  const [loading,    setLoading]   = useState(true)
  const [subTab,     setSubTab]    = useState<SubTab>('rent')
  const [roomId,     setRoomId]    = useState('')

  // Rent form
  const [amount,     setAmount]    = useState('')
  const [method,     setMethod]    = useState<'mpesa' | 'cash'>('mpesa')
  const [mpesaRef,   setMpesaRef]  = useState('')
  const [rentSaved,  setRentSaved] = useState(false)
  const [rentSaving, setRentSaving]= useState(false)
  const [rentError,  setRentError] = useState('')

  // Electricity form
  const [prevReading, setPrevReading] = useState('')
  const [newReading,  setNewReading]  = useState('')
  const [elecSaved,   setElecSaved]   = useState(false)
  const [elecSaving,  setElecSaving]  = useState(false)
  const [elecError,   setElecError]   = useState('')

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => {
    fetch(`${API}/api/rental/rooms?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: Room[]) => {
        if (Array.isArray(data)) {
          setRooms(data.filter(r => r.occupancyStatus === 'occupied'))
          if (data.length > 0) setRoomId(data[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedRoom = rooms.find(r => r.id === roomId)

  function selectRoom(id: string) {
    setRoomId(id)
    setRentSaved(false); setElecSaved(false)
    setAmount(''); setMpesaRef('')
    setPrevReading(''); setNewReading('')
    setRentError(''); setElecError('')
    // Pre-fill prev meter reading
    const room = rooms.find(r => r.id === id)
    if (room?.latestElectricityReading) {
      setPrevReading(String(room.latestElectricityReading.meterReading))
    }
  }

  // Auto pre-fill amount to remaining balance
  useEffect(() => {
    if (!selectedRoom) return
    const balance = (selectedRoom.monthlyRentKes ?? 0) - selectedRoom.currentMonthRentPaid
    if (balance > 0) setAmount(String(balance))
  }, [roomId, rooms])

  async function handleRentSave() {
    if (!amount || !roomId) { setRentError(t('Enter amount','Weka kiasi')); return }
    setRentSaving(true); setRentError('')
    try {
      const today = new Date().toISOString().split('T')[0]
      const r = await fetch(`${API}/api/rental/rooms/${roomId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          paymentDate: today, periodMonth: month, periodYear: year,
          rentAmountKes: parseFloat(amount), electricityAmountKes: 0,
          paymentMethod: method, mpesaRef: mpesaRef || undefined,
        }),
      })
      if (!r.ok) throw new Error()
      setRentSaved(true); setAmount(''); setMpesaRef('')
      // Refresh rooms
      fetch(`${API}/api/rental/rooms?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token()}` },
      }).then(x => x.json()).then((data: Room[]) => {
        if (Array.isArray(data)) setRooms(data.filter(r => r.occupancyStatus === 'occupied'))
      }).catch(() => {})
    } catch { setRentError(t('Failed. Try again.','Imeshindwa. Jaribu tena.')) }
    finally  { setRentSaving(false) }
  }

  async function handleElecSave() {
    if (!newReading || !roomId) { setElecError(t('Enter new reading','Weka usomaji mpya')); return }
    setElecSaving(true); setElecError('')
    try {
      const today = new Date().toISOString().split('T')[0]
      const r = await fetch(`${API}/api/rental/rooms/${roomId}/electricity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          readingDate: today,
          meterReading: parseFloat(newReading),
          previousReading: prevReading ? parseFloat(prevReading) : undefined,
        }),
      })
      if (!r.ok) throw new Error()
      setElecSaved(true); setNewReading('')
    } catch { setElecError(t('Failed. Try again.','Imeshindwa. Jaribu tena.')) }
    finally  { setElecSaving(false) }
  }

  const units = newReading && prevReading ? parseFloat(newReading) - parseFloat(prevReading) : null
  const elecCost = units && units > 0 ? units * 30 : null

  return (
    <div className="p-3">
      <div className="flex items-baseline gap-2 mb-3">
        <h1 className="text-xl font-bold text-green-800">{t('Rent Collection','Kukusanya Kodi')}</h1>
        <span className="text-xs text-gray-400">{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">{t('Loading…','Inapakia…')}</p>}

      {!loading && (
        <>
          {/* Room chips — horizontal scroll */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('Room','Chumba')}</p>
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide mb-3">
              {rooms.map(r => {
                const paid = r.currentMonthRentPaid >= (r.monthlyRentKes ?? 0) && (r.monthlyRentKes ?? 0) > 0
                return (
                  <button key={r.id} onClick={() => selectRoom(r.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-2xl font-bold text-sm relative ${
                      roomId === r.id ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-700'
                    }`}>
                    {t('Rm','Rm')} {r.roomNumber}
                    {paid && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected room info */}
          {selectedRoom && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4 text-sm space-y-0.5">
              {selectedRoom.tenantName && <p className="font-semibold text-gray-800">{selectedRoom.tenantName}</p>}
              <div className="flex gap-4 text-xs text-gray-500 mt-1">
                {selectedRoom.monthlyRentKes && <span>{t('Rent','Kodi')}: KES {selectedRoom.monthlyRentKes.toLocaleString()}</span>}
                {selectedRoom.currentMonthRentPaid > 0 && <span className="text-green-600">{t('Paid','Amelipa')}: KES {selectedRoom.currentMonthRentPaid.toLocaleString()}</span>}
              </div>
            </div>
          )}

          {/* Sub tabs */}
          <div className="flex gap-2 mb-3">
            {(['rent', 'electricity'] as SubTab[]).map(st => (
              <button key={st} onClick={() => setSubTab(st)}
                className={`flex-1 py-2 rounded-2xl text-sm font-bold ${subTab === st ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {st === 'rent' ? `💵 ${t('Rent','Kodi')}` : `⚡ ${t('Meter','Mita')}`}
              </button>
            ))}
          </div>

          {/* Rent form */}
          {subTab === 'rent' && (
            rentSaved ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-5xl">✅</p>
                <p className="text-xl font-bold text-green-700">{t('Payment recorded!','Malipo yameandikwa!')}</p>
                <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl" onClick={() => setRentSaved(false)}>
                  {t('Record Another','Ingiza Nyingine')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('Amount (KES)','Kiasi (KES)')}</p>
                  <input type="number" inputMode="decimal" placeholder="0" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full text-2xl font-bold text-center border-b-2 border-green-400 focus:outline-none py-1 bg-transparent" />
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('Method','Njia')}</p>
                  <div className="flex gap-2">
                    {(['mpesa', 'cash'] as const).map(m => (
                      <button key={m} onClick={() => setMethod(m)}
                        className={`flex-1 py-2 rounded-2xl font-bold text-sm ${method === m ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {m === 'mpesa' ? '📱 M-PESA' : `💵 ${t('Cash','Taslimu')}`}
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'mpesa' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('M-PESA Ref','Nambari ya M-PESA')}</p>
                    <input type="text" placeholder="QRA..." value={mpesaRef} onChange={e => setMpesaRef(e.target.value.toUpperCase())}
                      className="w-full text-lg font-bold text-center border-b-2 border-green-400 focus:outline-none py-1 bg-transparent tracking-widest" />
                  </div>
                )}

                {rentError && <p className="text-red-600 text-sm text-center">{rentError}</p>}

                <button onClick={handleRentSave} disabled={rentSaving || !amount}
                  className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl text-base disabled:opacity-40">
                  {rentSaving ? t('Saving…','Inahifadhi…') : `✓ ${t('Record Payment','Hifadhi Malipo')}`}
                </button>
              </div>
            )
          )}

          {/* Electricity form */}
          {subTab === 'electricity' && (
            elecSaved ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-5xl">✅</p>
                <p className="text-xl font-bold text-green-700">{t('Reading saved!','Usomaji umehifadhiwa!')}</p>
                <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl" onClick={() => setElecSaved(false)}>
                  {t('Record Another','Ingiza Nyingine')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-2xl border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('Previous','Mwisho')}</p>
                    <input type="number" inputMode="decimal" placeholder="0" value={prevReading}
                      onChange={e => setPrevReading(e.target.value)}
                      className="w-full text-xl font-bold text-center border-b-2 border-gray-300 focus:outline-none py-1 bg-transparent" />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('New Reading','Mpya')}</p>
                    <input type="number" inputMode="decimal" placeholder="0" value={newReading}
                      onChange={e => setNewReading(e.target.value)}
                      className="w-full text-xl font-bold text-center border-b-2 border-yellow-400 focus:outline-none py-1 bg-transparent" />
                  </div>
                </div>

                {units !== null && units > 0 && (
                  <div className="bg-yellow-50 rounded-2xl px-3 py-2 text-sm flex justify-between">
                    <span className="text-gray-600">{units} {t('units','vitengo')} × KES 30</span>
                    <span className="font-bold text-amber-700">KES {elecCost?.toLocaleString()}</span>
                  </div>
                )}

                {elecError && <p className="text-red-600 text-sm text-center">{elecError}</p>}

                <button onClick={handleElecSave} disabled={elecSaving || !newReading}
                  className="w-full bg-amber-500 text-white font-bold py-3 rounded-2xl text-base disabled:opacity-40">
                  {elecSaving ? t('Saving…','Inahifadhi…') : `✓ ${t('Save Reading','Hifadhi Usomaji')}`}
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
