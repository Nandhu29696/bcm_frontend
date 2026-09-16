/** Structured plan sections (Phase 5). Shapes mirror the DRF serializers. */

export interface EmployeeRef {
  id: number
  name: string
  email: string
}

export interface ServiceDescription {
  service_description_id: number
  plan_version_id: number
  process: number
  process_name: string
  subprocess: number | null
  subprocess_name: string | null
  cost_code: number | null
  owner_employee: EmployeeRef | null
  process_description: string
  mao: string
  mbco: string
  rto: string
  rpo: string
}

export interface CriticalContact {
  critical_contact_id: number
  employee: EmployeeRef | null
  contact_type: string
  shift_timings: string
  primary_phone: string
  alternate_phone: string
  seat_count: number | null
  voice_non_voice: string
  asset_id: string
  asset_make: string
  hardware_software: string
}

export interface NetworkRequirement {
  network_requirement_id: number
  employee: EmployeeRef | null
  requirement_type: 'BIA_PROJECT' | 'BCP_PLAN'
  source_ip: string
  destination_ip: string
  port_number: string
  connectivity_type: string
  comments: string
}

export interface RiskAction {
  risk_action_id: number
  risk_id: number
  action_type: 'MITIGATION' | 'CONTINGENCY'
  description: string
  status: string
  target_date: string | null
  comments: string
  resource_type: string
  is_overdue: boolean
}

export interface Risk {
  risk_id: number
  owner_employee: EmployeeRef | null
  resource_type: string
  risk_name: string
  description: string
  impact_area: string
  likelihood_rating: string | null
  likelihood_label: string | null
  severity_rating: string | null
  severity_label: string | null
  control_effectiveness_rating: string | null
  control_effectiveness_label: string | null
  /** Derived on the server. Never sent by the client. */
  inherent_risk_score: string | null
  residual_risk_score: string | null
  risk_level: 'High' | 'Moderate' | 'Low' | ''
  target_closure_date: string | null
  occurred_flag: boolean | null
  comments: string
  actions: RiskAction[]
  open_action_count: number
  overdue_action_count: number
}

export interface RecoveryStrategy {
  recovery_strategy_id: number
  owner_employee: EmployeeRef | null
  core_strategy: string
  tactical_strategy: string
}

export interface RatingOption {
  points: string
  label: string
}

export interface RiskOptions {
  ratings: {
    likelihood_rating: RatingOption[]
    severity_rating: RatingOption[]
    control_effectiveness_rating: RatingOption[]
  }
  resource_types: string[]
  risk_names: string[]
  action_statuses: { MITIGATION: string[]; CONTINGENCY: string[] }
  core_strategies: string[]
  tactical_strategies: string[]
}
