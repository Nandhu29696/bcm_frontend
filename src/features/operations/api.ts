import { api } from '@/api/client'
import type { Paginated } from '@/features/estates/types'

/**
 * Journey step 8 (Phase 8): tests, crisis events, the CMSC roster and call
 * tree runs. Everything hangs off a cost code.
 */

// --------------------------------------------------------------------------- //
// Types
// --------------------------------------------------------------------------- //

export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type Channel = 'VOICE' | 'MS_TEAMS' | 'EMAIL'

export interface RunSummary {
  call_tree_run_id: number
  broadcast_id: string
  call_tree_type: string
  status: RunStatus
  simulation_flag: boolean
  providers_enabled: Record<string, boolean>
  started_at: string | null
  completed_at: string | null
  members: number
  reached: number
  initiated_by_name: string
}

export interface Attempt {
  call_attempt_id: number
  channel: Channel
  attempt_number: number
  attempt_status: string
  status_code: string
  attempted_at: string | null
  response_key: string
  call_duration_seconds: number | null
  comments: string
}

export interface RunMember {
  call_tree_member_id: number
  member_name: string
  member_email: string
  phone_number: string
  sequence_number: number | null
  escalation_level: number | null
  stage: string
  reached_flag: boolean
  reached_channel: Channel | ''
  completed_at: string | null
  attempts: Attempt[]
}

export interface RunDetail extends RunSummary {
  cost_code_id: number | null
  cost_code_label: string
  members_detail: RunMember[]
}

export interface RunReport extends RunSummary {
  unreached: number
  response_rate: number | null
  by_level: {
    level: number
    label: string
    channel: Channel
    members_attempted: number
    members_reached: number
    attempts: number
    response_rate: number | null
  }[]
  by_channel: { channel: Channel; attempts: number; reached: number; statuses: Record<string, number> }[]
}

export type TestType = 'Call Tree Test' | 'Tabletop Exercise' | 'Full Simulation' | 'Walkthrough'
export const TEST_TYPES: TestType[] = ['Call Tree Test', 'Tabletop Exercise', 'Full Simulation', 'Walkthrough']
export type TestStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
export type FinalStatus = 'Passed' | 'Partial' | 'Failed' | 'Pending'
export const FINAL_STATUSES: FinalStatus[] = ['Passed', 'Partial', 'Failed', 'Pending']

export interface TestOutcome {
  test_outcome_id: number
  conducted_date: string | null
  conducted_time: string | null
  result: string
  final_status: FinalStatus | ''
  report: { entity_document_id: number; file_name: string; file_size_bytes: number | null } | null
  created_at: string
}

export interface PlanTest {
  test_id: number
  plan_version_id: number
  version_number: number
  cost_code_id: number
  cost_code_label: string
  process_name: string
  estate_name: string
  test_type: TestType
  scheduled_date: string | null
  scheduled_time: string | null
  status: TestStatus
  comments: string
  initiated_by_name: string
  call_tree_run: RunSummary | null
  outcomes: TestOutcome[]
  created_at: string
  can_manage: boolean
}

export type EventType = 'Table Top' | 'Call tree' | 'Full Simulation' | 'Walkthrough' | 'Live Incident'
export const EVENT_TYPES: EventType[] = ['Live Incident', 'Call tree', 'Table Top', 'Full Simulation', 'Walkthrough']
export type EventStatus = 'Planned' | 'Initiated' | 'In Progress' | 'Closed' | 'Cancelled'

export interface CrisisEvent {
  crisis_event_id: number
  cost_code_id: number
  cost_code_label: string
  process_name: string
  estate_name: string
  plan_version_id: number | null
  csd_ticket_number: string
  event_type: EventType
  comments: string
  event_date: string | null
  event_time: string | null
  initiated_flag: boolean
  status: EventStatus
  call_tree_run: RunSummary | null
  created_by_name: string
  created_at: string
  /** Set once the event first reaches Closed or Cancelled — the end of the
   * Start Date/End Date tracker (event_date/event_time is the start). */
  closed_at: string | null
  can_manage: boolean
}

export interface CmscMember {
  cmsc_member_id: number
  cost_code_id: number
  member_name: string
  member_email: string
  country_code: string
  phone_number: string
  reporting_manager_name: string
  reporting_manager_email: string
  center: string
  location: string
  updated_at: string
}

export type CmscMemberInput = Omit<CmscMember, 'cmsc_member_id' | 'cost_code_id' | 'updated_at'>

export interface UploadResult {
  created: number
  updated: number
  errors: { line: number; error: string }[]
}

export interface TestFilters {
  date_from?: string
  date_to?: string
  status?: string
  test_type?: string
  estate?: number
  cost_code?: string
}

// --------------------------------------------------------------------------- //
// API
// --------------------------------------------------------------------------- //

function clean(params: object) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
}

