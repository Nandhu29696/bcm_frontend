import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { IconBuildings, IconChevronRight } from '@/components/icons'
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '@/components/ui'

import { estateApi, estateKeys } from './api'
import { BCP_STATUS, type BcpStatus, type Estate } from './types'

/** Segment colours for the coverage bar, in the order statuses are stacked. */
const SEGMENT: Record<BcpStatus, string> = {
  Approved: 'bg-status-approved',
  'Pending BU Lead Review': 'bg-status-progress',
  'Work in Progress': 'bg-status-review',
  Rework: 'bg-status-rework',
  Exempted: 'bg-status-exempted',
  'Not Started': 'bg-ink-300',
}
const STACK_ORDER: BcpStatus[] = [
  'Approved',
  'Pending BU Lead Review',
  'Work in Progress',
  'Rework',
  'Exempted',
  'Not Started',
]

/**
 * Journey step 2 — the screen a user lands on after logging in.
 *
 * Each card is a compliance summary: a stacked coverage bar and a per-status
 * breakdown. The rollup is the reason to come here rather than a list of names.
 */
export function EstateListPage() {
  const { data, isPending, error } = useQuery({
    queryKey: estateKeys.all,
    queryFn: estateApi.list,
  })

  if (isPending) {
    return (
      <div className="py-16 text-center">
        <Spinner label="Loading estates" />
      </div>
    )
  }

  if (error) {
    return <Alert>{toApiError(error).detail}</Alert>
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No estates are assigned to you yet"
        description="Estate access is granted by a BCM administrator. Once granted, your estates appear here."
      />
    )
  }

  const totals = summarise(data)

  return (
    <>
      <PageHeader
        title="Estates"
        eyebrow="Overview"
        subtitle={`${data.length} estate${data.length === 1 ? '' : 's'} · ${totals.costCodes} cost codes in your scope`}
      />

      {/* Portfolio strip */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3 animate-fade-up">
        <Stat label="Approved plans" value={totals.approved} tone="text-emerald-700" />
        <Stat label="Awaiting review" value={totals.review} tone="text-amber-700" />
        <Stat label="Not started" value={totals.notStarted} tone="text-ink-700" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((estate, index) => (
          <EstateCard key={estate.estate_id} estate={estate} index={index} />
        ))}
      </div>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-card border border-ink-200/80 bg-white px-5 py-4 shadow-card">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

function EstateCard({ estate, index }: { estate: Estate; index: number }) {
  const present = BCP_STATUS.filter((status) => estate.status_rollup[status] > 0)
  const total = estate.cost_code_count
  const approved = estate.status_rollup.Approved
  const percent = total ? Math.round((100 * approved) / total) : 0

  return (
    <Link
      to={`/estates/${estate.estate_id}/cost-codes`}
      style={{ animationDelay: `${index * 40}ms` }}
      className="group block rounded-card border border-ink-200/80 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-raised animate-fade-up"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-50 text-brand-700">
            <IconBuildings size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-950">{estate.estate_name}</h2>
            <p className="text-xs text-ink-500">
              {total} cost code{total === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <IconChevronRight
          size={18}
          className="mt-2 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
        />
      </div>

      {total === 0 ? (
        <p className="mt-5 text-sm text-ink-500">No cost codes yet.</p>
      ) : (
        <>
          <div className="mt-5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink-600">Plan coverage</span>
            <span className="font-semibold tabular-nums text-ink-900">{percent}% approved</span>
          </div>
          <div
            className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink-100"
            role="img"
            aria-label={`${percent}% of cost codes have an approved plan`}
          >
            {STACK_ORDER.map((status) => {
              const n = estate.status_rollup[status]
              if (!n) return null
              return (
                <span
                  key={status}
                  className={SEGMENT[status]}
                  style={{ width: `${(100 * n) / total}%` }}
                  title={`${status}: ${n}`}
                />
              )
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
            {present.map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <StatusBadge status={status} />
                <span className="text-xs font-semibold tabular-nums text-ink-700">
                  {estate.status_rollup[status]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Link>
  )
}

function summarise(estates: Estate[]) {
  return estates.reduce(
    (acc, e) => ({
      costCodes: acc.costCodes + e.cost_code_count,
      approved: acc.approved + e.status_rollup.Approved,
      review: acc.review + e.status_rollup['Pending BU Lead Review'],
      notStarted: acc.notStarted + e.status_rollup['Not Started'],
    }),
    { costCodes: 0, approved: 0, review: 0, notStarted: 0 },
  )
}
