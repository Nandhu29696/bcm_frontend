import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Alert, Badge, PageHeader, Select, Spinner, StatusBadge } from '@/components/ui'
import { estateApi, estateKeys } from '@/features/estates/api'
import { formatDate } from '@/features/operations/format'
import { formatDateTime } from '@/features/plans/format'

import { insightsApi, insightsKeys, type Dashboard, type StatusRow } from './api'

/**
 * The BCP statuses in reading order, with the status palette. These are
 * states, so they wear the reserved status colours; the legend and the
 * counts beside every mark mean nothing is said by colour alone.
 */
const STATUS_ORDER = ['Approved', 'Pending BU Lead Review', 'Work in Progress', 'Rework', 'Not Started', 'Exempted']
const STATUS_HEX: Record<string, string> = {
  Approved: '#10b981',
  'Pending BU Lead Review': '#f59e0b',
  'Work in Progress': '#3b82f6',
  Rework: '#ef4444',
  'Not Started': '#c7cbd4',
  Exempted: '#8b5cf6',
}
const SHORT_STATUS: Record<string, string> = {
  Approved: 'Approved',
  'Pending BU Lead Review': 'In review',
  'Work in Progress': 'In progress',
  Rework: 'Rework',
  'Not Started': 'Not started',
  Exempted: 'Exempted',
}

