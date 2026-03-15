import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLang } from '../../store/langStore'
import { MilkEntryPage } from './MilkEntryPage'
import { PickingEntryPage } from './PickingEntryPage'
import { HomePage } from './HomePage'

export function ManagerShell() {
  const { user } = useAuthStore()
  const { lang, init, toggle, t } = useLang()

  useEffect(() => {
    if (user?.id) init(user.id)
  }, [user?.id])

  function handleToggle() {
    if (user?.id) toggle(user.id)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="maziwa" element={<MilkEntryPage />} />
          <Route path="chai" element={<PickingEntryPage />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-4 h-20">
        <NavLink
          to="/manager"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-xs font-medium ${
              isActive ? 'text-green-700' : 'text-gray-500'
            }`
          }
        >
          <span className="text-2xl">🏠</span>
          {t('Home', 'Nyumbani')}
        </NavLink>
        <NavLink
          to="/manager/maziwa"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-xs font-medium ${
              isActive ? 'text-green-700' : 'text-gray-500'
            }`
          }
        >
          <span className="text-2xl">🥛</span>
          {t('Milk', 'Maziwa')}
        </NavLink>
        <NavLink
          to="/manager/chai"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-xs font-medium ${
              isActive ? 'text-green-700' : 'text-gray-500'
            }`
          }
        >
          <span className="text-2xl">🍃</span>
          {t('Tea', 'Chai')}
        </NavLink>
        <button
          onClick={handleToggle}
          className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-gray-500"
        >
          <span className="text-2xl">🌐</span>
          {lang === 'en' ? 'SW' : 'EN'}
        </button>
      </nav>
    </div>
  )
}
