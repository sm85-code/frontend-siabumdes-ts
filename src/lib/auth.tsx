import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import api from '@/api/client'
import type { User } from '@/types'

const AuthCtx = createContext<AuthContextValue | null>(null)
const USER_KEY = 'bumdes_user'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>
  refreshUser: () => Promise<User>
  logout: () => Promise<void>
}

function readCachedUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as User | null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then((r) => {
        setUser(r.data)
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(r.data))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        try {
          localStorage.removeItem(USER_KEY)
        } catch {
          /* ignore */
        }
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.post<{ user: User }>('/auth/login', { username, password })
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(r.data.user))
    } catch {
      /* ignore */
    }
    setUser(r.data.user)
    return r.data.user
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    const r = await api.get<User>('/auth/me')
    setUser(r.data)
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(r.data))
    } catch {
      /* ignore */
    }
    return r.data
  }, [])

  const refreshUser = useCallback(async () => {
    const r = await api.get<User>('/auth/me')
    setUser(r.data)
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(r.data))
    } catch {
      /* ignore */
    }
    return r.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo(
    () => ({ user, login, changePassword, refreshUser, logout, loading }),
    [user, login, changePassword, refreshUser, logout, loading],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { can } from '@/config/roles'
