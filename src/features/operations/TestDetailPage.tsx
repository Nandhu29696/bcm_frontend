import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, Button, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea } from '@/components/ui'
import { IconChevronRight } from '@/components/icons'
import { formatDateTime } from '@/features/plans/format'
import { reviewApi } from '@/features/review/api'

import { CallTreeMonitor } from './CallTreeMonitor'
import { FINAL_STATUSES, opsApi, opsKeys, TEST_TYPES, type FinalStatus, type PlanTest, type TestType } from './api'
import { formatDate } from './format'

/** One test: reschedule, cancel, run it (call tree tests) and record the outcome. */
export function TestDetailPage() {
  const { testId: param } = useParams()
  const testId = Number(param)
  const queryClient = useQueryClient()
  const test = useQuery({ queryKey: opsKeys.test(testId), queryFn: () => opsApi.test(testId), enabled: Number.isInteger(testId) })
  const [dialog, setDialog] = useState<'reschedule' | 'outcome' | 'run' | null>(null)

  function refresh(next: PlanTest) {
    queryClient.setQueryData(opsKeys.test(testId), next)
    void queryClient.invalidateQueries({ queryKey: ['tests'] })
    void queryClient.invalidateQueries({ queryKey: ['cost-codes'] })
  }
  const cancel = useMutation({ mutationFn: () => opsApi.cancelTest(testId), onSuccess: refresh })
  const download = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })

  if (test.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading test" />
      </div>
    )
  }
  if (test.error) return <Alert>{toApiError(test.error).detail}</Alert>
  const t = test.data
  const open = t.status === 'Scheduled' || t.status === 'In Progress'

  return (
    <>
      <PageHeader
        title={t.test_type}
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link to="/tests" className="text-brand-700 hover:underline">
              Tests
            </Link>
            <IconChevronRight size={12} className="text-ink-400" />
            <Link to={`/cost-codes/${t.cost_code_id}`} className="text-brand-700 hover:underline">
              {t.cost_code_label}
            </Link>
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <span>
              {formatDate(t.scheduled_date)}
              {t.scheduled_time ? ` at ${t.scheduled_time.slice(0, 5)}` : ''} · {t.process_name || '—'} · {t.estate_name} · plan v{t.version_number}
            </span>
          </span>
        }
      >
        {t.can_manage && open && (
          <>
            {t.test_type === 'Call Tree Test' && t.status === 'Scheduled' && <Button onClick={() => setDialog('run')}>Run call tree</Button>}
            <Button variant="secondary" onClick={() => setDialog('reschedule')}>
              Reschedule
            </Button>
            <Button onClick={() => setDialog('outcome')}>Record outcome</Button>
            <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              Cancel test
            </Button>
          </>
        )}
      </PageHeader>

      {cancel.error && <Alert>{toApiError(cancel.error).detail}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Test details" className="h-fit rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-ink-500">Scheduled by</dt>
            <dd className="font-medium text-ink-900">{t.initiated_by_name || '—'}</dd>
            <dt className="text-ink-500">Created</dt>
            <dd className="font-medium text-ink-900">{formatDateTime(t.created_at)}</dd>
            <dt className="text-ink-500">Notes</dt>
            <dd className="whitespace-pre-wrap text-ink-900">{t.comments || <span className="text-ink-400">—</span>}</dd>
          </dl>

          <h2 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Outcome</h2>
          {t.outcomes.length === 0 ? (
            <p className="text-sm text-ink-500">Not recorded yet.</p>
          ) : (
            <ul className="space-y-3" aria-label="Outcomes">
              {t.outcomes.map((o) => (
                <li key={o.test_outcome_id} className="rounded-control border border-ink-200/80 bg-ink-50/50 px-3.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {o.final_status && <StatusBadge status={o.final_status} />}
                    <span className="text-ink-500">
                      conducted {formatDate(o.conducted_date)}
                      {o.conducted_time ? ` at ${o.conducted_time.slice(0, 5)}` : ''}
                    </span>
                  </div>
                  {o.result && <p className="mt-2 whitespace-pre-wrap text-ink-800">{o.result}</p>}
                  {o.report && (
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => download.mutate(o.report!.entity_document_id)} disabled={download.isPending}>
                      Download report · {o.report.file_name}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Call tree" className="min-w-0">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Call tree</h2>
          {t.call_tree_run ? (
            <CallTreeMonitor run={t.call_tree_run} />
          ) : (
            <p className="text-sm text-ink-500">
              {t.test_type === 'Call Tree Test' ? 'Not run yet. Running it dials the CMSC roster for this cost code.' : 'This type of test is recorded manually.'}
            </p>
          )}
        </section>
      </div>

      {dialog === 'reschedule' && <RescheduleModal test={t} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); refresh(n) }} />}
      {dialog === 'outcome' && <OutcomeModal test={t} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); refresh(n) }} />}
      {dialog === 'run' && <RunCallTreeModal test={t} onClose={() => setDialog(null)} onDone={(n) => { setDialog(null); refresh(n) }} />}
    </>
  )
}

