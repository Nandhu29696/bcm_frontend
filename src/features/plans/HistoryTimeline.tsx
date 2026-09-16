import { useQuery } from '@tanstack/react-query'

import { toApiError } from '@/api/client'
import { Alert, Modal, Spinner, StatusBadge } from '@/components/ui'

import { planKeys, plansApi } from './api'
import { formatDateTime } from './format'
import type { PlanVersion } from './types'

/** The history timeline (Phase 3.5): who, what, when, comments — oldest first. */
export function HistoryModal({ version, onClose }: { version: PlanVersion; onClose: () => void }) {
  const history = useQuery({
    queryKey: planKeys.history(version.plan_version_id),
    queryFn: () => plansApi.history(version.plan_version_id),
  })

  return (
    <Modal title={`History — version ${version.version_number}`} onClose={onClose}>
      {history.isPending ? (
        <Spinner label="Loading history" />
      ) : history.error ? (
        <Alert>{toApiError(history.error).detail}</Alert>
      ) : history.data.length === 0 ? (
        <p className="text-sm text-ink-500">No status changes recorded yet.</p>
      ) : (
        <ol className="relative ml-2 border-l border-ink-200 pl-6">
          {history.data.map((entry) => (
            <li key={entry.plan_status_history_id} className="mb-6 last:mb-0">
              <span
                aria-hidden="true"
                className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500"
              />
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.status} />
                <time dateTime={entry.changed_at} className="text-xs text-ink-500">
                  {formatDateTime(entry.changed_at)}
                </time>
              </div>
              <p className="mt-1 text-sm text-ink-700">
                <span className="font-medium text-ink-900">{entry.changed_by_name}</span>
                {entry.comments && <span className="text-ink-600"> — {entry.comments}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
