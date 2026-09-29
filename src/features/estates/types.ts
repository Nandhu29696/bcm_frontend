/** Journey steps 2-3: the estate list and the cost code table. */

/** The six real BCP statuses. Mirrors `apps.plans.models.PlanStatus`. */
export const BCP_STATUS = [
  'Not Started',
  'Work in Progress',
  'Pending BU Lead Review',
  'Approved',
  'Rework',
  'Exempted',
] as const

export type BcpStatus = (typeof BCP_STATUS)[number]

/** A `{id, name}` pair — how the API renders every foreign key on these screens. */
export interface NamedRef {
  id: number
  name: string
}

export interface Estate {
  estate_id: number
  estate_name: string
  cost_code_count: number
  /** Every status is present, zeros included, so the columns never shift. */
  status_rollup: Record<BcpStatus, number>
}

export interface ProcessSummary {
  process_id: number
  process_name: string
  cost_code_count: number
  status_rollup: Record<BcpStatus, number>
}

export interface CostCode {
  cost_code_id: number
  cost_code: string
  estate_id: number
  process: NamedRef | null
  subprocess: NamedRef | null
  region: NamedRef | null
  bu_lead: NamedRef | null
  lob: NamedRef | null
  center: NamedRef | null
  location: NamedRef | null
  bcp_status: BcpStatus
  current_plan_version_id: number | null
  current_version_number: number | null
  active_flag: boolean
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/** Facet options, scoped to one estate. */
export interface FilterOptions {
  process: NamedRef[]
  subprocess: NamedRef[]
  region: NamedRef[]
  bu_lead: NamedRef[]
  bcp_status: BcpStatus[]
}

/** The filter bar's state. Mirrored into the URL so a refresh survives. */
export interface CostCodeFilters {
  cost_code: string
  process: number[]
  subprocess: number[]
  region: number[]
  bu_lead: number[]
  bcp_status: string[]
  ordering: string
  page: number
  page_size: number
}

export const EMPTY_FILTERS: CostCodeFilters = {
  cost_code: '',
  process: [],
  subprocess: [],
  region: [],
  bu_lead: [],
  bcp_status: [],
  ordering: 'cost_code',
  page: 1,
  page_size: 25,
}

/** Which filter keys are multi-select id lists — used by the URL codec. */
export const ID_FILTER_KEYS = ['process', 'subprocess', 'region', 'bu_lead'] as const
