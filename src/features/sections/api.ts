import { api } from '@/api/client'
import type { Paginated } from '@/features/estates/types'
import type { EmployeeOption } from '@/features/plans/types'

import type { Risk, RiskAction, RiskOptions } from './types'

/**
 * One client for every "rows under a plan version" resource. The shape of the
 * API is uniform (see apps/plans/childviews.py), so the client is too.
 */
export function sectionApi<T>(resource: string) {
  const base = (versionId: number) => `/plan-versions/${versionId}/${resource}/`
  return {
    list: async (versionId: number): Promise<T[]> => (await api.get<T[]>(base(versionId))).data,
    create: async (versionId: number, payload: Record<string, unknown>): Promise<T> =>
      (await api.post<T>(base(versionId), payload)).data,
    update: async (versionId: number, id: number, payload: Record<string, unknown>): Promise<T> =>
      (await api.patch<T>(`${base(versionId)}${id}/`, payload)).data,
    remove: async (versionId: number, id: number): Promise<void> => {
      await api.delete(`${base(versionId)}${id}/`)
    },
    key: (versionId: number) => ['plan-versions', versionId, resource] as const,
  }
}

export const riskActionsApi = {
  async create(versionId: number, riskId: number, payload: Record<string, unknown>): Promise<RiskAction> {
    return (await api.post<RiskAction>(`/plan-versions/${versionId}/risks/${riskId}/actions/`, payload)).data
  },
  async update(
    versionId: number,
    riskId: number,
    actionId: number,
    payload: Record<string, unknown>,
  ): Promise<RiskAction> {
    return (
      await api.patch<RiskAction>(`/plan-versions/${versionId}/risks/${riskId}/actions/${actionId}/`, payload)
    ).data
  },
  async remove(versionId: number, riskId: number, actionId: number): Promise<void> {
    await api.delete(`/plan-versions/${versionId}/risks/${riskId}/actions/${actionId}/`)
  },
}

export async function fetchRiskOptions(versionId: number): Promise<RiskOptions> {
  return (await api.get<RiskOptions>(`/plan-versions/${versionId}/risk-options/`)).data
}

export const riskOptionsKey = (versionId: number) => ['plan-versions', versionId, 'risk-options'] as const

/** Everyone in the directory, for owner pickers. Small orgs only; see EmployeeSelect. */
export async function fetchEmployees(): Promise<EmployeeOption[]> {
  return (await api.get<Paginated<EmployeeOption>>('/employees/', { params: { page_size: 200 } })).data.results
}

export const employeesKey = ['employees', 'all'] as const

export type { Risk }
