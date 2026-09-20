import { api } from '@/api/client'
import type { EmployeeSummary, UserStatus } from '@/features/auth/types'
import type { Paginated } from '@/features/estates/types'

/** User administration: accounts, roles, estate scopes and the second factor. */

export interface AdminUser {
  user_id: number
  email: string
  display_name: string
  user_status: UserStatus
  auth_provider: 'local' | 'google' | 'microsoft'
  is_active: boolean
  is_staff: boolean
  mfa_enabled: boolean
  employee: EmployeeSummary | null
  role_codes: string[]
  estate_ids: number[]
  created_at: string
  last_login: string | null
}

export interface AdminUserPatch {
  display_name?: string
  user_status?: UserStatus
  is_active?: boolean
  mfa_enabled?: boolean
  employee_id?: number | null
  role_codes?: string[]
  estate_ids?: number[]
}

export interface EmployeeBulkUploadResult {
  created: number
  updated: number
  estates_created: number
  errors: { row: number; detail: string }[]
}

export interface Role {
  role_id: number
  role_code: string
  role_name: string
  active_flag: boolean
}

export interface UserFilters {
  search?: string
  user_status?: string
  auth_provider?: string
  is_active?: string
  page?: number
}

export const adminApi = {
  users: async (filters: UserFilters): Promise<Paginated<AdminUser>> =>
    (
      await api.get('/admin/users/', {
        params: Object.fromEntries(Object.entries({ ...filters, page_size: 5 }).filter(([, v]) => v !== '' && v !== undefined)),
      })
    ).data,
  user: async (id: number): Promise<AdminUser> => (await api.get(`/admin/users/${id}/`)).data,
  patchUser: async (id: number, body: AdminUserPatch): Promise<AdminUser> => (await api.patch(`/admin/users/${id}/`, body)).data,
  roles: async (): Promise<Role[]> => {
    const { data } = await api.get<Paginated<Role> | Role[]>('/roles/', { params: { page_size: 100 } })
    return Array.isArray(data) ? data : data.results
  },
  employees: async (search: string): Promise<EmployeeSummary[]> => {
    const { data } = await api.get<Paginated<EmployeeSummary>>('/employees/', { params: { search, page_size: 10 } })
    return data.results
  },
  uploadEmployees: async (file: File): Promise<EmployeeBulkUploadResult> => {
    const body = new FormData()
    body.append('file', file)
    return (await api.post('/admin/employees/bulk-upload/', body)).data
  },
  downloadEmployeeTemplate: async (): Promise<Blob> =>
    (await api.get('/admin/employees/bulk-upload/', { responseType: 'blob' })).data,
}

export const adminKeys = {
  users: (filters: UserFilters) => ['admin', 'users', filters] as const,
  roles: ['admin', 'roles'] as const,
  employees: (search: string) => ['admin', 'employees', search] as const,
}