function RescheduleModal({ test, onClose, onDone }: { test: PlanTest; onClose: () => void; onDone: (t: PlanTest) => void }) {
  const [form, setForm] = useState({
    test_type: test.test_type,
    scheduled_date: test.scheduled_date ?? '',
    scheduled_time: test.scheduled_time?.slice(0, 5) ?? '',
    comments: test.comments,
  })
  const save = useMutation({
    mutationFn: () => opsApi.rescheduleTest(test.test_id, { ...form, scheduled_time: form.scheduled_time || null }),
    onSuccess: onDone,
  })
  const failure = save.error ? toApiError(save.error) : null
  return (
    <Modal title="Reschedule" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Type of test">
          <Select value={form.test_type} onChange={(e) => setForm({ ...form, test_type: e.target.value as TestType })} aria-label="Type of test">
            {TEST_TYPES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required aria-label="Date" />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} aria-label="Time" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} aria-label="Notes" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function OutcomeModal({ test, onClose, onDone }: { test: PlanTest; onClose: () => void; onDone: (t: PlanTest) => void }) {
  const [form, setForm] = useState({ conducted_date: test.scheduled_date ?? '', conducted_time: '', result: '', final_status: 'Passed' as FinalStatus })
  const [report, setReport] = useState<File | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('conducted_date', form.conducted_date)
      if (form.conducted_time) body.append('conducted_time', form.conducted_time)
      body.append('result', form.result)
      body.append('final_status', form.final_status)
      if (report) body.append('report', report)
      return opsApi.recordOutcome(test.test_id, body)
    },
    onSuccess: onDone,
  })
  const failure = save.error ? toApiError(save.error) : null
  return (
    <Modal title="Record the outcome" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <p className="text-sm text-ink-600">Recording an outcome completes the test. Attach the final report if there is one.</p>
        {failure && <Alert>{failure.detail}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Conducted on" error={failure?.field_errors.conducted_date?.[0]}>
            <Input type="date" value={form.conducted_date} onChange={(e) => setForm({ ...form, conducted_date: e.target.value })} required aria-label="Conducted on" />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.conducted_time} onChange={(e) => setForm({ ...form, conducted_time: e.target.value })} aria-label="Conducted time" />
          </Field>
        </div>
        <Field label="Final status">
          <Select value={form.final_status} onChange={(e) => setForm({ ...form, final_status: e.target.value as FinalStatus })} aria-label="Final status">
            {FINAL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Result">
          <Textarea rows={4} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} aria-label="Result" placeholder="What happened, what worked, what needs fixing" />
        </Field>
        <Field label="Final report" hint="PDF, Word, Excel or an image.">
          <input type="file" aria-label="Final report" className="block w-full text-sm text-ink-700" onChange={(e) => setReport(e.target.files?.[0] ?? null)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving' : 'Complete test'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function RunCallTreeModal({ test, onClose, onDone }: { test: PlanTest; onClose: () => void; onDone: (t: PlanTest) => void }) {
  const [simulation, setSimulation] = useState(true)
  const run = useMutation({ mutationFn: () => opsApi.startTestCallTree(test.test_id, simulation), onSuccess: onDone })
  const failure = run.error ? toApiError(run.error) : null
  return (
    <Modal title="Run the call tree" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        <SimulationChoice value={simulation} onChange={setSimulation} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={simulation ? 'primary' : 'danger'} disabled={run.isPending}>
            {run.isPending ? 'Starting' : simulation ? 'Run simulation' : 'Run live'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function SimulationChoice({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const providers = useQuery({ queryKey: opsKeys.providerStatus, queryFn: opsApi.providerStatus, staleTime: 60_000 })
  const liveConfigured = providers.data ? providers.data.VOICE || providers.data.MS_TEAMS : true

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Mode</legend>
      <label className="flex cursor-pointer gap-3 rounded-control border border-ink-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
        <input type="radio" name="mode" checked={value} onChange={() => onChange(true)} />
        <span>
          <span className="font-medium text-ink-900">Simulation</span>
          <span className="block text-xs text-ink-500">Exercises every escalation step against a fake provider. Nobody is called or emailed.</span>
        </span>
      </label>
      <label className="flex cursor-pointer gap-3 rounded-control border border-ink-200 p-3 text-sm has-[:checked]:border-red-400 has-[:checked]:bg-red-50/40">
        <input type="radio" name="mode" checked={!value} onChange={() => onChange(false)} />
        <span>
          <span className="font-medium text-ink-900">Live</span>
          <span className="block text-xs text-ink-500">Calls, Teams and emails go to real people through whichever providers this environment has enabled.</span>
        </span>
      </label>
      {!value && providers.data && !liveConfigured && (
        <p className="rounded-control border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Live calling is not configured in this environment — voice and Teams are both off, so
          nobody will actually be contacted. Email still goes out. Ask the BCM team to confirm
          before relying on this for a real exercise.
        </p>
      )}
    </fieldset>
  )
}
