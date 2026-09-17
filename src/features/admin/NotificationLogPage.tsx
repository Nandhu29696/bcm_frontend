import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { api, toApiError } from '@/api/client'
import { Alert, Button, EmptyState, Input, PageHeader, Select, Spinner, StatusBadge } from '@/components/ui'
import { useToast } from '@/components/useToast'
import { formatDateTime } from '@/features/plans/format'

interface LogRow {
  notification_log_id: number
  event_type: string
  to_email: string
  cc_emails: string
  subject: string
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED'
  attempts: number
  error_detail: string
  sent_at: string | null
  created_at: string
  resendable: boolean
}

const logApi = {
  list: async (status: string, search: string): Promise<{ results: LogRow[]; counts: Record<string, number> }> =>
    (await api.get('/admin/notifications/', { params: { ...(status ? { status } : {}), ...(search ? { search } : {}) } })).data,
  resend: async (id: number): Promise<LogRow> => (await api.post(`/admin/notifications/${id}/resend/`)).data,
}

/** The email delivery log with a Resend button: what the runbook did from a shell (PENDING #28). */
export function NotificationLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? 'FAILED'
  const search = searchParams.get('search') ?? ''
  const queryClient = useQueryClient()
  const toast = useToast()
  const log = useQuery({ queryKey: ['admin', 'notifications', status, search], queryFn: () => logApi.list(status, search) })
  const resend = useMutation({
    mutationFn: (id: number) => logApi.resend(id),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] })
      toast[row.status === 'SENT' ? 'success' : 'error'](row.status === 'SENT' ? `Re-sent to ${row.to_email}` : `Still failing: ${row.error_detail || row.status}`)
    },
    onError: (error) => toast.error(toApiError(error).detail),
  })

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }
  const counts = log.data?.counts ?? {}
  const matchingCount = status ? counts[status] : Object.values(counts).reduce((total, count) => total + count, 0)

  return (
    <>
      <PageHeader
        title="Notification delivery"
        eyebrow="Administration"
        subtitle={log.data ? `${counts.FAILED ?? 0} failed · ${counts.PENDING ?? 0} pending · ${counts.SENT ?? 0} sent` : undefined}
      />
      <div className="mb-5 rounded-card border border-ink-200/80 bg-white p-3 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="lg:w-44">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Delivery status</span>
            <Select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
              <option value="SENT">Sent</option>
              <option value="SUPPRESSED">Suppressed</option>
              <option value="">All statuses</option>
            </Select>
          </label>
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Find a notification</span>
            <Input type="search" value={search} onChange={(e) => setParam('search', e.target.value)} placeholder="Search recipient or subject" aria-label="Search notifications" />
          </label>
          {search && (
            <Button type="button" size="sm" variant="ghost" className="lg:mb-0.5" onClick={() => setSearchParams({}, { replace: true })}>
              Clear filters
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
          <span className="font-medium text-ink-700">{matchingCount ?? '...'} matching notifications</span>
          <span className="text-ink-300" aria-hidden="true">|</span>
          <span>{counts.FAILED ?? 0} failed</span>
          <span>{counts.PENDING ?? 0} pending</span>
          <span>{counts.SENT ?? 0} sent</span>
        </div>
      </div>

      {log.isPending ? (
        <div className="py-16 text-center">
          <Spinner label="Loading delivery log" />
        </div>
      ) : log.error ? (
        <Alert>{toApiError(log.error).detail}</Alert>
      ) : log.data.results.length === 0 ? (
        <EmptyState title="Nothing here" description={status === 'FAILED' ? 'No failed deliveries.' : 'No notifications match.'} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-200/80 bg-white shadow-card">
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Error</th>
                <th className="w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {log.data.results.map((row) => (
                <tr key={row.notification_log_id}>
                  <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(row.created_at)}</td>
                  <td>
                    {row.to_email}
                    {row.cc_emails && <span className="block text-xs text-ink-500">cc {row.cc_emails}</span>}
                  </td>
                  <td>
                    <span className="text-ink-900">{row.subject}</span>
                    <span className="block text-xs text-ink-500">{row.event_type}</span>
                  </td>
                  <td>
                    <StatusBadge status={row.status === 'SENT' ? 'Completed' : row.status === 'FAILED' ? 'Failed' : row.status === 'PENDING' ? 'PENDING' : 'Cancelled'} />
                    <span className="block text-xs text-ink-500">{row.attempts} attempt{row.attempts === 1 ? '' : 's'}</span>
                  </td>
                  <td className="max-w-64 truncate text-xs text-red-700" title={row.error_detail}>
                    {row.error_detail || '—'}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      {row.resendable && (
                        <Button size="sm" variant="secondary" onClick={() => resend.mutate(row.notification_log_id)} disabled={resend.isPending} aria-label={`Resend to ${row.to_email}`}>
                          Resend
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
