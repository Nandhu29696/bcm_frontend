import { api } from '@/api/client'

import type {
  CostCode,
  CostCodeFilters,
  Estate,
  FilterOptions,
  Paginated,
  ProcessSummary,
} from './types'

/**
 * Repeated query parameters are how the API expresses "one of these":
 * `?process=1&process=2`. `URLSearchParams` with an array value would stringify
 * to `process=1,2`, which django-filter reads as a single invalid id, so array
 * values are appended one at a time.
 */
function toParams(filters: CostCodeFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.cost_code.trim()) params.set('cost_code', filters.cost_code.trim())
  for (const key of ['process', 'subprocess', 'region', 'bu_lead'] as const) {
    for (const id of filters[key]) params.append(key, String(id))
  }
  for (const status of filters.bcp_status) params.append('bcp_status', status)

  if (filters.ordering) params.set('ordering', filters.ordering)
  params.set('page', String(filters.page))
  params.set('page_size', String(filters.page_size))
  return params
}

export const estateApi = {
  async list(): Promise<Estate[]> {
    // Estates are few; one generous page beats paging a landing screen.
    const { data } = await api.get<Paginated<Estate>>('/estates/', {
      params: { page_size: 100, ordering: 'estate_name' },
    })
    return data.results
  },

  async get(estateId: number): Promise<Estate> {
    const { data } = await api.get<Estate>(`/estates/${estateId}/`)
    return data
  },

  async processes(estateId: number): Promise<ProcessSummary[]> {
    const { data } = await api.get<ProcessSummary[]>(
      `/estates/${estateId}/processes/`,
    )
    return data
  },

  async costCodes(
    estateId: number,
    filters: CostCodeFilters,
  ): Promise<Paginated<CostCode>> {
    const { data } = await api.get<Paginated<CostCode>>(
      `/estates/${estateId}/cost-codes/`,
      { params: toParams(filters) },
    )
    return data
  },

  async filterOptions(estateId: number): Promise<FilterOptions> {
    const { data } = await api.get<FilterOptions>(
      `/estates/${estateId}/cost-code-filters/`,
    )
    return data
  },
}

export const estateKeys = {
  all: ['estates'] as const,
  detail: (id: number) => ['estates', id] as const,
  processes: (id: number) => ['estates', id, 'processes'] as const,
  costCodes: (id: number, filters: CostCodeFilters) =>
    ['estates', id, 'cost-codes', filters] as const,
  filterOptions: (id: number) => ['estates', id, 'filter-options'] as const,
}
