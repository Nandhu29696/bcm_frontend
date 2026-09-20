import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button, StatusBadge } from '@/components/ui'

import { opsApi, opsKeys } from './api'
import { DeclareEventModal } from './CrisisPage'
import { RosterPanel } from './RosterPanel'
import { ScheduleTestModal } from './TestsPage'
import { formatDate } from './format'

/**
 * Journey step 8 from the cost code page: its tests, its crisis events and
 * the committee the call tree dials. Actions open the same dialogs as the
 * Tests and Crisis pages, with the cost code already chosen.
 */
export function CostCodeOperations({ costCodeId }: { costCodeId: number }) {
  const tests = useQuery({ queryKey: opsKeys.costCodeTests(costCodeId), queryFn: () => opsApi.costCodeTests(costCodeId) })
  const events = useQuery({ queryKey: opsKeys.costCodeEvents(costCodeId), queryFn: () => opsApi.costCodeEvents(costCodeId) })
  const [dialog, setDialog] = useState<'test' | 'event' | null>(null)
  const canManage = tests.data?.[0]?.can_manage ?? events.data?.[0]?.can_manage

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section aria-label="Tests" className="rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Tests</h2>
            <p className="mt-1 text-xs text-ink-400">{tests.data?.length ?? 0} total</p>
          </div>
          {canManage !== false && (
            <Button size="sm" variant="secondary" onClick={() => setDialog('test')}>
              Schedule
            </Button>
          )}
        </div>
        {tests.data?.length ? (
          <>
          <ul className="divide-y divide-ink-100 text-sm">
            {tests.data.slice(0, 6).map((t) => (
              <li key={t.test_id} className="flex items-center justify-between gap-3 py-2">
                <Link to={`/tests/${t.test_id}`} className="font-medium text-brand-700 hover:underline">
                  {t.test_type}
                </Link>
                <span className="text-xs text-ink-500">{formatDate(t.scheduled_date)}</span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
          {tests.data.length > 6 && (
            <Link to="/tests" className="mt-3 block text-xs font-semibold text-brand-700 hover:underline">
              View all tests ({tests.data.length - 6} more)
            </Link>
          )}
          </>
        ) : (
          <p className="text-sm text-ink-500">{tests.isPending ? 'Loading' : 'No tests scheduled.'}</p>
        )}
      </section>

      <section aria-label="Crisis events" className="rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Crisis events</h2>
            <p className="mt-1 text-xs text-ink-400">{events.data?.length ?? 0} total</p>
          </div>
          {canManage !== false && (
            <Button size="sm" variant="secondary" onClick={() => setDialog('event')}>
              Declare
            </Button>
          )}
        </div>
        {events.data?.length ? (
          <>
          <ul className="divide-y divide-ink-100 text-sm">
            {events.data.slice(0, 6).map((e) => (
              <li key={e.crisis_event_id} className="flex items-center justify-between gap-3 py-2">
                <Link to={`/crisis/${e.crisis_event_id}`} className="font-medium text-brand-700 hover:underline">
                  {e.event_type}
                </Link>
                <span className="text-xs text-ink-500">{formatDate(e.event_date)}</span>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
          {events.data.length > 6 && (
            <Link to="/crisis" className="mt-3 block text-xs font-semibold text-brand-700 hover:underline">
              View all events ({events.data.length - 6} more)
            </Link>
          )}
          </>
        ) : (
          <p className="text-sm text-ink-500">{events.isPending ? 'Loading' : 'No crisis events.'}</p>
        )}
      </section>

      <div className="lg:col-span-2">
        <RosterPanel costCodeId={costCodeId} />
      </div>

      {dialog === 'test' && <ScheduleTestModal costCodeId={costCodeId} onClose={() => setDialog(null)} />}
      {dialog === 'event' && <DeclareEventModal costCodeId={costCodeId} onClose={() => setDialog(null)} />}
    </div>
  )
}
