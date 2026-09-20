import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { pageOf } from '@/components/paging'
import { Alert, EmptyState, PageHeader, Pager, Select, StatusBadge, TableSkeleton } from '@/components/ui'
import { formatDateTime } from '@/features/plans/format'

import { reviewApi, reviewKeys } from './api'
import { ReviewActions } from './ReviewActions'

/**
 * The BU lead's review queue (Phase 6.2): every plan awaiting them, oldest
 * first, with approve / send back on the row and a link to the read-only plan.
 * Coordinators see the same list filtered to their own submissions, so they
 * can tell where a plan is without asking.
 *
 * Three figures across the top say how much is waiting and for how long; the
 * "Mine to decide" filter narrows the table to what the caller can act on.
 */
export function ReviewQueuePage() {
  const queue = useQuery({ queryKey: reviewKeys.queue, queryFn: reviewApi.queue })
  const [searchParams, setSearchParams] = useSearchParams()
  const show = searchParams.get('show') === 'mine' ? 'mine' : 'all'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: true })
  }

  if (queue.isPending) {
    return (
      <>
        <PageHeader title="Reviews" eyebrow="Plans awaiting a decision" />
        <TableSkeleton cols={6} label="Loading review queue" />
      </>
    )
  }
  if (queue.error) return <Alert>{toApiError(queue.error).detail}</Alert>

  const all = queue.data
  const mine = all.filter((r) => r.can_review)
  const rows = show === 'mine' ? mine : all
  const oldest = all.reduce<number>((days, r) => Math.max(days, daysSince(r.submitted_at)), 0)

  return (
    <>
      <PageHeader
        title="Reviews"
        eyebrow="Plans awaiting a decision"
        subtitle={all.length === 0 ? 'Nothing is waiting.' : `${all.length} pending${mine.length ? ` · ${mine.length} for you to decide` : ''}`}
      />

      {all.length > 0 && (
        <section aria-label="Queue summary" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="Waiting for you" value={mine.length} tone={mine.length ? 'brand' : 'ink'} sub={mine.length ? 'you can approve or send back' : 'nothing needs your decision'} />
          <Figure label="Pending in total" value={all.length} tone="amber" sub="across the plans you can see" />
          <Figure label="Longest wait" value={oldest} unit={oldest === 1 ? 'day' : 'days'} tone={oldest > 7 ? 'red' : 'ink'} sub="since it was submitted" />
        </section>
      )}

      {all.length === 0 ? (
        <EmptyState
          title="No plans are waiting for review"
          description="Submitted plans appear here until they are approved or sent back. BU leads see the plans they lead; coordinators see their own submissions."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              Queue <span className="ml-1 rounded-full bg-ink-100 px-2 py-0.5 tabular-nums text-ink-600">{rows.length}</span>
            </span>
            <div className="w-44">
              <Select value={show} onChange={(e) => setParam('show', e.target.value === 'mine' ? 'mine' : '')} aria-label="Show">
                <option value="all">All pending</option>
                <option value="mine">Mine to decide</option>
              </Select>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">Nothing here needs your decision.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Version</th>
                    <th>Coordinators</th>
                    <th>BU lead</th>
                    <th>Waiting</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(rows, page).map((row) => {
                    const days = daysSince(row.submitted_at)
                    return (
                      <tr key={row.plan_version_id}>
                        <td>
                          <Link to={`/cost-codes/${row.cost_code_id}`} className="font-medium text-brand-700 hover:underline">
                            {row.cost_code}
                          </Link>
                          <span className="block text-xs text-ink-500">
                            {row.process_name || '—'} · {row.estate_name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="mr-2 tabular-nums">v{row.version_number}</span>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {row.coordinators.length === 0 ? (
                            <span className="text-ink-400">—</span>
                          ) : (
                            row.coordinators.map((c) => (
                              <span key={c.coordinator_assignment_id} className="block">
                                <span className="text-ink-900">{c.name}</span>
                                {c.coordinator_type && <span className="ml-1 text-ink-400">{c.coordinator_type}</span>}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">{row.bu_lead_name || <span className="text-ink-400">—</span>}</td>
                        <td className="whitespace-nowrap">
                          <span className={`font-medium tabular-nums ${days > 7 ? 'text-red-700' : 'text-ink-900'}`}>
                            {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
                          </span>
                          <span className="block text-xs text-ink-500">{formatDateTime(row.submitted_at)}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/plan-versions/${row.plan_version_id}`}
                              className="inline-flex h-8 items-center rounded-control border border-ink-200 bg-white px-3 text-xs font-medium text-ink-800 shadow-card hover:bg-ink-50"
                            >
                              Open plan
                            </Link>
                            {row.can_review && <ReviewActions version={row} compact />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} total={rows.length} onPage={(n) => setParam('page', String(n))} label="Review queue pages" />
        </div>
      )}
    </>
  )
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function Figure({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: number
  unit?: string
  sub?: string
  tone: 'brand' | 'amber' | 'red' | 'ink'
}) {
  const tones = { brand: 'text-brand-700', amber: 'text-amber-700', red: 'text-red-700', ink: 'text-ink-700' }
  return (
    <div className="rounded-card border border-ink-200/80 bg-white px-4 py-3 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </div>
  )
}