export const opsApi = {
  // tests
  async tests(filters: TestFilters): Promise<PlanTest[]> {
    const { data } = await api.get<Paginated<PlanTest>>('/tests/', { params: { ...clean(filters), page_size: 500 } })
    return data.results
  },
  async costCodeTests(costCodeId: number): Promise<PlanTest[]> {
    const { data } = await api.get<PlanTest[]>(`/cost-codes/${costCodeId}/tests/`)
    return data
  },
  async test(testId: number): Promise<PlanTest> {
    const { data } = await api.get<PlanTest>(`/tests/${testId}/`)
    return data
  },
  async scheduleTest(costCodeId: number, body: { test_type: TestType; scheduled_date: string; scheduled_time?: string; comments?: string }) {
    const { data } = await api.post<PlanTest>(`/cost-codes/${costCodeId}/tests/`, clean(body))
    return data
  },
  async rescheduleTest(testId: number, body: Partial<{ test_type: TestType; scheduled_date: string; scheduled_time: string | null; comments: string }>) {
    const { data } = await api.patch<PlanTest>(`/tests/${testId}/`, body)
    return data
  },
  async cancelTest(testId: number) {
    const { data } = await api.post<PlanTest>(`/tests/${testId}/cancel/`)
    return data
  },
  async startTestCallTree(testId: number, simulation: boolean) {
    const { data } = await api.post<PlanTest>(`/tests/${testId}/start-call-tree/`, { simulation })
    return data
  },
  async recordOutcome(testId: number, form: FormData) {
    const { data } = await api.post<PlanTest>(`/tests/${testId}/outcome/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },

  // crisis events
  async events(filters: {
    status?: string
    event_type?: string
    estate?: number
    cost_code?: string
    page?: number
    page_size?: number
  }): Promise<Paginated<CrisisEvent>> {
    const { data } = await api.get<Paginated<CrisisEvent>>('/crisis-events/', { params: clean(filters) })
    return data
  },
  async costCodeEvents(costCodeId: number): Promise<CrisisEvent[]> {
    const { data } = await api.get<CrisisEvent[]>(`/cost-codes/${costCodeId}/crisis-events/`)
    return data
  },
  async event(eventId: number): Promise<CrisisEvent> {
    const { data } = await api.get<CrisisEvent>(`/crisis-events/${eventId}/`)
    return data
  },
  async declareEvent(
    costCodeId: number,
    body: { event_type: EventType; csd_ticket_number?: string; comments?: string; event_date?: string; event_time?: string; initiate: boolean; simulation: boolean },
  ) {
    const { data } = await api.post<CrisisEvent>(`/cost-codes/${costCodeId}/crisis-events/`, clean(body))
    return data
  },
  async initiateEvent(eventId: number, simulation: boolean) {
    const { data } = await api.post<CrisisEvent>(`/crisis-events/${eventId}/initiate/`, { simulation })
    return data
  },
  async closeEvent(eventId: number, comments: string) {
    const { data } = await api.post<CrisisEvent>(`/crisis-events/${eventId}/close/`, { comments })
    return data
  },
  async cancelEvent(eventId: number) {
    const { data } = await api.post<CrisisEvent>(`/crisis-events/${eventId}/cancel/`)
    return data
  },

  // roster
  async roster(costCodeId: number): Promise<{ results: CmscMember[]; can_manage: boolean }> {
    const { data } = await api.get<{ results: CmscMember[]; can_manage: boolean }>(`/cost-codes/${costCodeId}/cmsc-members/`)
    return data
  },
  async addMember(costCodeId: number, body: CmscMemberInput) {
    const { data } = await api.post<CmscMember>(`/cost-codes/${costCodeId}/cmsc-members/`, body)
    return data
  },
  async editMember(memberId: number, body: Partial<CmscMemberInput>) {
    const { data } = await api.patch<CmscMember>(`/cmsc-members/${memberId}/`, body)
    return data
  },
  async removeMember(memberId: number) {
    await api.delete(`/cmsc-members/${memberId}/`)
  },
  async uploadRoster(costCodeId: number, file: File): Promise<UploadResult> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<UploadResult>(`/cost-codes/${costCodeId}/cmsc-members/upload/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // call tree runs
  async run(runId: number): Promise<RunDetail> {
    const { data } = await api.get<RunDetail>(`/call-tree-runs/${runId}/`)
    return data
  },
  async runReport(runId: number): Promise<RunReport> {
    const { data } = await api.get<RunReport>(`/call-tree-runs/${runId}/report/`)
    return data
  },
  async costCodeRuns(costCodeId: number): Promise<RunSummary[]> {
    const { data } = await api.get<RunSummary[]>(`/cost-codes/${costCodeId}/call-tree-runs/`)
    return data
  },
  async providerStatus(): Promise<ProviderStatus> {
    const { data } = await api.get<ProviderStatus>('/call-tree-providers/')
    return data
  },
}

/** Which call tree channels are actually live in this environment. */
export interface ProviderStatus {
  VOICE: boolean
  MS_TEAMS: boolean
  EMAIL: boolean
}

export const opsKeys = {
  tests: (filters: TestFilters) => ['tests', filters] as const,
  costCodeTests: (id: number) => ['cost-codes', id, 'tests'] as const,
  test: (id: number) => ['tests', 'detail', id] as const,
  events: (filters: Record<string, unknown>) => ['crisis-events', filters] as const,
  costCodeEvents: (id: number) => ['cost-codes', id, 'crisis-events'] as const,
  event: (id: number) => ['crisis-events', 'detail', id] as const,
  roster: (id: number) => ['cost-codes', id, 'roster'] as const,
  run: (id: number) => ['call-tree-runs', id] as const,
  runReport: (id: number) => ['call-tree-runs', id, 'report'] as const,
  costCodeRuns: (id: number) => ['cost-codes', id, 'call-tree-runs'] as const,
  providerStatus: ['call-tree-providers'] as const,
}

export const CHANNEL_LABEL: Record<Channel, string> = { VOICE: 'Voice', MS_TEAMS: 'Teams', EMAIL: 'Email' }
