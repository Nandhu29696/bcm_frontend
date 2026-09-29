import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { pageOf } from '@/components/paging'
import { Alert, EmptyState, PageHeader, Pager, Select, StatusBadge, TableSkeleton } from '@/components/ui'
import { formatDateTime } from '@/features/plans/format'

import { reviewApi, reviewKeys, type QueueRow } from './api'
import { ReviewActions } from './ReviewActions'

/**
 * The BU lead's review queue (Phase 6.2): every plan awaiting them, oldest
 * first, with approve / send back on the row and a link to the read-only plan.
 * Coordinators see the same list filtered to their own submissions, so they
 * can tell where a plan is without asking.
 *
 * Three figures across the top say how much is waiting and for how long; the
 * "Mine to decide" filter narrows the table to what the caller can act on.
 */
export function ReviewQueuePage() {
  const queue = useQuery({ queryKey: reviewKeys.queue, queryFn: reviewApi.queue })
  const [searchParams, setSearchParams] = useSearchParams()
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const show = searchParams.get('show') === 'mine' ? 'mine' : 'all'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: true })
  }

  if (queue.isPending) {
    return (
      <>
        <PageHeader title="Reviews" eyebrow="Plans awaiting a decision" />
        <TableSkeleton cols={6} label="Loading review queue" />
      </>
    )
  }
  if (queue.error) return <Alert>{toApiError(queue.error).detail}</Alert>

  const all = queue.data
  const mine = all.filter((r) => r.can_review)
  const rows = show === 'mine' ? mine : all
  const oldest = all.reduce<number>((days, r) => Math.max(days, daysSince(r.submitted_at)), 0)

  return (
    <>
      <PageHeader
        title="Reviews"
        eyebrow="Plans awaiting a decision"
        subtitle={all.length === 0 ? 'Nothing is waiting.' : `${all.length} pending${mine.length ? ` · ${mine.length} for you to decide` : ''}`}
      />

      {all.length > 0 && (
        <section aria-label="Queue summary" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label="Waiting for you" value={mine.length} tone={mine.length ? 'brand' : 'ink'} sub={mine.length ? 'you can approve or send back' : 'nothing needs your decision'} />
          <Figure label="Pending in total" value={all.length} tone="amber" sub="across the plans you can see" />
          <Figure label="Longest wait" value={oldest} unit={oldest === 1 ? 'day' : 'days'} tone={oldest > 7 ? 'red' : 'ink'} sub="since it was submitted" />
        </section>
      )}

      {all.length === 0 ? (
        <EmptyState
          title="No plans are waiting for review"
          description="Submitted plans appear here until they are approved or sent back. BU leads see the plans they lead; coordinators see their own submissions."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">
              Queue <span className="ml-1 rounded-full bg-ink-100 px-2 py-0.5 tabular-nums text-ink-600">{rows.length}</span>
            </span>
            <div className="w-44">
              <Select value={show} onChange={(e) => setParam('show', e.target.value === 'mine' ? 'mine' : '')} aria-label="Show">
                <option value="all">All pending</option>
                <option value="mine">Mine to decide</option>
              </Select>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">Nothing here needs your decision.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-brand-800">Plan</th>
                    <th className="text-brand-800">Version</th>
                    <th className="text-brand-800">Coordinators</th>
                    <th className="text-brand-800">BU lead</th>
                    <th className="text-brand-800">Waiting</th>
                    <th className="sticky right-0 z-20 bg-ink-50 text-right text-brand-800 shadow-[-4px_0_8px_-6px_oklch(0.2_0.05_270/0.45)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(rows, page).map((row) => {
                    const days = daysSince(row.submitted_at)
                    return (
                      <tr key={row.plan_version_id}>
                        <td>
                          <Link to={`/cost-codes/${row.cost_code_id}`} className="font-medium text-brand-700 hover:underline">
                            {row.cost_code}
                          </Link>
                          <span className="block text-xs text-ink-500">
                            {row.process_name || '—'} · {row.estate_name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="mr-2 tabular-nums">v{row.version_number}</span>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {row.coordinators.length === 0 ? (
                            <span className="text-ink-400">—</span>
                          ) : (
                            row.coordinators.map((c) => (
                              <span key={c.coordinator_assignment_id} className="block">
                                <span className="text-ink-900">{c.name}</span>
                                {c.coordinator_type && <span className="ml-1 text-ink-400">{c.coordinator_type}</span>}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">{row.bu_lead_name || <span className="text-ink-400">—</span>}</td>
                        <td className="whitespace-nowrap">
                          <span className={`font-medium tabular-nums ${days > 7 ? 'text-red-700' : 'text-ink-900'}`}>
                            {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
                          </span>
                          <span className="block text-xs text-ink-500">{formatDateTime(row.submitted_at)}</span>
                        </td>
                        <td className="sticky right-0 z-10 whitespace-nowrap bg-white text-right shadow-[-4px_0_8px_-6px_oklch(0.2_0.05_270/0.45)]">
                          <ActionMenu row={row} open={openActionId === row.plan_version_id} onToggle={() => setOpenActionId((current) => current === row.plan_version_id ? null : row.plan_version_id)} onClose={() => setOpenActionId(null)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} total={rows.length} onPage={(n) => setParam('page', String(n))} label="Review queue pages" />
        </div>
      )}
    </>
  )
}

function ActionMenu({ row, open, onToggle, onClose }: { row: QueueRow; open: boolean; onToggle: () => void; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) onClose()
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose])

  const menu = open && buttonRef.current ? (() => {
    const bounds = buttonRef.current.getBoundingClientRect()
    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label="Review actions"
        className="fixed z-[100] flex min-w-40 -translate-y-full origin-bottom-right flex-col gap-1 rounded-card border border-ink-200 bg-white p-1.5 shadow-raised"
        style={{ left: Math.max(8, bounds.right - 160), top: bounds.top - 8 }}
      >
        <Link
          to={`/plan-versions/${row.plan_version_id}`}
          role="menuitem"
          className="rounded-control px-3 py-2 text-xs font-medium text-ink-800 outline-none hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:ring-2 focus-visible:ring-brand-300"
          onClick={onClose}
        >
          Open plan
        </Link>
        {row.can_review && (
          <div className="flex flex-col gap-1 [&>button]:w-full">
            <ReviewActions version={row} compact />
          </div>
        )}
      </div>,
      document.body,
    )
  })() : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-control text-lg font-bold leading-none tracking-[0.15em] text-ink-500 outline-none hover:bg-brand-50 hover:text-brand-700 focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-300"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open review actions"
        title="Open review actions"
        onClick={onToggle}
      >
        ...
      </button>
      {menu}
    </>
  )
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

function Figure({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: number
  unit?: string
  sub?: string
  tone: 'brand' | 'amber' | 'red' | 'ink'
}) {
  const tones = { brand: 'text-brand-700', amber: 'text-amber-700', red: 'text-red-700', ink: 'text-ink-700' }
  return (
    <div className="rounded-card border border-ink-200/80 bg-white px-4 py-3 shadow-card">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-500">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </div>
  )
}
