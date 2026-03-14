import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  role: 'manager' | 'owner'
}

interface AuthState {
  user: User | null
  pin: string | null   // hashed PIN for manager (stored locally)
  setUser: (user: User) => void
  setPin: (pin: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      pin: null,
      setUser: (user) => set({ user }),
      setPin: (pin) => set({ pin }),
      logout: () => set({ user: null, pin: null }),
    }),
    { name: 'kfarm-auth' }
  )
)
