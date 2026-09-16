import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { formatDateTime } from '@/features/plans/format'

import { reviewApi, reviewKeys } from './api'
import { ReviewActions } from './ReviewActions'

/**
 * The BU lead's review queue (Phase 6.2): every plan awaiting them, oldest
 * first, with approve / send back on the row and a link to the read-only plan.
 * Coordinators see the same list filtered to their own submissions, so they
 * can tell where a plan is without asking.
 */
export function ReviewQueuePage() {
  const queue = useQuery({ queryKey: reviewKeys.queue, queryFn: reviewApi.queue })

  if (queue.isPending) {
    return (
      <div className="py-16 text-center">
        <Spinner label="Loading review queue" />
      </div>
    )
  }
  if (queue.error) return <Alert>{toApiError(queue.error).detail}</Alert>

  const reviewable = queue.data.filter((r) => r.can_review).length

  return (
    <>
      <PageHeader
        title="Reviews"
        eyebrow="Plans awaiting a decision"
        subtitle={
          queue.data.length === 0
            ? 'Nothing is waiting.'
            : `${queue.data.length} pending${reviewable ? ` · ${reviewable} for you to decide` : ''}`
        }
      />

      {queue.data.length === 0 ? (
        <EmptyState
          title="No plans are waiting for review"
          description="Submitted plans appear here until they are approved or sent back."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cost code</th>
                <th>Process</th>
                <th>Estate</th>
                <th>Version</th>
                <th>Coordinators</th>
                <th>Waiting since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queue.data.map((row) => (
                <tr key={row.plan_version_id}>
                  <td>
                    <Link to={`/cost-codes/${row.cost_code_id}`} className="font-medium text-brand-700 hover:underline">
                      {row.cost_code}
                    </Link>
                  </td>
                  <td>{row.process_name}</td>
                  <td>{row.estate_name}</td>
                  <td>
                    <span className="mr-2 tabular-nums">v{row.version_number}</span>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.coordinators.map((c) => c.name).join(', ') || '—'}</td>
                  <td className="whitespace-nowrap text-ink-500">{formatDateTime(row.submitted_at)}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
