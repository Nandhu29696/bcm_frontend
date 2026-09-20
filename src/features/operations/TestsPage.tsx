import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { PAGE_SIZE } from '@/components/paging'
import { Alert, Button, EmptyState, Field, FilterBar, FilterItem, Input, Modal, PageHeader, Pager, Select, Spinner, StatusBadge, Textarea } from '@/components/ui'
import { ROLE } from '@/features/auth/types'
import { useHasRole } from '@/features/auth/useAuth'

import { CostCodePicker } from './CostCodePicker'
import { opsApi, opsKeys, TEST_TYPES, type PlanTest, type TestType } from './api'
import { formatDate, iso } from './format'

/**
 * Test scheduling (journey step 8). A month calendar with the list beside it;
 * the month lives in the URL so a link to "November" is shareable, and so does
 * a picked day (`?day=`) and the list's page (`?page=`).
 *
 * Clicking a day narrows the list to that day's tests; clicking it again, or
 * "Whole month", widens it back. The list is paged five at a time.
 */

export function TestsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = new Date()
  const month = searchParams.get('month') ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const last = new Date(year, monthIndex, 0)
  const status = searchParams.get('status') ?? ''
  const testType = searchParams.get('test_type') ?? ''
  const day = searchParams.get('day') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const canSchedule = useHasRole([ROLE.ADMIN, ROLE.COORDINATOR, ROLE.BU_LEAD, ROLE.TEST_MANAGER, ROLE.APPROVER])

  const filters = { date_from: iso(first), date_to: iso(last), status, test_type: testType }
  const tests = useQuery({ queryKey: opsKeys.tests(filters), queryFn: () => opsApi.tests(filters) })
  const [scheduling, setScheduling] = useState(false)

  function setParams(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }
  // Any change of what is listed starts again at page 1; a change of month
  // also drops the picked day, which belongs to the month it was picked in.
  function setParam(key: string, value: string) {
    setParams({ [key]: value, page: '', ...(key === 'month' ? { day: '' } : {}) })
  }
  function shiftMonth(delta: number) {
    const d = new Date(year, monthIndex - 1 + delta, 1)
    setParam('month', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function pickDay(key: string) {
    setParams({ day: key === day ? '' : key, page: '' })
  }

  const byDay = new Map<string, PlanTest[]>()
  for (const t of tests.data ?? []) {
    if (!t.scheduled_date) continue
    byDay.set(t.scheduled_date, [...(byDay.get(t.scheduled_date) ?? []), t])
  }

  // The list: the picked day's tests, or the month's; five to a page.
  const listed = day ? (byDay.get(day) ?? []) : (tests.data ?? [])
  const pageCount = Math.max(1, Math.ceil(listed.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageItems = listed.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const listTitle = day
    ? `Tests on ${new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Tests this month'

  return (
    <>
      <PageHeader
        title="Tests"
        eyebrow="Exercises and call tree tests"
        subtitle={first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      >
        {canSchedule && <Button onClick={() => setScheduling(true)}>Schedule a test</Button>}
      </PageHeader>

      <FilterBar
        active={[status, testType].filter(Boolean).length}
        onClear={() => setParams({ status: '', test_type: '', page: '' })}
        count={tests.data ? `${tests.data.length} test${tests.data.length === 1 ? '' : 's'} this month` : undefined}
      >
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setParam('month', '')}>
          Today
        </Button>
        <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)} aria-label="Next month">
          Next
        </Button>
        <FilterItem className="ml-2 w-44">
          <Select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </FilterItem>
        <FilterItem>
          <Select value={testType} onChange={(e) => setParam('test_type', e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {TEST_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </FilterItem>
      </FilterBar>

      {tests.error && <Alert>{toApiError(tests.error).detail}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MonthGrid first={first} last={last} byDay={byDay} selected={day} onPick={pickDay} />
        <section aria-label={listTitle} className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              {listTitle}
              {tests.data && <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 tabular-nums text-ink-600">{listed.length}</span>}
            </h2>
            {day && (
              <button type="button" onClick={() => pickDay(day)} className="text-xs font-medium text-brand-700 hover:underline">
                Whole month
              </button>
            )}
          </div>
          {!tests.data ? (
            <div className="py-10 text-center">
              <Spinner label="Loading tests" />
            </div>
          ) : listed.length === 0 ? (
            <EmptyState
              title={day ? 'Nothing scheduled on this day' : 'Nothing scheduled this month'}
              description={day ? 'Pick another day, or show the whole month.' : 'Scheduled tests appear on the calendar and in this list.'}
            />
          ) : (
            <ul className="space-y-2">
              {pageItems.map((t) => (
                <li key={t.test_id} className="rounded-card border border-ink-200/80 bg-white px-4 py-3 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/tests/${t.test_id}`} className="font-medium text-brand-700 hover:underline">
                      {t.test_type} · {t.cost_code_label}
                    </Link>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    {formatDate(t.scheduled_date)}
                    {t.scheduled_time ? ` at ${t.scheduled_time.slice(0, 5)}` : ''} · {t.process_name || '—'} · {t.estate_name}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 rounded-card border border-ink-200/80 bg-white shadow-card empty:hidden">
            <Pager page={current} pageSize={PAGE_SIZE} total={listed.length} onPage={(n) => setParams({ page: String(n) })} label="Test list pages" />
          </div>
        </section>
      </div>

      {scheduling && <ScheduleTestModal onClose={() => setScheduling(false)} />}
    </>
  )
}

function MonthGrid({
  first,
  last,
  byDay,
  selected,
  onPick,
}: {
  first: Date
  last: Date
  byDay: Map<string, PlanTest[]>
  selected: string
  onPick: (day: string) => void
}) {
  const leading = (first.getDay() + 6) % 7 // Monday first
  const cells: (Date | null)[] = [...Array<null>(leading).fill(null)]
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d))
  while (cells.length % 7) cells.push(null)
  const todayIso = iso(new Date())

  return (
    <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card" role="grid" aria-label="Calendar">
      <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/60 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const key = date ? iso(date) : ''
          const items = date ? (byDay.get(key) ?? []) : []
          const isSelected = !!date && key === selected
          return (
            <div
              key={i}
              role="gridcell"
              aria-selected={date ? isSelected : undefined}
              aria-label={date ? `${date.getDate()}: ${items.length} test${items.length === 1 ? '' : 's'}` : undefined}
              onClick={date ? () => onPick(key) : undefined}
              onKeyDown={date ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(key) } } : undefined}
              tabIndex={date ? 0 : undefined}
              className={`min-h-20 border-b border-r border-ink-100 p-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 ${date ? 'cursor-pointer hover:bg-ink-50' : 'bg-ink-50/40'} ${
                isSelected ? 'bg-brand-50 ring-2 ring-inset ring-brand-400' : key === todayIso ? 'bg-brand-50/50' : ''
              }`}
            >
              {date && (
                <div className={`mb-1 flex items-center justify-between tabular-nums ${key === todayIso || isSelected ? 'font-semibold text-brand-700' : 'text-ink-500'}`}>
                  <span>{date.getDate()}</span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-ink-100 px-1.5 text-[10px] font-semibold text-ink-600" title={`${items.length} test${items.length === 1 ? '' : 's'}`}>
                      {items.length}
                    </span>
                  )}
                </div>
              )}
              {items.slice(0, 3).map((t) => (
                <Link
                  key={t.test_id}
                  to={`/tests/${t.test_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`mb-0.5 block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    t.status === 'Cancelled' ? 'bg-ink-100 text-ink-500 line-through' : t.status === 'Completed' ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-100 text-brand-800'
                  }`}
                  title={`${t.test_type} · ${t.cost_code_label}`}
                >
                  {t.cost_code_label}
                </Link>
              ))}
              {items.length > 3 && <div className="text-[11px] text-ink-500">+{items.length - 3} more</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ScheduleTestModal({ costCodeId: fixed, onClose }: { costCodeId?: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [costCodeId, setCostCodeId] = useState<number | null>(fixed ?? null)
  const [form, setForm] = useState({ test_type: 'Tabletop Exercise' as TestType, scheduled_date: '', scheduled_time: '', comments: '' })
  const schedule = useMutation({
    mutationFn: () => opsApi.scheduleTest(costCodeId as number, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tests'] })
      void queryClient.invalidateQueries({ queryKey: ['cost-codes'] })
      onClose()
    },
  })
  const failure = schedule.error ? toApiError(schedule.error) : null

  return (
    <Modal title="Schedule a test" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          schedule.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}
        {fixed === undefined && <CostCodePicker value={costCodeId} onChange={(id) => setCostCodeId(id)} />}
        <Field label="Type of test">
          <Select value={form.test_type} onChange={(e) => setForm({ ...form, test_type: e.target.value as TestType })} aria-label="Type of test">
            {TEST_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" error={failure?.field_errors.scheduled_date?.[0]}>
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={schedule.isPending || costCodeId === null}>
            {schedule.isPending ? 'Scheduling' : 'Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
