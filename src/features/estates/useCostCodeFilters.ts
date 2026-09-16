import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EMPTY_FILTERS, ID_FILTER_KEYS, type CostCodeFilters } from './types'

/**
 * Filter state lives in the URL, not in component state.
 *
 * That is what makes a filtered view shareable and survivable: a reload, a
 * back-button press or a pasted link all reproduce the same table. Holding it in
 * `useState` instead would reset the whole filter bar on every refresh, which on
 * a screen users keep open all day is the difference between a tool and a chore.
 *
 * The URL is the single source of truth — there is no mirrored copy in state to
 * drift out of sync with it.
 */
export function useCostCodeFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<CostCodeFilters>(() => {
    const ids = (key: string) =>
      searchParams
        .getAll(key)
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0)

    const page = Number(searchParams.get('page') ?? '1')
    const pageSize = Number(searchParams.get('page_size') ?? EMPTY_FILTERS.page_size)

    return {
      cost_code: searchParams.get('cost_code') ?? '',
      process: ids('process'),
      subprocess: ids('subprocess'),
      region: ids('region'),
      bu_lead: ids('bu_lead'),
      bcp_status: searchParams.getAll('bcp_status'),
      ordering: searchParams.get('ordering') || EMPTY_FILTERS.ordering,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      page_size:
        Number.isFinite(pageSize) && pageSize > 0 ? pageSize : EMPTY_FILTERS.page_size,
    }
  }, [searchParams])

  const write = useCallback(
    (next: CostCodeFilters) => {
      const params = new URLSearchParams()
      if (next.cost_code.trim()) params.set('cost_code', next.cost_code.trim())
      for (const key of ID_FILTER_KEYS) {
        for (const id of next[key]) params.append(key, String(id))
      }
      for (const status of next.bcp_status) params.append('bcp_status', status)
      if (next.ordering !== EMPTY_FILTERS.ordering) params.set('ordering', next.ordering)
      if (next.page !== 1) params.set('page', String(next.page))
      if (next.page_size !== EMPTY_FILTERS.page_size) {
        params.set('page_size', String(next.page_size))
      }
      // `replace` so twenty keystrokes in the cost code box do not bury the
      // previous screen under twenty history entries.
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  /** Change one filter. Any change but paging returns to page 1. */
  const setFilter = useCallback(
    <K extends keyof CostCodeFilters>(key: K, value: CostCodeFilters[K]) => {
      write({ ...filters, [key]: value, page: key === 'page' ? (value as number) : 1 })
    },
    [filters, write],
  )

  /** Add or remove one value from a multi-select filter. */
  const toggleValue = useCallback(
    (key: 'process' | 'subprocess' | 'region' | 'bu_lead' | 'bcp_status', raw: number | string) => {
      if (key === 'bcp_status') {
        const current = filters.bcp_status
        const value = String(raw)
        setFilter(
          'bcp_status',
          current.includes(value)
            ? current.filter((item) => item !== value)
            : [...current, value],
        )
        return
      }
      const current = filters[key]
      const value = Number(raw)
      setFilter(
        key,
        current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      )
    },
    [filters, setFilter],
  )

  /** Toggle sort direction on a column, or switch to it ascending. */
  const toggleOrdering = useCallback(
    (field: string) => {
      const next = filters.ordering === field ? `-${field}` : field
      write({ ...filters, ordering: next, page: 1 })
    },
    [filters, write],
  )

  const clear = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const activeCount =
    (filters.cost_code.trim() ? 1 : 0) +
    filters.process.length +
    filters.subprocess.length +
    filters.region.length +
    filters.bu_lead.length +
    filters.bcp_status.length

  return { filters, setFilter, toggleValue, toggleOrdering, clear, activeCount }
}
