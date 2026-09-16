/** Journey step 4: everything reachable from a cost code row. */

import type { BcpStatus, NamedRef } from '@/features/estates/types'

export interface CostCodeDetail {
  cost_code_id: number
  cost_code: string
  estate: NamedRef | null
  process: NamedRef | null
  subprocess: NamedRef | null
  region: NamedRef | null
  bu_lead: NamedRef | null
  lob: NamedRef | null
  center: NamedRef | null
  location: NamedRef | null
  active_flag: boolean
  created_at: string
  updated_at: string
}

/** The editable subset. `estate` is deliberately absent — see the serializer. */
export interface CostCodeEdit {
  cost_code: string
  process: number | null
  subprocess: number | null
  region: number | null
  bu_lead: number | null
  lob: number | null
  center: number | null
  location: number | null
}

export interface Coordinator {
  coordinator_assignment_id: number
  employee_id: number
  name: string
  email: string
  coordinator_type: string
  additional_user_flag: boolean
}

export interface PlanVersion {
  plan_version_id: number
  plan_id: number
  cost_code_id: number
  cost_code: string
  version_number: number
  status: BcpStatus
  plan_mode: string
  review_mode: string
  published_flag: boolean
  copied_flag: boolean
  is_current: boolean
  is_editable: boolean
  /** False while another version of the plan is still open. */
  can_copy: boolean
  approved_at: string | null
  approved_by_name: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  coordinators: Coordinator[]
}

export interface PlanVersionList {
  plan_id: number | null
  versions: PlanVersion[]
}

export interface HistoryEntry {
  plan_status_history_id: number
  plan_version_id: number
  status: BcpStatus
  comments: string
  changed_at: string
  changed_by_name: string
}

export interface EmployeeOption {
  employee_id: number
  full_name: string
  email: string
  employee_number: string
}

/** Option lists for the editor — global, with parent ids for narrowing. */
export interface MasterData {
  process: { id: number; name: string }[]
  subprocess: { id: number; name: string; process_id: number }[]
  region: { id: number; name: string }[]
  location: { id: number; name: string; region_id: number | null }[]
  center: { id: number; name: string; location_id: number | null }[]
  bu_lead: { id: number; name: string }[]
  lob: { id: number; name: string }[]
}
