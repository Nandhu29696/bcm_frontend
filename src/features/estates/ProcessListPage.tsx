import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { IconArrowLeft, IconChevronRight } from '@/components/icons'
import { Alert, EmptyState, Input, PageHeader, Spinner, StatusBadge } from '@/components/ui'

import { estateApi, estateKeys } from './api'
import { BCP_STATUS, type ProcessSummary } from './types'

const STATUS_ORDER = BCP_STATUS.filter((status) => status !== 'Not Started')

export function ProcessListPage() {
  const { estateId: estateIdParam } = useParams()
  const estateId = Number(estateIdParam)
  const [search, setSearch] = useState('')

  const estate = useQuery({
    queryKey: estateKeys.detail(estateId),
    queryFn: () => estateApi.get(estateId),
    enabled: Number.isInteger(estateId),
  })
  const processes = useQuery({
    queryKey: estateKeys.processes(estateId),
    queryFn: () => estateApi.processes(estateId),
    enabled: Number.isInteger(estateId),
  })

  const visibleProcesses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return processes.data ?? []
    return (processes.data ?? []).filter((process) => process.process_name.toLowerCase().includes(term))
  }, [processes.data, search])

  if (!Number.isInteger(estateId)) return <Alert>That estate address is not valid.</Alert>
  if (estate.error || processes.error) {
    const failure = toApiError(estate.error ?? processes.error)
    return <Alert>{failure.code === 'not_found' ? 'That estate is not in your scope.' : failure.detail}</Alert>
  }
  if (estate.isPending || processes.isPending) {
    return (
      <div className="py-16 text-center">
        <Spinner label="Loading processes" />
      </div>
    )
  }

  const totalCostCodes = (processes.data ?? []).reduce((total, process) => total + process.cost_code_count, 0)

  return (
    <>
      <PageHeader
        title={estate.data.estate_name}
        eyebrow="Choose a process"
        subtitle={`${processes.data.length} process${processes.data.length === 1 ? '' : 'es'} · ${totalCostCodes} cost codes`}
      >
        <Link
          to={`/estates/${estateId}/cost-codes`}
          className="rounded-control border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-card hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          View all cost codes
        </Link>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/estates" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <IconArrowLeft size={14} /> All estates
        </Link>
        {processes.data.length > 0 && (
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search processes"
            aria-label="Search processes"
            className="w-full sm:w-72"
          />
        )}
      </div>

      {processes.data.length === 0 ? (
        <EmptyState
          title="No processes are available"
          description="There are no accessible cost codes assigned to this estate yet."
        />
      ) : visibleProcesses.length === 0 ? (
        <EmptyState
          title="No processes match your search"
          description="Try a different process name."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProcesses.map((process, index) => (
            <ProcessCard key={process.process_id} process={process} estateId={estateId} index={index} />
          ))}
        </div>
      )}
    </>
  )
}

function ProcessCard({ process, estateId, index }: { process: ProcessSummary; estateId: number; index: number }) {
  const total = process.cost_code_count
  const approved = process.status_rollup.Approved
  const percent = total ? Math.round((100 * approved) / total) : 0

  return (
    <Link
      to={`/estates/${estateId}/processes/${process.process_id}/cost-codes`}
      style={{ animationDelay: `${index * 40}ms` }}
      className="group block rounded-card border border-ink-200/80 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-raised animate-fade-up"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-brand-950">{process.process_name}</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {total} cost code{total === 1 ? '' : 's'}
          </p>
        </div>
        <IconChevronRight size={18} className="mt-1 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>

      <div className="mt-5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-600">Plan coverage</span>
        <span className="font-semibold tabular-nums text-ink-900">{percent}% approved</span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`${percent}% of process cost codes have an approved plan`}>
        {BCP_STATUS.map((status) => {
          const count = process.status_rollup[status]
          if (!count) return null
          return <span key={status} className={statusColor(status)} style={{ width: `${(100 * count) / total}%` }} title={`${status}: ${count}`} />
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
        {STATUS_ORDER.map((status) => {
          const count = process.status_rollup[status]
          if (!count) return null
          return (
            <li key={status} className="flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span className="text-xs font-semibold tabular-nums text-ink-700">{count}</span>
            </li>
          )
        })}
        {process.status_rollup['Not Started'] > 0 && (
          <li className="text-xs font-medium text-ink-500">{process.status_rollup['Not Started']} not started</li>
        )}
      </ul>
    </Link>
  )
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    Approved: 'bg-status-approved',
    'Pending BU Lead Review': 'bg-status-progress',
    'Work in Progress': 'bg-status-review',
    Rework: 'bg-status-rework',
    Exempted: 'bg-status-exempted',
    'Not Started': 'bg-ink-300',
  }
  return colors[status] ?? 'bg-ink-300'
}
