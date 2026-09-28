/** BUMDes roles from live frontend-siabumdes / sm85-arch. */
export type Role =
  | 'admin'
  | 'direktur'
  | 'bendahara'
  | 'pengelola'
  | 'pengawas'
  | 'penasihat'

export interface User {
  id: string
  username: string
  name: string
  role: Role
  email?: string | null
  photo_url?: string | null
  unit_usaha_id?: string | null
  must_change_password?: boolean
}

export interface UnitUsaha {
  id: string
  name?: string
  business_type?: string
}
