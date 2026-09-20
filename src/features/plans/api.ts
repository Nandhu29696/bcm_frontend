import { api } from '@/api/client'
import type { Paginated } from '@/features/estates/types'

import type {
  Coordinator,
  CostCodeDetail,
  CostCodeEdit,
  EmployeeOption,
  HistoryEntry,
  MasterData,
  PlanVersion,
  PlanVersionList,
} from './types'

export const plansApi = {
  async costCode(costCodeId: number): Promise<CostCodeDetail> {
    const { data } = await api.get<CostCodeDetail>(`/cost-codes/${costCodeId}/`)
    return data
  },

  async editCostCode(
    costCodeId: number,
    changes: Partial<CostCodeEdit>,
  ): Promise<CostCodeDetail> {
    const { data } = await api.patch<CostCodeDetail>(`/cost-codes/${costCodeId}/`, changes)
    return data
  },

  async version(planVersionId: number): Promise<PlanVersion> {
    const { data } = await api.get<PlanVersion>(`/plan-versions/${planVersionId}/`)
    return data
  },

  async versions(costCodeId: number): Promise<PlanVersionList> {
    const { data } = await api.get<PlanVersionList>(
      `/cost-codes/${costCodeId}/plan-versions/`,
    )
    return data
  },

  /** Creates the plan and its first version if none exist (3.6). Idempotent. */
  async ensureVersion(costCodeId: number): Promise<PlanVersion> {
    const { data } = await api.post<PlanVersion>(`/cost-codes/${costCodeId}/plan-versions/`)
    return data
  },

  async copyVersion(planVersionId: number, comments: string): Promise<PlanVersion> {
    const { data } = await api.post<PlanVersion>(`/plan-versions/${planVersionId}/copy/`, {
      comments,
    })
    return data
  },

  async history(planVersionId: number): Promise<HistoryEntry[]> {
    const { data } = await api.get<HistoryEntry[]>(`/plan-versions/${planVersionId}/history/`)
    return data
  },

  async coordinators(planVersionId: number): Promise<Coordinator[]> {
    const { data } = await api.get<Coordinator[]>(
      `/plan-versions/${planVersionId}/coordinators/`,
    )
    return data
  },

  async assignCoordinator(
    planVersionId: number,
    payload: {
      employee: number
      coordinator_type: string
      additional_user_flag: boolean
      /** Take the role over from whoever holds it. */
      replace?: boolean
    },
  ): Promise<Coordinator> {
    const { data } = await api.post<Coordinator>(
      `/plan-versions/${planVersionId}/coordinators/`,
      payload,
    )
    return data
  },

  async removeCoordinator(planVersionId: number, assignmentId: number): Promise<void> {
    await api.delete(`/plan-versions/${planVersionId}/coordinators/${assignmentId}/`)
  },

  async searchEmployees(search: string): Promise<EmployeeOption[]> {
    const { data } = await api.get<Paginated<EmployeeOption>>('/employees/', {
      params: { search, page_size: 20 },
    })
    return data.results
  },
}

export const planKeys = {
  costCode: (id: number) => ['cost-codes', id] as const,
  version: (id: number) => ['plan-versions', id] as const,
  versions: (id: number) => ['cost-codes', id, 'versions'] as const,
  history: (versionId: number) => ['plan-versions', versionId, 'history'] as const,
  coordinators: (versionId: number) => ['plan-versions', versionId, 'coordinators'] as const,
  employees: (search: string) => ['employees', search] as const,
}

export async function fetchMasterData(): Promise<MasterData> {
  const { data } = await api.get<MasterData>('/master-data/')
  return data
}

export const masterDataKey = ['master-data'] as const
