import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { useToast } from '@/components/useToast'
import { Alert, Button, Field, Modal, Textarea } from '@/components/ui'
import { editorKeys } from '@/features/editor/api'
import { planKeys } from '@/features/plans/api'
import type { PlanVersion } from '@/features/plans/types'

import { reviewApi, reviewKeys, type IncompleteSection } from './api'

/**
 * Submit / approve / send back (journey steps 6-7), shown wherever a version
 * is displayed. Which buttons appear comes from the server's readiness
 * response - the client never decides who may approve.
 */
export function ReviewActions({
  version,
  onChanged,
  compact = false,
}: {
  version: Pick<PlanVersion, 'plan_version_id' | 'status' | 'cost_code_id'>
  onChanged?: (next: PlanVersion) => void
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const readiness = useQuery({
    queryKey: reviewKeys.readiness(version.plan_version_id),
    queryFn: () => reviewApi.readiness(version.plan_version_id),
  })
  const [dialog, setDialog] = useState<'submit' | 'approve' | 'rework' | 'blocked' | null>(null)

  function refresh(next: PlanVersion) {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.readiness(version.plan_version_id) })
    void queryClient.invalidateQueries({ queryKey: planKeys.versions(version.cost_code_id) })
    void queryClient.invalidateQueries({ queryKey: planKeys.version(version.plan_version_id) })
    void queryClient.invalidateQueries({ queryKey: reviewKeys.queue })
    void queryClient.invalidateQueries({ queryKey: editorKeys.questionnaire(version.plan_version_id, 'BCP') })
    void queryClient.invalidateQueries({ queryKey: reviewKeys.documents(version.plan_version_id) })
    onChanged?.(next)
  }

  const r = readiness.data
  const blockers = r?.incomplete_sections ?? []
  const editable = ['Not Started', 'Work in Progress', 'Rework'].includes(version.status)
  const size = compact ? 'sm' : 'md'

  return (
    <>
      {editable && r && (r.can_submit || blockers.length > 0) && (
        <Button
          size={size}
          onClick={async () => {
            // Readiness is a point-in-time answer and the editor may have saved
            // answers since it was fetched: ask again before deciding which
            // dialog to open, or a just-completed plan reads as "not ready".
            const fresh = (await readiness.refetch()).data ?? r
            setDialog(fresh.can_submit ? 'submit' : 'blocked')
          }}
          title={r.can_submit ? 'Send to the BU lead for review' : 'Some sections are incomplete'}
        >
          Submit for review
        </Button>
      )}
      {r?.can_review && (
        <>
          <Button size={size} onClick={() => setDialog('approve')}>
            Approve
          </Button>
          <Button size={size} variant="danger" onClick={() => setDialog('rework')}>
            Send back
          </Button>
        </>
      )}

      {dialog === 'blocked' && (
        <Modal title="Not ready to submit" onClose={() => setDialog(null)}>
          <p className="text-sm text-ink-600">Every required question must be answered first. Still open:</p>
          <BlockerList blockers={readiness.data?.incomplete_sections ?? blockers} />
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
      {(dialog === 'submit' || dialog === 'approve' || dialog === 'rework') && (
        <TransitionDialog
          kind={dialog}
          versionId={version.plan_version_id}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            toast.success(
              dialog === 'submit' ? 'Submitted for BU lead review' : dialog === 'approve' ? 'Plan approved' : 'Sent back for rework',
            )
            setDialog(null)
            refresh(next)
          }}
        />
      )}
    </>
  )
}

function BlockerList({ blockers }: { blockers: IncompleteSection[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {blockers.map((s) => (
        <li key={s.section_id} className="flex items-center justify-between rounded-control bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">{s.section_name}</span>
          <span className="tabular-nums">
            {s.required_answered}/{s.required_visible} required
          </span>
        </li>
      ))}
    </ul>
  )
}

const COPY = {
  submit: {
    title: 'Submit for BU lead review',
    body: 'The BU lead will be emailed, with you in copy. The plan becomes read-only until they approve it or send it back.',
    label: 'Note for the reviewer (optional)',
    action: 'Submit',
  },
  approve: {
    title: 'Approve this plan',
    body: 'The coordinators will be emailed and the approved document generated. This version is then locked; changes need a new version.',
    label: 'Comment (optional)',
    action: 'Approve',
  },
  rework: {
    title: 'Send back for rework',
    body: 'The coordinators will be emailed with your comment and the plan becomes editable again.',
    label: 'What needs to change',
    action: 'Send back',
  },
} as const

function TransitionDialog({
  kind,
  versionId,
  onClose,
  onDone,
}: {
  kind: 'submit' | 'approve' | 'rework'
  versionId: number
  onClose: () => void
  onDone: (next: PlanVersion) => void
}) {
  const [comments, setComments] = useState('')
  const mutation = useMutation({
    mutationFn: () => reviewApi[kind](versionId, comments),
    onSuccess: onDone,
  })
  const failure = mutation.error ? toApiError(mutation.error) : null
  const incomplete = (mutation.error as { response?: { data?: { incomplete_sections?: IncompleteSection[] } } })?.response
    ?.data?.incomplete_sections
  const copy = COPY[kind]

  return (
    <Modal title={copy.title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <p className="text-sm text-ink-600">{copy.body}</p>
        {failure && <Alert>{failure.detail}</Alert>}
        {incomplete && incomplete.length > 0 && <BlockerList blockers={incomplete} />}
        <Field label={copy.label}>
          <Textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required={kind === 'rework'}
            aria-label={copy.label}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={kind === 'rework' ? 'danger' : 'primary'} disabled={mutation.isPending}>
            {mutation.isPending ? 'Working' : copy.action}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
