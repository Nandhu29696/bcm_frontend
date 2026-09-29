import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, Button, Field, Modal, PageHeader, Spinner, StatusBadge, Textarea } from '@/components/ui'
import { IconChevronRight } from '@/components/icons'
import { formatDateTime } from '@/features/plans/format'

import { CallTreeMonitor } from './CallTreeMonitor'
import { opsApi, opsKeys, type CrisisEvent } from './api'
import { RosterPanel } from './RosterPanel'
import { SimulationChoice } from './TestDetailPage'
import { formatDate } from './format'

/** One crisis event: its call tree live, the roster it dials, and close / cancel. */
export function CrisisEventPage() {
  const { eventId: param } = useParams()
  const eventId = Number(param)
  const queryClient = useQueryClient()
  const event = useQuery({
    queryKey: opsKeys.event(eventId),
    queryFn: () => opsApi.event(eventId),
    enabled: Number.isInteger(eventId),
    refetchInterval: (query) => (query.state.data?.call_tree_run?.status === 'RUNNING' ? 3000 : false),
  })
  const [dialog, setDialog] = useState<'initiate' | 'close' | null>(null)

  function refresh(next: CrisisEvent) {
    queryClient.setQueryData(opsKeys.event(eventId), next)
    void queryClient.invalidateQueries({ queryKey: ['crisis-events'] })
    void queryClient.invalidateQueries({ queryKey: ['call-tree-runs'] })
    void queryClient.invalidateQueries({ queryKey: ['cost-codes'] })
  }
  const cancel = useMutation({ mutationFn: () => opsApi.cancelEvent(eventId), onSuccess: refresh })

  if (event.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading crisis event" />
      </div>
    )
  }
  if (event.error) return <Alert>{toApiError(event.error).detail}</Alert>
  const e = event.data
  const open = e.status !== 'Closed' && e.status !== 'Cancelled'
  const running = e.call_tree_run?.status === 'RUNNING'

  return (
    <>
      <PageHeader
        title={`${e.event_type} · ${e.cost_code_label}`}
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link to="/crisis" className="text-brand-700 hover:underline">
              Crisis Management
            </Link>
            <IconChevronRight size={12} className="text-ink-400" />
            <Link to={`/cost-codes/${e.cost_code_id}`} className="text-brand-700 hover:underline">
              {e.cost_code_label}
            </Link>
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            <span>
              {formatDate(e.event_date)}
              {e.event_time ? ` at ${e.event_time.slice(0, 5)}` : ''} · {e.process_name || '—'} · {e.estate_name}
              {e.csd_ticket_number ? ` · CSD ${e.csd_ticket_number}` : ''}
            </span>
          </span>
        }
      >
        {e.can_manage && open && (
          <>
            {!running && <Button onClick={() => setDialog('initiate')}>{e.call_tree_run ? 'Run call tree again' : 'Start call tree'}</Button>}
            <Button variant="secondary" onClick={() => setDialog('close')}>
              Close event
            </Button>
            {e.status === 'Planned' && (
              <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                Cancel
              </Button>
            )}
          </>
        )}
      </PageHeader>

      {cancel.error && <Alert>{toApiError(cancel.error).detail}</Alert>}

      <div className="space-y-6">
        <section aria-label="Event details" className="rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
          <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-ink-500">Declared by</dt>
            <dd className="font-medium text-ink-900">{e.created_by_name || '—'}</dd>
            <dt className="text-ink-500">Start date</dt>
            <dd className="font-medium text-ink-900">
              {formatDate(e.event_date)}
              {e.event_time ? ` at ${e.event_time.slice(0, 5)}` : ''}
            </dd>
            <dt className="text-ink-500">Declared at</dt>
            <dd className="font-medium text-ink-900">{formatDateTime(e.created_at)}</dd>
            <dt className="text-ink-500">End date</dt>
            <dd className="font-medium text-ink-900">
              {e.closed_at ? formatDateTime(e.closed_at) : <span className="text-ink-400">Still open</span>}
            </dd>
            <dt className="text-ink-500">Comments</dt>
            <dd className="whitespace-pre-wrap text-ink-900 sm:col-span-3">{e.comments || <span className="text-ink-400">—</span>}</dd>
          </dl>
        </section>

        <section aria-label="Call tree" className="min-w-0">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">CMSC call tree</h2>
          {e.call_tree_run ? (
            <CallTreeMonitor run={e.call_tree_run} />
          ) : (
            <p className="text-sm text-ink-500">The call tree has not been started for this event.</p>
          )}
        </section>

        <RosterPanel costCodeId={e.cost_code_id} />
      </div>

      {dialog === 'initiate' && <InitiateModal event={e} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); refresh(n) }} />}
      {dialog === 'close' && <CloseModal event={e} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); refresh(n) }} />}
    </>
  )
}

function InitiateModal({ event, onClose, onDone }: { event: CrisisEvent; onClose: () => void; onDone: (e: CrisisEvent) => void }) {
  const [simulation, setSimulation] = useState(true)
  const start = useMutation({ mutationFn: () => opsApi.initiateEvent(event.crisis_event_id, simulation), onSuccess: onDone })
  const failure = start.error ? toApiError(start.error) : null
  return (
    <Modal title="Start the CMSC call tree" onClose={onClose}>
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); start.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        <SimulationChoice value={simulation} onChange={setSimulation} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={simulation ? 'primary' : 'danger'} disabled={start.isPending}>
            {start.isPending ? 'Starting' : simulation ? 'Run simulation' : 'Call the committee'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CloseModal({ event, onClose, onDone }: { event: CrisisEvent; onClose: () => void; onDone: (e: CrisisEvent) => void }) {
  const [comments, setComments] = useState('')
  const close = useMutation({ mutationFn: () => opsApi.closeEvent(event.crisis_event_id, comments), onSuccess: onDone })
  const failure = close.error ? toApiError(close.error) : null
  return (
    <Modal title="Close this event" onClose={onClose}>
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); close.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Closing note">
          <Textarea rows={3} value={comments} onChange={(ev) => setComments(ev.target.value)} aria-label="Closing note" placeholder="How it was resolved" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={close.isPending}>{close.isPending ? 'Closing' : 'Close event'}</Button>
        </div>
      </form>
    </Modal>
  )
}
