export interface EmployeeSummary {
  employee_id: number
  employee_number: string
  full_name: string
  email: string
  designation: string
}

export type UserStatus = 'Active' | 'Pending' | 'Suspended' | 'Disabled'

export interface CurrentUser {
  user_id: number
  email: string
  username: string
  display_name: string
  user_status: UserStatus
  auth_provider: 'local' | 'google' | 'microsoft'
  is_staff: boolean
  employee: EmployeeSummary | null
  role_codes: string[]
  /** Empty when `sees_all_estates` is true — see the backend serializer. */
  estate_ids: number[]
  sees_all_estates: boolean
  mfa_enabled: boolean
  phone_number: string
  job_title: string
  /** A small JPEG data URL, or "" when no picture is set. */
  avatar_data_url: string
}

/**
 * Login either completes, or asks for the second factor. There are no tokens
 * here to carry — they arrive as HttpOnly cookies on the same response
 * (BUG-21) and are never visible to JS.
 */
export type LoginResult =
  | { otp_required: false }
  | { otp_required: true; email: string; expires_in: number }

export interface SsoProvider {
  name: 'google' | 'microsoft'
  configured: boolean
}

export const ROLE = {
  ADMIN: 'BCM_ADMIN',
  COORDINATOR: 'BCM_COORDINATOR',
  REVIEWER: 'BCM_REVIEWER',
  VIEWER: 'BCM_VIEWER',
  APPROVER: 'BCM_APPROVER',
  BU_LEAD: 'BCM_BU_LEAD',
  RISK_OWNER: 'BCM_RISK_OWNER',
  TEST_MANAGER: 'BCM_TEST_MANAGER',
  DOCUMENT_CONTROLLER: 'BCM_DOCUMENT_CONTROLLER',
  AUDITOR: 'BCM_AUDITOR',
} as const

export type RoleCode = (typeof ROLE)[keyof typeof ROLE]
