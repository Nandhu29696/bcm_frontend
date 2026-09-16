import { api } from '@/api/client'

/** Phase 9: dashboard, help library, reports. */

export interface StatusRow {
  id: number | null
  name: string
  total: number
  [status: string]: number | string | null
}

export interface Dashboard {
  generated_at: string
  estate_id: number | null
  totals: {
    cost_codes: number
    by_status: Record<string, number>
    approved: number
    in_flight: number
    not_started: number
    exempted: number
    approval_rate: number | null
  }
  status_by_estate: StatusRow[]
  status_by_region: StatusRow[]
  status_by_lob: StatusRow[]
  completion: { open_versions: number; sections_total: number; sections_completed: number; percent: number | null }
  risk: {
    total: number
    by_level: Record<string, number>
    heat_map: { likelihood: { points: number; label: string }[]; severity: { points: number; label: string }[]; cells: number[][] }
    open_actions: number
    overdue_actions: number
    overdue: {
      risk_action_id: number
      risk_name: string
      cost_code: string
      cost_code_id: number
      plan_version_id: number
      action_type: string
      status: string
      owner: string
      target_date: string
      days_overdue: number
    }[]
  }
  tests: {
    by_status: Record<string, number>
    by_type: Record<string, number>
    coverage: { months: number; tested_cost_codes: number; cost_codes: number; percent: number | null }
    upcoming: { test_id: number; test_type: string; cost_code: string; scheduled_date: string | null }[]
  }
  call_tree: {
    runs: number
    live_runs: number
    simulation_runs: number
    members: number
    reached: number
    response_rate: number | null
    reached_by_channel: Record<string, number>
    recent: { call_tree_run_id: number; broadcast_id: string; cost_code: string; simulation_flag: boolean; started_at: string | null; members: number; reached: number }[]
  }
  exemptions: {
    by_status: Record<string, number>
    total: number
    register: { exemption_id: number; cost_code: string; cost_code_id: number; plan_version_id: number; status: string; reason: string; requested_by: string; created_at: string }[]
  }
}

export interface HelpResource {
  help_resource_id: number
  title: string
  description: string
  category: string
  display_order: number | null
  document: { entity_document_id: number | null; file_name: string; file_size_bytes: number | null; mime_type: string } | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface ReportRequest {
  report_request_id: number
  report_type: string
  report_type_label: string
  report_format: string
  parameters: { estate_id?: number }
  schedule: string
  active_flag: boolean
  next_run_at: string | null
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  last_error: string
  run_count: number
  last_run_at: string | null
  created_at: string
  document: { entity_document_id: number; file_name: string; file_size_bytes: number | null } | null
}

export interface ReportTypes {
  types: { code: string; label: string; formats: string[] }[]
  schedules: { code: string; label: string }[]
}

export const insightsApi = {
  dashboard: async (estateId: number | null): Promise<Dashboard> =>
    (await api.get('/dashboard/', { params: estateId ? { estate: estateId } : {} })).data,

  help: async (q: string, category: string): Promise<{ results: HelpResource[]; can_manage: boolean }> =>
    (await api.get('/help/', { params: { ...(q ? { q } : {}), ...(category ? { category } : {}) } })).data,
  helpCategories: async (): Promise<string[]> => (await api.get('/help/categories/')).data,
  createHelp: async (form: FormData): Promise<HelpResource> =>
    (await api.post('/help/', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  editHelp: async (id: number, form: FormData): Promise<HelpResource> =>
    (await api.patch(`/help/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  deleteHelp: async (id: number): Promise<void> => {
    await api.delete(`/help/${id}/`)
  },

  reportTypes: async (): Promise<ReportTypes> => (await api.get('/reports/types/')).data,
  reportRequests: async (): Promise<ReportRequest[]> => (await api.get('/reports/requests/')).data,
  requestReport: async (body: { report_type: string; report_format: string; schedule: string; estate_id?: number | null }): Promise<ReportRequest> =>
    (await api.post('/reports/requests/', body)).data,
  runReport: async (id: number): Promise<ReportRequest> => (await api.post(`/reports/requests/${id}/run/`)).data,
  stopReport: async (id: number): Promise<ReportRequest> => (await api.post(`/reports/requests/${id}/stop/`)).data,
  estateDetailFile: async (estateId: number | null, fileFormat: string): Promise<Blob> =>
    (
      await api.get('/reports/estate-detail/', {
        params: { file_format: fileFormat, ...(estateId ? { estate: estateId } : {}) },
        responseType: 'blob',
      })
    ).data,
}

export const insightsKeys = {
  dashboard: (estateId: number | null) => ['dashboard', estateId] as const,
  help: (q: string, category: string) => ['help', q, category] as const,
  helpCategories: ['help', 'categories'] as const,
  reportTypes: ['reports', 'types'] as const,
  reportRequests: ['reports', 'requests'] as const,
}
