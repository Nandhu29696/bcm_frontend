import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  Textarea,
} from '@/components/ui'
import { IconEdit } from '@/components/icons'
import { estateKeys } from '@/features/estates/api'
import { CostCodeOperations } from '@/features/operations/CostCodeOperations'
import type { NamedRef } from '@/features/estates/types'
import { ROLE } from '@/features/auth/types'
import { useHasRole } from '@/features/auth/useAuth'
import { reviewApi, reviewKeys } from '@/features/review/api'

import { planKeys, plansApi } from './api'
import { AssignCoordinatorModal } from './AssignCoordinatorModal'
import { EditCostCodeModal } from './EditCostCodeModal'
import { HistoryModal } from './HistoryTimeline'
import { formatDateTime } from './format'
import type { PlanVersion } from './types'
import { VersionList } from './VersionList'

type PanelKind = 'edit' | 'assign' | 'history' | 'copy'
const PANEL_KINDS: readonly PanelKind[] = ['edit', 'assign', 'history', 'copy']

/**
 * Journey step 4 — everything reachable from a cost code row.
 *
 * Which panel is open lives in the URL (`?action=assign&version=12`), not in
 * component state. The row menu on the table deep-links straight here, the
 * browser's back button closes a panel, and a link to "the history of version
 * 3" is a thing that can be pasted into a message. There is no state to keep
 * in step with the URL because the URL is the state.
 */
