import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea } from '@/components/ui'
import { ROLE } from '@/features/auth/types'
import { useHasRole } from '@/features/auth/useAuth'
import { formatDateTime } from '@/features/plans/format'

import { CostCodePicker } from './CostCodePicker'
import { EVENT_TYPES, opsApi, opsKeys, type EventType } from './api'
import { SimulationChoice } from './TestDetailPage'
import { formatDate } from './format'

/** Crisis events in scope, newest first, and the button that declares one. */
export function CrisisPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const eventType = searchParams.get('event_type') ?? ''
  const filters = { status, event_type: eventType }
  const events = useQuery({ queryKey: opsKeys.events(filters), queryFn: () => opsApi.events(filters) })
  const [declaring, setDeclaring] = useState(false)
  const canDeclare = useHasRole([ROLE.ADMIN, ROLE.COORDINATOR, ROLE.BU_LEAD, ROLE.TEST_MANAGER, ROLE.APPROVER])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="Crisis Management" eyebrow="Incidents, exercises and the CMSC call tree" subtitle={events.data ? `${events.data.length} event${events.data.length === 1 ? '' : 's'}` : undefined}>
        {canDeclare && <Button onClick={() => setDeclaring(true)}>Declare an event</Button>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status" className="w-44">
          <option value="">All statuses</option>
          {['Planned', 'Initiated', 'In Progress', 'Closed', 'Cancelled'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={eventType} onChange={(e) => setParam('event_type', e.target.value)} aria-label="Filter by type" className="w-48">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>

      {events.isPending ? (
        <div className="py-16 text-center">
          <Spinner label="Loading crisis events" />
        </div>
      ) : events.error ? (
        <Alert>{toApiError(events.error).detail}</Alert>
      ) : events.data.length === 0 ? (
        <EmptyState title="No crisis events" description="Declaring an event records it against a cost code and can start the CMSC call tree." />
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Cost code</th>
                <th>Type</th>
                <th>CSD ticket</th>
                <th>Status</th>
                <th>Call tree</th>
                <th>Declared by</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((e) => (
                <tr key={e.crisis_event_id}>
                  <td className="whitespace-nowrap">
                    {formatDate(e.event_date)}
                    {e.event_time ? ` ${e.event_time.slice(0, 5)}` : ''}
                  </td>
                  <td>
                    <Link to={`/crisis/${e.crisis_event_id}`} className="font-medium text-brand-700 hover:underline">
                      {e.cost_code_label}
                    </Link>
                    <span className="block text-xs text-ink-500">{e.process_name || '—'} · {e.estate_name}</span>
                  </td>
                  <td>{e.event_type}</td>
                  <td className="font-mono text-xs">{e.csd_ticket_number || '—'}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>
                    {e.call_tree_run ? (
                      <span className="text-sm">
                        <StatusBadge status={e.call_tree_run.status} />
                        <span className="ml-2 tabular-nums text-ink-500">
                          {e.call_tree_run.reached}/{e.call_tree_run.members}
                          {e.call_tree_run.simulation_flag ? ' · sim' : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="text-ink-500">
                    {e.created_by_name || '—'}
                    <span className="block text-xs">{formatDateTime(e.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {declaring && <DeclareEventModal onClose={() => setDeclaring(false)} />}
    </>
  )
}

export function DeclareEventModal({ costCodeId: fixed, onClose }: { costCodeId?: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [costCodeId, setCostCodeId] = useState<number | null>(fixed ?? null)
  const [form, setForm] = useState({ event_type: 'Live Incident' as EventType, csd_ticket_number: '', comments: '', event_date: '', event_time: '' })
  const [initiate, setInitiate] = useState(true)
  const [simulation, setSimulation] = useState(true)
  const declare = useMutation({
    mutationFn: () => opsApi.declareEvent(costCodeId as number, { ...form, initiate, simulation }),
    onSuccess: (event) => {
      void queryClient.invalidateQueries({ queryKey: ['crisis-events'] })
      void queryClient.invalidateQueries({ queryKey: ['cost-codes'] })
      queryClient.setQueryData(opsKeys.event(event.crisis_event_id), event)
      onClose()
      void navigate(`/crisis/${event.crisis_event_id}`)
    },
  })
  const failure = declare.error ? toApiError(declare.error) : null

  return (
    <Modal title="Declare a crisis event" onClose={onClose} width="max-w-xl">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); declare.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        {fixed === undefined && <CostCodePicker value={costCodeId} onChange={(id) => setCostCodeId(id)} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })} aria-label="Event type">
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="CSD ticket number">
            <Input value={form.csd_ticket_number} onChange={(e) => setForm({ ...form, csd_ticket_number: e.target.value })} aria-label="CSD ticket number" />
          </Field>
          <Field label="Date" hint="Defaults to today.">
            <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} aria-label="Event date" />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} aria-label="Event time" />
          </Field>
        </div>
        <Field label="What happened">
          <Textarea rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} aria-label="What happened" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={initiate} onChange={(e) => setInitiate(e.target.checked)} />
          Start the CMSC call tree now
        </label>
        {initiate && <SimulationChoice value={simulation} onChange={setSimulation} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={initiate && !simulation ? 'danger' : 'primary'} disabled={declare.isPending || costCodeId === null}>
            {declare.isPending ? 'Declaring' : initiate ? (simulation ? 'Declare and simulate' : 'Declare and call') : 'Declare'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
