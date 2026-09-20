import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { Button, StatusBadge } from '@/components/ui'
import { ReviewActions } from '@/features/review/ReviewActions'
import { DocumentsPanel, ExemptionPanel } from '@/features/review/VersionExtras'

import { formatDateTime } from './format'
import type { PlanVersion } from './types'

const PREVIOUS_PAGE_SIZE = 5

/**
 * Current versus previous versions (Phase 3.3).
 *
 * The current version is shown as a card with its actions; previous ones as a
 * compact list beneath it. Both are the same shape from the API — "current" is
 * derived there from the highest version number, never stored.
 */
export function VersionList({
  versions,
  canAuthor,
  onAssign,
  onHistory,
  onCopy,
}: {
  versions: PlanVersion[]
  canAuthor: boolean
  onAssign: (version: PlanVersion) => void
  onHistory: (version: PlanVersion) => void
  onCopy: (version: PlanVersion) => void
}) {
  const current = versions.find((v) => v.is_current)
  const previous = versions.filter((v) => !v.is_current)
  const [previousPage, setPreviousPage] = useState(1)
  const previousPageCount = Math.ceil(previous.length / PREVIOUS_PAGE_SIZE)

  useEffect(() => {
    setPreviousPage((page) => Math.min(page, Math.max(previousPageCount, 1)))
  }, [previousPageCount])

  const visiblePrevious = previous.slice(
    (previousPage - 1) * PREVIOUS_PAGE_SIZE,
    previousPage * PREVIOUS_PAGE_SIZE,
  )

  return (
    <div className="space-y-4">
      {current && (
        <section
          aria-label="Current version"
          className="relative overflow-hidden rounded-card border border-brand-200 bg-white p-5 shadow-card"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-600" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-ink-900">
                  Version {current.version_number}
                </h3>
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Current
                </span>
                <StatusBadge status={current.status} />
              </div>
              <VersionMeta version={current} />
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <Link to={`/plan-versions/${current.plan_version_id}`}>
                <Button>{current.is_editable && canAuthor ? 'Open plan' : 'View plan'}</Button>
              </Link>
              <div className="flex flex-wrap gap-2">
                {canAuthor && (
                  <Button variant="secondary" onClick={() => onAssign(current)}>
                    Assign coordinator
                  </Button>
                )}
                <Button variant="secondary" onClick={() => onHistory(current)}>
                  History
                </Button>
                {canAuthor && current.can_copy && (
                  <Button variant="secondary" onClick={() => onCopy(current)}>
                    New version
                  </Button>
                )}
              </div>
              <ReviewActions version={current} framed />
            </div>
          </div>
          <Coordinators version={current} />
          <ExemptionPanel version={current} />
          <DocumentsPanel version={current} canAuthor={canAuthor} />
        </section>
      )}

      {previous.length > 0 && (
        <section aria-label="Previous versions">
          <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Previous versions
          </h3>
          <ul className="divide-y divide-ink-100 rounded-card border border-ink-200/80 bg-white shadow-card">
            {visiblePrevious.map((version) => (
              <li
                key={version.plan_version_id}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      Version {version.version_number}
                    </span>
                    <StatusBadge status={version.status} />
                  </div>
                  <VersionMeta version={version} />
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-self-end">
                  <Link to={`/plan-versions/${version.plan_version_id}`}>
                    <Button variant="ghost">View</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => onHistory(version)}>
                    History
                  </Button>
                  {canAuthor && version.can_copy && (
                    <Button variant="ghost" onClick={() => onCopy(version)}>
                      Copy as new
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {previousPageCount > 1 && (
            <nav
              aria-label="Previous version pages"
              className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 text-xs text-ink-500"
            >
              <span>
                Showing {(previousPage - 1) * PREVIOUS_PAGE_SIZE + 1}-
                {Math.min(previousPage * PREVIOUS_PAGE_SIZE, previous.length)} of {previous.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviousPage((page) => page - 1)}
                  disabled={previousPage === 1}
                  aria-label="Previous versions page"
                >
                  Previous
                </Button>
                <span aria-live="polite" className="min-w-16 text-center">
                  Page {previousPage} of {previousPageCount}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviousPage((page) => page + 1)}
                  disabled={previousPage === previousPageCount}
                  aria-label="Next versions page"
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  )
}

function VersionMeta({ version }: { version: PlanVersion }) {
  return (
    <p className="mt-1 text-xs text-ink-500">
      Created {formatDateTime(version.created_at)}
      {version.created_by_name && ` by ${version.created_by_name}`}
      {version.approved_at && (
        <>
          {' · '}Approved {formatDateTime(version.approved_at)}
          {version.approved_by_name && ` by ${version.approved_by_name}`}
        </>
      )}
      {version.copied_flag && ' · copied from a previous version'}
    </p>
  )
}

function Coordinators({ version }: { version: PlanVersion }) {
  if (version.coordinators.length === 0) {
    return <p className="mt-3 text-sm text-amber-700">No coordinator assigned yet.</p>
  }
  return (
    <p className="mt-3 text-sm text-ink-700">
      <span className="text-ink-500">Coordinators: </span>
      {version.coordinators.map((c, index) => (
        <span key={c.coordinator_assignment_id}>
          {index > 0 && ', '}
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-ink-500"> ({c.coordinator_type})</span>
        </span>
      ))}
    </p>
  )
}
