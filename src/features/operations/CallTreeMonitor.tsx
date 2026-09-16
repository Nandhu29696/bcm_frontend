import { useQuery } from '@tanstack/react-query'

import { toApiError } from '@/api/client'
import { Alert, Badge, Spinner, StatusBadge } from '@/components/ui'
import { formatDateTime } from '@/features/plans/format'

import { CHANNEL_LABEL, opsApi, opsKeys, type Attempt, type RunSummary } from './api'

/**
 * A call tree run, live. Polls every three seconds while the run is RUNNING
 * and stops the moment it is not - the server is the only source of truth
 * for what has been dialled, so nothing here is optimistic.
 */
export function CallTreeMonitor({ run }: { run: RunSummary }) {
  const runId = run.call_tree_run_id
  const detail = useQuery({
    queryKey: opsKeys.run(runId),
    queryFn: () => opsApi.run(runId),
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? 3000 : false),
  })
  const report = useQuery({
    queryKey: opsKeys.runReport(runId),
    queryFn: () => opsApi.runReport(runId),
    enabled: detail.data?.status !== 'RUNNING',
  })

  if (detail.isPending) {
    return (
      <div className="py-6 text-center">
        <Spinner label="Loading call tree" />
      </div>
    )
  }
  if (detail.error) return <Alert>{toApiError(detail.error).detail}</Alert>

  const data = detail.data
  const live = Object.entries(data.providers_enabled).filter(([, on]) => on).map(([k]) => CHANNEL_LABEL[k as keyof typeof CHANNEL_LABEL] ?? k)

  return (
    <section aria-label="Call tree run" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={data.status} />
        <span className="font-mono text-xs text-ink-500">{data.broadcast_id}</span>
        {data.simulation_flag ? (
          <Badge className="bg-violet-50 text-violet-800">Simulation</Badge>
        ) : (
          <Badge className="bg-red-50 text-red-800">Live{live.length ? ` · ${live.join(', ')}` : ''}</Badge>
        )}
        <span className="text-ink-500">
          {data.reached}/{data.members} reached
          {data.started_at ? ` · started ${formatDateTime(data.started_at)}` : ''}
          {data.completed_at ? ` · completed ${formatDateTime(data.completed_at)}` : ''}
        </span>
      </div>

      {report.data && (
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Response by level">
          {report.data.by_level.map((row) => (
            <div key={row.level} className="rounded-control border border-ink-200/80 bg-ink-50/60 px-3.5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                Level {row.level} · {row.label}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
                {row.members_reached}
                <span className="text-sm font-normal text-ink-500"> / {row.members_attempted} reached</span>
              </div>
              <div className="text-xs text-ink-500">
                {row.attempts} attempt{row.attempts === 1 ? '' : 's'}
                {row.response_rate !== null ? ` · ${Math.round(row.response_rate * 100)}%` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-ink-200/80 bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Member</th>
              <th>Contact</th>
              <th>Stage</th>
              <th>Attempts</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.members_detail.map((member) => (
              <tr key={member.call_tree_member_id}>
                <td className="tabular-nums text-ink-500">{member.sequence_number}</td>
                <td className="font-medium text-ink-900">{member.member_name}</td>
                <td className="text-xs text-ink-500">
                  {member.phone_number || '—'}
                  <br />
                  {member.member_email || ''}
                </td>
                <td>{member.stage}</td>
                <td>
                  <ol className="flex flex-wrap gap-1" aria-label={`Attempts for ${member.member_name}`}>
                    {member.attempts.map((attempt) => (
                      <AttemptChip key={attempt.call_attempt_id} attempt={attempt} />
                    ))}
                  </ol>
                </td>
                <td>
                  {member.reached_flag ? (
                    <span className="font-medium text-emerald-700">Reached · {CHANNEL_LABEL[member.reached_channel as keyof typeof CHANNEL_LABEL]}</span>
                  ) : member.completed_at ? (
                    <span className="font-medium text-red-700">Not reached</span>
                  ) : (
                    <span className="text-ink-500">Calling</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AttemptChip({ attempt }: { attempt: Attempt }) {
  const ok = ['Answered', 'Acknowledged'].includes(attempt.attempt_status)
  const pending = attempt.attempt_status === 'Calling'
  const tone = ok ? 'bg-emerald-50 text-emerald-800' : pending ? 'bg-amber-50 text-amber-900' : 'bg-ink-100 text-ink-600'
  return (
    <li
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
      title={`${attempt.attempted_at ? formatDateTime(attempt.attempted_at) : ''} ${attempt.comments}`.trim()}
    >
      {CHANNEL_LABEL[attempt.channel]} {attempt.attempt_number}: {attempt.attempt_status}
    </li>
  )
}
