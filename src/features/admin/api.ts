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

export interface AdminEmployeeDetail {
  employee_id: number
  employee_number: string
  full_name: string
  email: string
  designation: string
  domain_name: string
  gender: string
  contact_number: string
  employment_status: string
  date_of_joining: string | null
  last_working_date: string | null
  manager_employee: string | null
  supervisor_employee: string | null
  bu_lead: string | null
  bu_classification: string | null
  center: string | null
  process: string | null
  subprocess: string | null
  cost_code: string | null
  current_location: string | null
  estate: string | null
  location: string | null
  region: string | null
  lob: string | null
  employee_group: string | null
  employee_grade: string | null
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
  estate?: number
  process?: number
  cost_code?: string
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
  employeeDetail: async (id: number): Promise<AdminEmployeeDetail> =>
    (await api.get(`/admin/users/${id}/employee/`)).data,
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
