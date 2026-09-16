import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
} from '@/components/ui'
import { IconChevronRight } from '@/components/icons'
import { estateKeys } from '@/features/estates/api'
import { CostCodeOperations } from '@/features/operations/CostCodeOperations'
import type { NamedRef } from '@/features/estates/types'
import { ROLE } from '@/features/auth/types'
import { useHasRole } from '@/features/auth/useAuth'

import { planKeys, plansApi } from './api'
import { AssignCoordinatorModal } from './AssignCoordinatorModal'
import { EditCostCodeModal } from './EditCostCodeModal'
import { HistoryModal } from './HistoryTimeline'
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
  const canAuthor = useHasRole([ROLE.ADMIN, ROLE.COORDINATOR])

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
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link to="/estates" className="text-brand-700 hover:underline">
              Estates
            </Link>
            {detail.estate && (
              <>
                <IconChevronRight size={12} className="text-ink-400" />
                <Link
                  to={`/estates/${detail.estate.id}/cost-codes`}
                  className="text-brand-700 hover:underline"
                >
                  {detail.estate.name}
                </Link>
              </>
            )}
          </span>
        }
        subtitle={detail.process ? `${detail.process.name}${detail.subprocess ? ` · ${detail.subprocess.name}` : ''}` : undefined}
      >
        {canAuthor && (
          <Button variant="secondary" onClick={() => openPanel('edit')}>
            Edit cost code
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Cost code details" className="h-fit rounded-card border border-ink-200/80 bg-white p-5 shadow-card animate-fade-up">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <Detail label="Process" value={detail.process} />
            <Detail label="Subprocess" value={detail.subprocess} />
            <Detail label="Region" value={detail.region} />
            <Detail label="Location" value={detail.location} />
            <Detail label="Centre" value={detail.center} />
            <Detail label="BU lead" value={detail.bu_lead} />
            <Detail label="Line of business" value={detail.lob} />
          </dl>
        </section>

        <section aria-label="Plan versions" className="animate-fade-up">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Business continuity plan</h2>
          {versionList.length === 0 ? (
            <EmptyState
              title="No plan has been started for this cost code"
              description={
                canAuthor
                  ? 'Starting one creates version 1 in "Not Started" and lets you assign a coordinator.'
                  : 'A coordinator or administrator can start one.'
              }
            >
              {canAuthor && (
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
              canAuthor={canAuthor}
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
    <>
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value ? value.name : <span className="font-normal text-ink-400">—</span>}</dd>
    </>
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
