import { create } from 'zustand'

type Lang = 'en' | 'sw'

interface LangStore {
  lang: Lang
  init: (userId: string) => void
  toggle: (userId: string) => void
  t: (en: string, sw: string) => string
}

function storageKey(userId: string) {
  return `kf-lang-${userId}`
}

export const useLang = create<LangStore>((set, get) => ({
  lang: 'en',

  init: (userId) => {
    const stored = localStorage.getItem(storageKey(userId))
    if (stored === 'en' || stored === 'sw') {
      set({ lang: stored })
    } else {
      set({ lang: 'en' }) // default for new users
    }
  },

  toggle: (userId) => {
    const next: Lang = get().lang === 'en' ? 'sw' : 'en'
    localStorage.setItem(storageKey(userId), next)
    set({ lang: next })
  },

  t: (en, sw) => get().lang === 'en' ? en : sw,
}))
