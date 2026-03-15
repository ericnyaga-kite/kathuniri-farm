import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLang } from '../../store/langStore'
import { TeaPage } from './TeaPage'
import { DairyPage } from './DairyPage'
import { RentalPage } from './RentalPage'
import { StaffPage } from './StaffPage'

function OwnerHome() {
  const { user } = useAuthStore()
  const { t } = useLang()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-green-800 mb-1">Kathuniri Farm</h1>
      <p className="text-sm text-gray-500 mb-6">{t('Welcome', 'Karibu')}, {user?.name}</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: 'chai',   icon: '🍃', label: t('Tea', 'Chai') },
          { to: 'maziwa', icon: '🥛', label: t('Dairy', 'Maziwa') },
          { to: 'nyumba', icon: '🏠', label: t('Rental', 'Nyumba') },
          { to: 'staff',  icon: '👷', label: t('Staff', 'Wafanyakazi') },
        ].map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-2 text-center"
          >
            <span className="text-4xl">{item.icon}</span>
            <span className="font-semibold text-gray-700">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function OwnerShell() {
  const { user, logout } = useAuthStore()
  const { lang, init, toggle, t } = useLang()

  useEffect(() => {
    if (user?.id) init(user.id)
  }, [user?.id])

  function handleToggle() {
    if (user?.id) toggle(user.id)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between">
        <NavLink to="/owner" className="font-bold text-lg">🌿 Kathuniri Farm</NavLink>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded-lg font-semibold tracking-wide"
          >
            {lang === 'en' ? 'SW' : 'EN'}
          </button>
          <button onClick={logout} className="text-sm opacity-80 hover:opacity-100">
            {t('Sign out', 'Toka')}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Routes>
          <Route index element={<OwnerHome />} />
          <Route path="chai"   element={<TeaPage />} />
          <Route path="maziwa" element={<DairyPage />} />
          <Route path="nyumba" element={<RentalPage />} />
          <Route path="staff"  element={<StaffPage />} />
        </Routes>
      </main>
    </div>
  )
}
