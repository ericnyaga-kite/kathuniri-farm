import { Routes, Route, NavLink } from 'react-router-dom'
import { MilkEntryPage } from './MilkEntryPage'
import { PickingEntryPage } from './PickingEntryPage'
import { HomePage } from './HomePage'

export function ManagerShell() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="maziwa" element={<MilkEntryPage />} />
          <Route path="chai" element={<PickingEntryPage />} />
        </Routes>
      </main>

      {/* Bottom nav — large touch targets */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-3 h-20">
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
          Nyumbani
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
          Maziwa
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
          Chai
        </NavLink>
      </nav>
    </div>
  )
}
