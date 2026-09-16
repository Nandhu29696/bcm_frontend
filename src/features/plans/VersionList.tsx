import { Link } from 'react-router-dom'

import { Button, StatusBadge } from '@/components/ui'
import { ReviewActions } from '@/features/review/ReviewActions'
import { DocumentsPanel, ExemptionPanel } from '@/features/review/VersionExtras'

import { formatDateTime } from './format'
import type { PlanVersion } from './types'

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
            <div className="flex flex-wrap gap-2">
              <Link to={`/plan-versions/${current.plan_version_id}`}>
                <Button>{current.is_editable && canAuthor ? 'Open plan' : 'View plan'}</Button>
              </Link>
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
              <ReviewActions version={current} />
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
            {previous.map((version) => (
              <li
                key={version.plan_version_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      Version {version.version_number}
                    </span>
                    <StatusBadge status={version.status} />
                  </div>
                  <VersionMeta version={version} />
                </div>
                <div className="flex gap-2">
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