/**
 * The programme at a glance (Phase 9.2). Every figure comes from one
 * server payload built in the caller's scope; nothing is computed here, so
 * the numbers on this page are the numbers in the reports.
 *
 * Laid out to fit a screen: a strip of figures, then the status donut beside
 * the breakdown (estate / region / line of business as tabs), then risk, then
 * the three operational panels — rather than one long column of bars.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const estateId = Number(searchParams.get('estate')) || null
  const estates = useQuery({ queryKey: estateKeys.all, queryFn: estateApi.list })
  const dashboard = useQuery({ queryKey: insightsKeys.dashboard(estateId), queryFn: () => insightsApi.dashboard(estateId) })

  return (
    <>
      <PageHeader
        title="Dashboard"
        eyebrow="Programme status"
        subtitle={
          dashboard.data ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {`As of ${formatDateTime(dashboard.data.generated_at)}`}
              {dashboard.data.narrowed_to_own && (
                <Badge className="bg-brand-50 text-brand-800">My cost codes</Badge>
              )}
            </span>
          ) : undefined
        }
      >
        <Select
          value={estateId ?? ''}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('estate', e.target.value)
            else next.delete('estate')
            setSearchParams(next, { replace: true })
          }}
          aria-label="Estate"
          className="w-56"
        >
          <option value="">All estates</option>
          {estates.data?.map((estate) => (
            <option key={estate.estate_id} value={estate.estate_id}>
              {estate.estate_name}
            </option>
          ))}
        </Select>
      </PageHeader>

      {dashboard.isPending ? (
        <div className="py-16 text-center">
          <Spinner label="Loading dashboard" />
        </div>
      ) : dashboard.error ? (
        <Alert>{toApiError(dashboard.error).detail}</Alert>
      ) : (
        <DashboardBody data={dashboard.data} />
      )}
    </>
  )
}

function DashboardBody({ data }: { data: Dashboard }) {
  const t = data.totals
  return (
    <div className="space-y-4">
      <section aria-label="Headline figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Cost codes" value={t.cost_codes} />
        <Stat label="Approved plans" value={t.approved} sub={t.approval_rate !== null ? `${Math.round(t.approval_rate * 100)}% of cost codes` : undefined} tone="emerald" />
        <Stat label="In flight" value={t.in_flight} sub="WIP, in review or rework" tone="amber" />
        <Stat label="Not started" value={t.not_started} tone="ink" />
        <Stat label="Overdue actions" value={data.risk.overdue_actions} sub={`${data.risk.open_actions} open`} tone={data.risk.overdue_actions ? 'red' : 'ink'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="BCP status" subtitle={`${t.cost_codes} cost code${t.cost_codes === 1 ? '' : 's'} in scope`}>
          <StatusDonut counts={t.by_status} total={t.cost_codes} />
        </Panel>
        <StatusBreakdown data={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Risk heat map" subtitle={`${data.risk.total} risk${data.risk.total === 1 ? '' : 's'} on current versions`}>
          <HeatMap heat={data.risk.heat_map} />
          <LevelStrip levels={data.risk.by_level} total={data.risk.total} />
        </Panel>
        <Panel title="Overdue risk actions" subtitle={data.risk.overdue_actions ? `${data.risk.overdue_actions} past their target date` : 'Nothing overdue'}>
          {data.risk.overdue.length === 0 ? (
            <p className="text-sm text-ink-500">Every open action is within its target date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Cost code</th>
                    <th>Action</th>
                    <th>Owner</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.risk.overdue.slice(0, 6).map((a) => (
                    <tr key={a.risk_action_id}>
                      <td className="font-medium text-ink-900">{a.risk_name}</td>
                      <td className="whitespace-nowrap">
                        <Link to={`/plan-versions/${a.plan_version_id}`} className="text-brand-700 hover:underline">
                          {a.cost_code}
                        </Link>
                      </td>
                      <td>{a.action_type === 'MITIGATION' ? 'Mitigation' : 'Contingency'}</td>
                      <td className="whitespace-nowrap">{a.owner || '—'}</td>
                      <td className="whitespace-nowrap text-red-700" title={`Due ${formatDate(a.target_date)}`}>
                        {a.days_overdue}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.risk.overdue.length > 6 && (
                <p className="mt-2 text-xs text-ink-500">And {data.risk.overdue.length - 6} more — see the risk register on each plan.</p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Plan completion" subtitle={`${data.completion.open_versions} open version${data.completion.open_versions === 1 ? '' : 's'}`}>
          <Ring percent={data.completion.percent} label={`${data.completion.sections_completed} of ${data.completion.sections_total} sections`} />
        </Panel>
        <Panel title="Test coverage" subtitle={`Tested in the last ${data.tests.coverage.months} months`}>
          <Ring percent={data.tests.coverage.percent} label={`${data.tests.coverage.tested_cost_codes} of ${data.tests.coverage.cost_codes} cost codes`} tone="#8b5cf6" />
          <MiniBars rows={Object.entries(data.tests.by_status)} />
          {data.tests.upcoming.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-ink-100 pt-2 text-xs" aria-label="Upcoming tests">
              {data.tests.upcoming.slice(0, 3).map((u) => (
                <li key={u.test_id} className="flex justify-between gap-2">
                  <Link to={`/tests/${u.test_id}`} className="truncate text-brand-700 hover:underline">
                    {u.test_type} · {u.cost_code}
                  </Link>
                  <span className="shrink-0 text-ink-500">{formatDate(u.scheduled_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Call tree response" subtitle={`${data.call_tree.live_runs} live · ${data.call_tree.simulation_runs} simulated`}>
          <Ring percent={data.call_tree.response_rate !== null ? Math.round(data.call_tree.response_rate * 1000) / 10 : null} label={`${data.call_tree.reached} of ${data.call_tree.members} reached (live)`} tone="#0ea5e9" />
          <MiniBars
            rows={[
              ['Voice', data.call_tree.reached_by_channel.VOICE ?? 0],
              ['Teams', data.call_tree.reached_by_channel.MS_TEAMS ?? 0],
              ['Email', data.call_tree.reached_by_channel.EMAIL ?? 0],
            ]}
          />
        </Panel>
        <Panel title="Exemption register" subtitle={`${data.exemptions.total} on current versions`}>
          <MiniBars rows={Object.entries(data.exemptions.by_status)} />
          {data.exemptions.register.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-2 text-xs" aria-label="Recent exemptions">
              {data.exemptions.register.slice(0, 4).map((e) => (
                <li key={e.exemption_id} className="flex items-center justify-between gap-2">
                  <Link to={`/cost-codes/${e.cost_code_id}`} className="truncate text-brand-700 hover:underline" title={e.reason}>
                    {e.cost_code}
                  </Link>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Building blocks
// --------------------------------------------------------------------------- //

function Stat({ label, value, sub, tone = 'brand' }: { label: string; value: number; sub?: string; tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'ink' }) {
  const tones = { brand: 'text-brand-700', emerald: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', ink: 'text-ink-700' }
  return (
    <div className="rounded-card border border-ink-200/80 bg-white px-4 py-3 shadow-card">
      <div className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="truncate text-xs text-ink-500">{sub}</div>}
    </div>
  )
}

function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border border-ink-200/80 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Shared legend: colour beside a label, never colour alone. */
function StatusLegend({ counts }: { counts?: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-600" aria-label="Status legend">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[s] }} aria-hidden="true" />
          {SHORT_STATUS[s]}
          {counts && <span className="tabular-nums text-ink-900">{counts[s] ?? 0}</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * One donut for the whole scope: the share of cost codes in each status,
 * approved as the hero figure in the middle. Segments are separated by a 2px
 * surface gap; hovering a segment names it, and the legend carries every count.
 */
function StatusDonut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const [active, setActive] = useState<string | null>(null)
  const size = 168
  const stroke = 22
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = total > 1 ? 2 : 0
  const segments = STATUS_ORDER.reduce<{ status: string; n: number; length: number; offset: number }[]>((acc, status) => {
    const n = counts[status] ?? 0
    if (!n) return acc
    const previous = acc.at(-1)
    const offset = previous ? previous.offset + previous.length : 0
    acc.push({ status, n, length: total ? (c * n) / total : 0, offset })
    return acc
  }, [])
  const approved = counts.Approved ?? 0
  const shown = active ? segments.find((s) => s.status === active) : null

  if (total === 0) return <p className="text-sm text-ink-500">No cost codes in scope.</p>
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={STATUS_ORDER.map((s) => `${s} ${counts[s] ?? 0}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
          {segments.map((s) => (
            <circle
              key={s.status}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={STATUS_HEX[s.status]}
              strokeWidth={active && active !== s.status ? stroke - 6 : stroke}
              strokeDasharray={`${Math.max(0, s.length - gap)} ${c - Math.max(0, s.length - gap)}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-width 120ms', cursor: 'default' }}
              onMouseEnter={() => setActive(s.status)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${s.status}: ${s.n} (${Math.round((100 * s.n) / total)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {shown ? (
            <>
              <span className="text-2xl font-semibold tabular-nums text-ink-900">{shown.n}</span>
              <span className="max-w-[100px] text-[11px] leading-tight text-ink-500">{SHORT_STATUS[shown.status]}</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold tabular-nums text-ink-900">{total ? Math.round((100 * approved) / total) : 0}%</span>
              <span className="text-[11px] text-ink-500">approved</span>
            </>
          )}
        </div>
      </div>
      <ul className="min-w-[150px] flex-1 space-y-1 text-sm" aria-label="Status counts">
        {STATUS_ORDER.map((s) => (
          <li
            key={s}
            className={`flex items-center justify-between gap-3 rounded px-1 ${active === s ? 'bg-ink-50' : ''}`}
            onMouseEnter={() => setActive(s)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="inline-flex items-center gap-2 text-ink-700">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_HEX[s] }} aria-hidden="true" />
              {SHORT_STATUS[s]}
            </span>
            <span className="tabular-nums text-ink-900">{counts[s] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const BREAKDOWNS = [
  { key: 'estate', label: 'Estate', title: 'BCP status by estate' },
  { key: 'region', label: 'Region', title: 'BCP status by region' },
  { key: 'lob', label: 'Line of business', title: 'BCP status by line of business' },
] as const

/** Estate / region / line of business share one panel, one bar per row, one legend. */
function StatusBreakdown({ data }: { data: Dashboard }) {
  const [tab, setTab] = useState<(typeof BREAKDOWNS)[number]['key']>('estate')
  const rows = tab === 'estate' ? data.status_by_estate : tab === 'region' ? data.status_by_region : data.status_by_lob
  const current = BREAKDOWNS.find((b) => b.key === tab)!
  return (
    <Panel
      title={current.title}
      subtitle="Cost codes by BCP status"
      actions={
        <div role="tablist" aria-label="Break down by" className="flex rounded-full border border-ink-200 bg-ink-50 p-0.5 text-xs">
          {BREAKDOWNS.map((b) => (
            <button
              key={b.key}
              role="tab"
              aria-selected={tab === b.key}
              onClick={() => setTab(b.key)}
              className={`rounded-full px-2.5 py-1 font-medium transition-colors ${tab === b.key ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-900'}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      }
    >
      <StatusBars rows={rows} linkTo={tab === 'estate' ? (row) => (row.id ? `/estates/${row.id}/cost-codes` : undefined) : undefined} />
      <div className="mt-3 border-t border-ink-100 pt-2">
        <StatusLegend />
      </div>
    </Panel>
  )
}

function StatusBars({ rows, linkTo }: { rows: StatusRow[]; linkTo?: (row: StatusRow) => string | undefined }) {
  if (rows.length === 0) return <p className="text-sm text-ink-500">No cost codes in scope.</p>
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const href = linkTo?.(row)
        return (
          <div key={`${row.id}-${row.name}`} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
            {href ? (
              <Link to={href} className="truncate font-medium text-brand-700 hover:underline">
                {row.name}
              </Link>
            ) : (
              <span className="truncate font-medium text-ink-900">{row.name}</span>
            )}
            <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-ink-100" role="img" aria-label={STATUS_ORDER.map((s) => `${s} ${row[s]}`).join(', ')}>
              {STATUS_ORDER.map((status) => {
                const n = row[status] as number
                if (!n) return null
                return (
                  <div key={status} style={{ width: `${(100 * n) / row.total}%`, background: STATUS_HEX[status] }} title={`${status}: ${n}`} />
                )
              })}
            </div>
            <span className="w-24 text-right text-xs tabular-nums text-ink-500">
              {row.Approved as number}/{row.total} approved
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** A radial progress: the one figure, in the middle, with what it is of. */
function Ring({ percent, label, tone = '#4f6df5' }: { percent: number | null; label: string; tone?: string }) {
  const size = 92
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const value = percent ?? 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f4" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * value) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 300ms' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums text-ink-900">
          {percent === null ? '—' : `${Math.round(percent)}%`}
        </span>
      </div>
      <span className="text-sm text-ink-700">{label}</span>
    </div>
  )
}

/** Small horizontal bars for a handful of labelled counts. */
function MiniBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  if (rows.length === 0) return null
  return (
    <dl className="mt-3 space-y-1.5">
      {rows.map(([label, n]) => (
        <div key={label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-xs">
          <dt className="truncate text-ink-600">{label}</dt>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-400" style={{ width: `${(100 * n) / max}%` }} />
          </div>
          <dd className="w-6 text-right font-medium tabular-nums text-ink-900">{n}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Risks by level, as a proportional strip under the heat map. */
function LevelStrip({ levels, total }: { levels: Record<string, number>; total: number }) {
  const order = ['High', 'Moderate', 'Low']
  const hex: Record<string, string> = { High: '#ef4444', Moderate: '#f59e0b', Low: '#10b981' }
  if (!total) return null
  return (
    <div className="mt-3 border-t border-ink-100 pt-2">
      <div className="flex h-2 gap-px overflow-hidden rounded-full bg-ink-100" role="img" aria-label={order.map((l) => `${l} ${levels[l] ?? 0}`).join(', ')}>
        {order.map((l) => (levels[l] ? <div key={l} style={{ width: `${(100 * levels[l]) / total}%`, background: hex[l] }} title={`${l}: ${levels[l]}`} /> : null))}
      </div>
      <ul className="mt-1.5 flex gap-3 text-xs text-ink-600">
        {order.map((l) => (
          <li key={l} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: hex[l] }} aria-hidden="true" />
            {l} <span className="tabular-nums text-ink-900">{levels[l] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HeatMap({ heat }: { heat: Dashboard['risk']['heat_map'] }) {
  if (heat.likelihood.length === 0) return <p className="text-sm text-ink-500">The rating catalogue is empty.</p>
  const max = Math.max(1, ...heat.cells.flat())
  // Rows: likelihood high to low; columns: severity low to high.
  const rows = [...heat.likelihood].map((l, i) => ({ ...l, cells: heat.cells[i] })).reverse()
  return (
    <table className="w-full border-separate border-spacing-1 text-center text-sm" aria-label="Risk heat map">
      <thead>
        <tr>
          <th className="whitespace-nowrap text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-500">
            Likelihood ↓ · Severity →
          </th>
          {heat.severity.map((s) => (
            <th key={s.points} className="text-xs font-medium text-ink-600">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.points}>
            <th className="text-left text-xs font-medium text-ink-600">{row.label}</th>
            {row.cells.map((n, j) => {
              const danger = (row.points * heat.severity[j].points) / (heat.likelihood.at(-1)!.points * heat.severity.at(-1)!.points)
              const bg = danger >= 0.66 ? 'bg-red-100' : danger >= 0.33 ? 'bg-amber-100' : 'bg-emerald-100'
              return (
                <td key={j} className={`rounded-control py-2 font-semibold tabular-nums ${bg} ${n ? 'text-ink-900' : 'text-ink-400'}`} style={{ opacity: 0.45 + (0.55 * n) / max }}>
                  {n}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
