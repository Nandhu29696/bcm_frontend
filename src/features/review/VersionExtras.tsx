import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Badge, Button, Field, Modal, Spinner, Textarea } from '@/components/ui'
import { planKeys } from '@/features/plans/api'
import { formatDateTime } from '@/features/plans/format'
import type { PlanVersion } from '@/features/plans/types'

import { reviewApi, reviewKeys, type Exemption } from './api'

/**
 * Generated documents (Phase 7.3-7.4) for one version. A download goes via a
 * short-lived signed link fetched on click, so a stale page never holds a
 * usable URL.
 */
export function DocumentsPanel({ version, canAuthor }: { version: PlanVersion; canAuthor: boolean }) {
  const queryClient = useQueryClient()
  const docs = useQuery({
    queryKey: reviewKeys.documents(version.plan_version_id),
    queryFn: () => reviewApi.documents(version.plan_version_id),
  })
  const regenerate = useMutation({
    mutationFn: () => reviewApi.regenerate(version.plan_version_id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: reviewKeys.documents(version.plan_version_id) }),
  })
  const open = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })

  if (docs.isPending) return <Spinner label="Loading documents" />
  if (docs.error) return <Alert>{toApiError(docs.error).detail}</Alert>

  const closed = version.status === 'Approved' || version.status === 'Exempted'

  return (
    <section aria-label="Generated documents" className="mt-4 rounded-control border border-ink-100 bg-ink-50/60 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Documents</h4>
        {canAuthor && closed && (
          <Button size="sm" variant="secondary" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
            {regenerate.isPending ? 'Generating' : docs.data.length ? 'Regenerate' : 'Generate'}
          </Button>
        )}
      </div>
      {regenerate.error && <Alert>{toApiError(regenerate.error).detail}</Alert>}
      {open.error && <Alert>{toApiError(open.error).detail}</Alert>}
      {docs.data.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">
          {closed ? 'No document generated yet.' : 'Documents are generated when the plan is approved.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {docs.data.map((d) => (
            <li key={d.entity_document_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="mr-2 inline-block w-11 rounded bg-white px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase text-ink-600 ring-1 ring-ink-200">
                  {d.format}
                </span>
                <span className="truncate text-ink-800">{d.file_name}</span>
                <span className="ml-2 text-xs text-ink-500">
                  {formatDateTime(d.generated_at)} · {d.template}
                </span>
              </span>
              <button
                type="button"
                onClick={() => open.mutate(d.entity_document_id)}
                className="shrink-0 text-brand-700 hover:underline"
              >
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const STATUS_TONE: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-900',
  Approved: 'bg-emerald-50 text-emerald-800',
  Rejected: 'bg-red-50 text-red-800',
  Rework: 'bg-blue-50 text-blue-800',
}

/** Exemption request and decision (Phase 7.5) for one version. */
export function ExemptionPanel({ version }: { version: PlanVersion }) {
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: reviewKeys.exemptions(version.plan_version_id),
    queryFn: () => reviewApi.exemptions(version.plan_version_id),
  })
  const readiness = useQuery({
    queryKey: reviewKeys.readiness(version.plan_version_id),
    queryFn: () => reviewApi.readiness(version.plan_version_id),
  })
  const [dialog, setDialog] = useState<'request' | 'resubmit' | 'approve' | 'reject' | 'rework' | null>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: reviewKeys.exemptions(version.plan_version_id) })
    void queryClient.invalidateQueries({ queryKey: planKeys.versions(version.cost_code_id) })
    void queryClient.invalidateQueries({ queryKey: reviewKeys.readiness(version.plan_version_id) })
    setDialog(null)
  }

  if (list.isPending || readiness.isPending) return null
  if (list.error) return <Alert>{toApiError(list.error).detail}</Alert>

  const open = list.data.find((e) => e.status === 'Pending' || e.status === 'Rework')
  const latest = list.data[0]
  const editable = ['Not Started', 'Work in Progress', 'Rework'].includes(version.status)
  const canAuthor = readiness.data?.is_author ?? false
  const canDecide = readiness.data?.is_approver ?? false

  return (
    <section aria-label="Exemption" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {latest && (
        <>
          <span className="text-ink-500">Exemption:</span>
          <Badge className={STATUS_TONE[latest.status]}>{latest.status}</Badge>
          <span className="text-ink-600">{latest.reason}</span>
          {latest.comments.length > 1 && (
            <span className="text-xs text-ink-500">
              {'· '}{latest.comments[latest.comments.length - 1].comment}
            </span>
          )}
        </>
      )}

      {canAuthor && editable && !open && (
        <Button
          size="sm"
          variant="ghost"
          className="border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-900"
          onClick={() => setDialog('request')}
        >
          Request exemption
        </Button>
      )}
      {canAuthor && open?.status === 'Rework' && (
        <Button size="sm" variant="secondary" onClick={() => setDialog('resubmit')}>
          Resubmit request
        </Button>
      )}
      {canDecide && open?.status === 'Pending' && (
        <span className="flex gap-1.5">
          <Button size="sm" onClick={() => setDialog('approve')}>
            Approve exemption
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog('rework')}>
            Send back
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDialog('reject')}>
            Reject
          </Button>
        </span>
      )}

      {dialog === 'request' && (
        <ExemptionDialog kind="request" versionId={version.plan_version_id} onClose={() => setDialog(null)} onDone={refresh} />
      )}
      {dialog && dialog !== 'request' && open && (
        <ExemptionDialog
          kind={dialog}
          versionId={version.plan_version_id}
          exemption={open}
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      )}
    </section>
  )
}

function ExemptionDialog({
  kind,
  versionId,
  exemption,
  onClose,
  onDone,
}: {
  kind: 'request' | 'resubmit' | 'approve' | 'reject' | 'rework'
  versionId: number
  exemption?: Exemption
  onClose: () => void
  onDone: () => void
}) {
  const [text, setText] = useState(kind === 'resubmit' ? (exemption?.reason ?? '') : '')
  const [answer1, setAnswer1] = useState('')
  const mutation = useMutation({
    mutationFn: () => {
      if (kind === 'request') return reviewApi.requestExemption(versionId, { reason: text, answer_1: answer1 })
      if (kind === 'resubmit') return reviewApi.resubmitExemption(exemption!.exemption_id, text)
      return reviewApi.decideExemption(exemption!.exemption_id, kind, text)
    },
    onSuccess: onDone,
  })
  const failure = mutation.error ? toApiError(mutation.error) : null
  const titles = {
    request: 'Request an exemption',
    resubmit: 'Resubmit the exemption request',
    approve: 'Approve the exemption',
    reject: 'Reject the exemption',
    rework: 'Send the request back',
  }
  const labels = {
    request: 'Why should this plan be exempted?',
    resubmit: 'Updated reason',
    approve: 'Comment (optional)',
    reject: 'Comment (optional)',
    rework: 'What is missing from the request',
  }

  return (
    <Modal title={titles[kind]} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        {kind === 'approve' && (
          <p className="text-sm text-ink-600">The plan version will be marked Exempted and needs no further work.</p>
        )}
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label={labels[kind]}>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} required={kind !== 'approve' && kind !== 'reject'} />
        </Field>
        {kind === 'request' && (
          <Field label="Which clients or services are affected? (optional)">
            <Textarea rows={2} value={answer1} onChange={(e) => setAnswer1(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={kind === 'reject' ? 'danger' : 'primary'} disabled={mutation.isPending}>
            {mutation.isPending ? 'Working' : titles[kind].split(' ')[0]}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