export function CostCodeDetailPage() {
  const { costCodeId: param } = useParams()
  const costCodeId = Number(param)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  // Editing the cost code, starting its first version and copying a version
  // are all administrator-only now — a coordinator's assignment authorises
  // answering the questionnaire, exemptions and submission, not this (see
  // apps/plans/access.py's caller_may_edit_content on the backend).
  const canEditContent = useHasRole([ROLE.ADMIN])
  const canAssignCoordinator = useHasRole([ROLE.ADMIN])

  const costCode = useQuery({
    queryKey: planKeys.costCode(costCodeId),
    queryFn: () => plansApi.costCode(costCodeId),
    enabled: Number.isInteger(costCodeId),
  })
  const versions = useQuery({
    queryKey: planKeys.versions(costCodeId),
    queryFn: () => plansApi.versions(costCodeId),
    enabled: Number.isInteger(costCodeId),
  })
  const currentVersionId = versions.data?.versions.find((version) => version.is_current)?.plan_version_id
  const readiness = useQuery({
    queryKey: reviewKeys.readiness(currentVersionId ?? 0),
    queryFn: () => reviewApi.readiness(currentVersionId as number),
    enabled: currentVersionId !== undefined,
  })
  const requestedKind = searchParams.get('action')
  const panelKind = PANEL_KINDS.find((kind) => kind === requestedKind) ?? null
  const requestedVersionId = Number(searchParams.get('version'))

  function openPanel(kind: PanelKind, version?: PlanVersion) {
    const next = new URLSearchParams(searchParams)
    next.set('action', kind)
    if (version) next.set('version', String(version.plan_version_id))
    else next.delete('version')
    setSearchParams(next)
  }
  function closePanel() {
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    next.delete('version')
    setSearchParams(next, { replace: true })
  }

  const createFirstVersion = useMutation({
    mutationFn: () => plansApi.ensureVersion(costCodeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(costCodeId) })
      void queryClient.invalidateQueries({ queryKey: estateKeys.all })
    },
  })

  if (!Number.isInteger(costCodeId)) return <Alert>That cost code address is not valid.</Alert>
  if (costCode.isPending || versions.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading cost code" />
      </div>
    )
  }
  if (costCode.error) {
    const failure = toApiError(costCode.error)
    return (
      <Alert>
        {failure.code === 'not_found' ? 'That cost code is not in your scope.' : failure.detail}
      </Alert>
    )
  }
  if (versions.error) return <Alert>{toApiError(versions.error).detail}</Alert>

  const detail = costCode.data
  const versionList = versions.data.versions
  const currentVersion = versionList.find((version) => version.is_current)
  // The version a panel acts on, resolved from the live list on every render —
  // so after a coordinator is removed the modal shows the refetched roster, not
  // the roster it was opened with. Falls back to the current version, which is
  // what the table's row menu means when it links here without one.
  const panelVersion =
    versionList.find((v) => v.plan_version_id === requestedVersionId) ??
    versionList.find((v) => v.is_current) ??
    null

  return (
    <>
      <PageHeader
        title={detail.cost_code}
        subtitle={
          detail.process ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-brand-700">{detail.process.name}</span>
              {detail.subprocess && (
                <>
                  <span aria-hidden="true" className="text-ink-300">·</span>
                  <span className="font-semibold text-teal-700">{detail.subprocess.name}</span>
                </>
              )}
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-600">
          {currentVersion && currentVersionId && (
            <>
              <StatusBadge status={currentVersion.status} />
              <span>
                <strong className="font-semibold text-ink-900">
                  {readiness.data ? `${readiness.data.completion_percent}%` : '—'}
                </strong>{' '}
                complete
              </span>
              <span>
                <strong className="font-semibold text-ink-900">
                  {currentVersion.coordinators.length}
                </strong>{' '}
                coordinator{currentVersion.coordinators.length === 1 ? '' : 's'}
              </span>
            </>
          )}
          <span>Updated {formatDateTime(detail.updated_at)}</span>
        </div>
      </PageHeader>

      {/* Details as a strip across the top, not a sidebar: the version list
          below is tall and a narrow column beside it left most of the page
          empty. Four fields per row on a wide screen, wrapping below. */}
      <section aria-label="Cost code details" className="mb-6 rounded-card border border-ink-200/80 bg-white px-4 py-3 shadow-card animate-fade-up">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">Details</h2>
            <span className="text-xs text-ink-400">Scope and ownership</span>
          </div>
          {canEditContent && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-transparent px-2 text-xs font-medium text-ink-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => openPanel('edit')}
              aria-label="Edit cost code details"
              title="Edit cost code details"
            >
              <IconEdit size={14} /> Edit
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <Detail label="Process" value={detail.process} />
          <Detail label="Subprocess" value={detail.subprocess} />
          <Detail label="Line of business" value={detail.lob} />
          <Detail label="BU lead" value={detail.bu_lead} />
          <Detail label="Region" value={detail.region} />
          <Detail label="Location" value={detail.location} />
          <Detail label="Centre" value={detail.center} />
        </dl>
      </section>

      <div>
        <section aria-label="Plan versions" className="animate-fade-up">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">
            <span aria-hidden="true" className="h-4 w-1 rounded-full bg-brand-500" />
            Business continuity plan
          </h2>
          {versionList.length === 0 ? (
            <EmptyState
              title="No plan has been started for this cost code"
              description={
                canEditContent
                  ? 'Starting one creates version 1 in "Not Started" and lets you assign a coordinator.'
                  : 'An administrator can start one.'
              }
            >
              {canEditContent && (
                <Button
                  onClick={() => createFirstVersion.mutate()}
                  disabled={createFirstVersion.isPending || detail.process === null}
                >
                  {createFirstVersion.isPending ? 'Starting…' : 'Start a plan'}
                </Button>
              )}
            </EmptyState>
          ) : (
            <VersionList
              versions={versionList}
              canAuthor={canAssignCoordinator}
              canEditContent={canEditContent}
              onAssign={(version) => openPanel('assign', version)}
              onHistory={(version) => openPanel('history', version)}
              onCopy={(version) => openPanel('copy', version)}
            />
          )}
          {createFirstVersion.error && (
            <div className="mt-3">
              <Alert>{toApiError(createFirstVersion.error).detail}</Alert>
            </div>
          )}
          {detail.process === null && versionList.length === 0 && (
            <p className="mt-3 text-xs text-amber-700">
              Assign a process to this cost code before starting a plan.
            </p>
          )}
        </section>
      </div>

      <CostCodeOperations costCodeId={costCodeId} />

      {panelKind === 'edit' && <EditCostCodeModal costCode={detail} onClose={closePanel} />}
      {panelKind === 'assign' && panelVersion && (
        <AssignCoordinatorModal version={panelVersion} costCodeId={costCodeId} onClose={closePanel} />
      )}
      {panelKind === 'history' && panelVersion && (
        <HistoryModal version={panelVersion} onClose={closePanel} />
      )}
      {panelKind === 'copy' && panelVersion && (
        <CopyVersionModal version={panelVersion} costCodeId={costCodeId} onClose={closePanel} />
      )}
    </>
  )
}

function Detail({ label, value }: { label: string; value: NamedRef | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-800">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-normal text-ink-900">
        {value ? value.name : <span className="font-normal text-ink-400">—</span>}
      </dd>
    </div>
  )
}

function CopyVersionModal({
  version,
  costCodeId,
  onClose,
}: {
  version: PlanVersion
  costCodeId: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [comments, setComments] = useState('')
  const copy = useMutation({
    mutationFn: () => plansApi.copyVersion(version.plan_version_id, comments),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(costCodeId) })
      void queryClient.invalidateQueries({ queryKey: estateKeys.all })
      onClose()
    },
  })

  return (
    <Modal title={`New version from version ${version.version_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          copy.mutate()
        }}
      >
        <p className="text-sm text-ink-600">
          Every answer, contact, risk and strategy is copied into a new editable version. Version{' '}
          {version.version_number} stays exactly as it was approved.
        </p>
        {copy.error && <Alert>{toApiError(copy.error).detail}</Alert>}
        <Field label="Reason (recorded in the history)">
          <Textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Annual refresh, or: process moved to a new centre"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={copy.isPending}>
            {copy.isPending ? 'Copying…' : 'Create new version'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
