import api, { API } from '@/api/client'
import type { AuditLogRow, DriveStatus, OrgProfile, UnitUsaha, User } from '@/types'

export async function fetchAuditLog(limit = 200): Promise<AuditLogRow[]> {
  const r = await api.get<AuditLogRow[]>('/audit-log', { params: { limit } })
  return r.data ?? []
}

export async function fetchUsers(): Promise<User[]> {
  const r = await api.get<User[]>('/users')
  return r.data ?? []
}

export async function createUser(body: Record<string, unknown>) {
  const r = await api.post<User>('/users', body)
  return r.data
}

export async function updateUser(id: string, body: Record<string, unknown>) {
  const r = await api.put<User>(`/users/${id}`, body)
  return r.data
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`)
}

export async function resetUserPassword(id: string, newPassword: string) {
  await api.post(`/users/${id}/reset-password`, { new_password: newPassword })
}

export async function updateBlockedPeriods(id: string, periods: string[]) {
  await api.put(`/users/${id}/blocked-periods`, { blocked_periods: periods })
}

export async function fetchOrgProfile(): Promise<OrgProfile> {
  const r = await api.get<OrgProfile>('/org-profile')
  return r.data
}

export async function updateOrgProfile(body: OrgProfile) {
  const r = await api.put<OrgProfile>('/org-profile', body)
  return r.data
}

export async function createUnit(body: Partial<UnitUsaha>) {
  const r = await api.post<UnitUsaha>('/unit-usaha', body)
  return r.data
}

export async function updateUnit(id: string, body: Partial<UnitUsaha>) {
  const r = await api.patch<UnitUsaha>(`/unit-usaha/${id}`, body)
  return r.data
}

export async function fetchDriveStatus(): Promise<DriveStatus> {
  const r = await api.get<DriveStatus>('/admin/gdrive/status')
  return r.data
}

export async function fetchDriveConnectUrl(): Promise<string> {
  const r = await api.get<{ auth_url: string }>('/admin/gdrive/connect')
  return r.data.auth_url
}

export async function updateProfile(body: { name: string; username: string; email: string }) {
  const r = await api.put('/auth/profile', body)
  return r.data
}

export async function uploadProfilePhoto(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await api.post('/auth/profile/photo', fd)
  return r.data
}

export { API }
