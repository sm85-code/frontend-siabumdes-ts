import api from '@/api/client'
import type { User } from '@/types'

export async function fetchMe(): Promise<User> {
  const r = await api.get<User>('/auth/me')
  return r.data
}

export async function loginRequest(username: string, password: string): Promise<User> {
  const r = await api.post<{ user: User }>('/auth/login', { username, password })
  return r.data.user
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout')
}

export async function changePasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
