import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { IconArrowLeft } from '@/components/icons'
import { Alert, Button, EmptyState, PageHeader, Pager, Spinner, StatusBadge } from '@/components/ui'

import { estateApi, estateKeys } from './api'
import { FilterBar } from './FilterBar'
import { RowActions } from './RowActions'
import type { CostCode, NamedRef } from './types'
import { useCostCodeFilters } from './useCostCodeFilters'

/**
 * The table is server-driven: filtering, sorting and pagination all happen in
 * the database, because an estate can hold tens of thousands of cost codes and
 * only a page of them is ever sent. So no client-side row models are enabled —
 * TanStack Table is used purely for column definitions and rendering.
 */
const features = tableFeatures({})
const column = createColumnHelper<typeof features, CostCode>()

/** Column id -> the API ordering field it maps to. */
const ORDERING: Record<string, string> = {
  cost_code: 'cost_code',
  process: 'process__process_name',
  subprocess: 'subprocess__subprocess_name',
  region: 'region__region_name',
  bu_lead: 'bu_lead__lead_name',
  bcp_status: 'current_bcp_status',
}

const SEARCH_DEBOUNCE_MS = 300

function refName(value: NamedRef | null) {
  return value ? value.name : <span className="text-ink-400">—</span>
}

// `column.columns([...])` rather than a bare array: it preserves each column's
// own value type through the tuple. A plain array widens them to a union and the
// whole list stops matching ColumnDef.
const columns = column.columns([
  column.accessor('cost_code', {
    header: 'Cost code',
    cell: (info) => (
      <Link
        to={`/cost-codes/${info.row.original.cost_code_id}`}
        className="whitespace-nowrap font-medium text-brand-700 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  column.accessor('process', { header: 'Process', cell: (info) => refName(info.getValue()) }),
  column.accessor('subprocess', {
    header: 'Subprocess',
    cell: (info) => refName(info.getValue()),
  }),
  column.accessor('region', { header: 'Region', cell: (info) => refName(info.getValue()) }),
  column.accessor('bu_lead', { header: 'BU lead', cell: (info) => refName(info.getValue()) }),
  column.accessor('bcp_status', {
    header: 'BCP status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  column.accessor('current_version_number', {
    header: 'Version',
    cell: (info) => {
      const version = info.getValue()
      const versionId = info.row.original.current_plan_version_id
      return version === null ? (
        <span className="text-ink-400">—</span>
      ) : versionId ? (
        <Link to={`/plan-versions/${versionId}`} className="tabular-nums text-brand-700 hover:underline" title="Open the current plan">
          v{version}
        </Link>
      ) : (
        <span className="tabular-nums text-ink-700">v{version}</span>
      )
    },
  }),
  column.display({
    id: 'actions',
    header: '',
    cell: (info) => <RowActions costCode={info.row.original} />,
  }),
])

export function CostCodeListPage() {
  const { estateId: estateIdParam, processId: processIdParam } = useParams()
  const navigate = useNavigate()
  const estateId = Number(estateIdParam)
  const processId = processIdParam ? Number(processIdParam) : undefined
  const { filters, setFilter, toggleValue, toggleOrdering, clear, activeCount } =
    useCostCodeFilters()

  useEffect(() => {
    if (!processId || !Number.isInteger(processId)) return
    if (filters.process.length !== 1 || filters.process[0] !== processId) {
      setFilter('process', [processId])
    }
  }, [filters.process, processId, setFilter])

  // The cost code box is typed into, so it is debounced before it reaches the
  // URL and the API. Local state is the input's value; the URL stays the source
  // of truth for everything the query reads.
  const [searchText, setSearchText] = useState(filters.cost_code)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const onTextChange = useCallback(
    (value: string) => {
      setSearchText(value)
      clearTimeout(debounce.current)
      debounce.current = setTimeout(
        () => setFilter('cost_code', value),
        SEARCH_DEBOUNCE_MS,
      )
    },
    [setFilter],
  )

  const onClear = useCallback(() => {
    clearTimeout(debounce.current)
    setSearchText('')
    clear()
  }, [clear])

  useEffect(() => () => clearTimeout(debounce.current), [])

  const estate = useQuery({
    queryKey: estateKeys.detail(estateId),
    queryFn: () => estateApi.get(estateId),
    enabled: Number.isInteger(estateId),
  })

  const processes = useQuery({
    queryKey: estateKeys.processes(estateId),
    queryFn: () => estateApi.processes(estateId),
    enabled: Number.isInteger(estateId) && Number.isInteger(processId),
  })

  const options = useQuery({
    queryKey: estateKeys.filterOptions(estateId),
    queryFn: () => estateApi.filterOptions(estateId),
    enabled: Number.isInteger(estateId),
    // Facets change only when cost codes are added or retired.
    staleTime: 5 * 60_000,
  })

  const costCodes = useQuery({
    queryKey: estateKeys.costCodes(estateId, filters),
    queryFn: () => estateApi.costCodes(estateId, filters),
    enabled: Number.isInteger(estateId),
    // Keep the previous page on screen while the next one loads, so changing a
    // filter does not collapse the table to a spinner and back.
    placeholderData: keepPreviousData,
  })

  const rows = costCodes.data?.results ?? []
  const table = useTable({ features, columns, data: rows })

  if (!Number.isInteger(estateId)) {
    return <Alert>That estate address is not valid.</Alert>
  }

  if (estate.error) {
    const failure = toApiError(estate.error)
    return (
      <Alert>
        {failure.code === 'not_found'
          ? 'That estate is not in your scope.'
          : failure.detail}
      </Alert>
    )
  }

  const total = costCodes.data?.count ?? 0

  return (
    <>
      <PageHeader
        title={
          processes.data?.find((process) => process.process_id === processId)?.process_name ??
          estate.data?.estate_name ??
          'Cost codes'
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to="/estates" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <IconArrowLeft size={14} /> All estates
            </Link>
            {processId && (
              <>
                <span className="text-ink-300">/</span>
                <Link to={`/estates/${estateId}/processes`} className="text-brand-700 hover:underline">
                  {estate.data?.estate_name ?? 'Processes'}
                </Link>
              </>
            )}
          </span>
        }
      >
        <div className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 shadow-card">
          {costCodes.isFetching ? (
            <Spinner label="Updating" />
          ) : (
            <>
              <span className="font-semibold text-ink-900">{total}</span> cost code
              {total === 1 ? '' : 's'}
              {activeCount > 0 && ' matching your filters'}
            </>
          )}
        </div>
      </PageHeader>

      <FilterBar
        filters={{ ...filters, cost_code: searchText }}
        options={options.data}
        optionsLoading={options.isPending}
        activeCount={activeCount}
        onTextChange={onTextChange}
        onToggle={toggleValue}
        onClear={onClear}
        lockedProcessName={processes.data?.find((process) => process.process_id === processId)?.process_name}
      />

      {costCodes.error ? (
        <Alert>{toApiError(costCodes.error).detail}</Alert>
      ) : costCodes.isPending ? (
        <div className="py-12 text-center">
          <Spinner label="Loading cost codes" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={activeCount > 0 ? 'No cost codes match these filters' : 'No cost codes yet'}
          description={
            activeCount > 0
              ? 'Try removing a filter to widen the search.'
              : 'Cost codes for this estate have not been set up.'
          }
        >
          {activeCount > 0 && (
            <Button variant="secondary" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <div className="max-h-[calc(100vh-22rem)] overflow-auto">
            <table className="data-table compact estate-table">
              <thead className="sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const field = ORDERING[header.column.id]
                      const active =
                        filters.ordering === field || filters.ordering === `-${field}`
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            !active
                              ? 'none'
                              : filters.ordering.startsWith('-')
                                ? 'descending'
                                : 'ascending'
                          }
                        >
                          {field ? (
                            <button
                              type="button"
                              onClick={() => toggleOrdering(field)}
                              className={`-mx-1 inline-flex items-center gap-1 rounded px-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:text-ink-900 ${active ? 'text-brand-700' : ''}`}
                            >
                              <table.FlexRender header={header} />
                              <span aria-hidden="true" className={active ? 'text-brand-600' : 'text-ink-300'}>
                                {!active ? '↕' : filters.ordering.startsWith('-') ? '↓' : '↑'}
                              </span>
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  // The whole row opens the cost code; links and the row menu
                  // inside it keep their own targets.
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a, button, [role="menu"]')) return
                      navigate(`/cost-codes/${row.original.cost_code_id}`)
                    }}
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pager page={filters.page} pageSize={filters.page_size} total={total} onPage={(page) => setFilter('page', page)} label="Cost code pages" />
        </div>
      )}
    </>
  )
}
