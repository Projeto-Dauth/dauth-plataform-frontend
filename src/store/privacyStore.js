import { create } from 'zustand'

const KEY = 'dauth_hide_values'

const usePrivacyStore = create((set, get) => ({
  hidden: localStorage.getItem(KEY) === '1',

  toggle: () => {
    const next = !get().hidden
    localStorage.setItem(KEY, next ? '1' : '0')
    set({ hidden: next })
  },
}))

export default usePrivacyStore
