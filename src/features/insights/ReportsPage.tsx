import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { useToast } from '@/components/useToast'
import { pageOf } from '@/components/paging'
import { Alert, Button, EmptyState, Field, PageHeader, Pager, Select, StatusBadge, TableSkeleton } from '@/components/ui'
import { estateApi, estateKeys } from '@/features/estates/api'
import { formatDateTime } from '@/features/plans/format'
import { reviewApi } from '@/features/review/api'

import { insightsApi, insightsKeys } from './api'

/**
 * Reports (Phase 9.3-9.4): request one now or on a schedule, get it by email,
 * download past outputs. The estate detail report can also be pulled straight
 * into the browser.
 */
export function ReportsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const types = useQuery({ queryKey: insightsKeys.reportTypes, queryFn: insightsApi.reportTypes })
  const estates = useQuery({ queryKey: estateKeys.all, queryFn: estateApi.list })
  const requests = useQuery({
    queryKey: insightsKeys.reportRequests,
    queryFn: insightsApi.reportRequests,
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'PENDING') ? 3000 : false),
  })
  const [form, setForm] = useState({ report_type: 'ESTATE_DETAIL', report_format: 'xlsx', schedule: 'ONCE', estate_id: '' })
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  function setPage(n: number) {
    const next = new URLSearchParams(searchParams)
    if (n > 1) next.set('page', String(n))
    else next.delete('page')
    setSearchParams(next, { replace: true })
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: insightsKeys.reportRequests })
  }
  const request = useMutation({
    mutationFn: () => insightsApi.requestReport({ ...form, estate_id: form.estate_id ? Number(form.estate_id) : null }),
    onSuccess: (created) => {
      refresh()
      toast.success(created.schedule === 'ONCE' ? 'Report requested - you will be emailed a link' : 'Report scheduled')
    },
  })
  const run = useMutation({ mutationFn: (id: number) => insightsApi.runReport(id), onSuccess: refresh })
  const stop = useMutation({ mutationFn: (id: number) => insightsApi.stopReport(id), onSuccess: refresh })
  const download = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })
  const inline = useMutation({
    mutationFn: async (fileFormat: string) => {
      const blob = await insightsApi.estateDetailFile(form.estate_id ? Number(form.estate_id) : null, fileFormat)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estate-detail-report.${fileFormat}`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const selected = types.data?.types.find((t) => t.code === form.report_type)
  const formats = selected?.formats ?? ['xlsx']
  const failure = request.error ? toApiError(request.error) : null

  return (
    <>
      <PageHeader title="Reports" eyebrow="Exports and schedules" subtitle="Reports are built in your data scope and emailed to you with a download link." />

      {/* The request form is one row across the top; the report list gets the
          full width beneath it, where its five columns have room. */}
      <div className="space-y-6">
        <section aria-label="Request a report" className="rounded-card border border-ink-200/80 bg-white p-4 shadow-card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Request a report</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              request.mutate()
            }}
          >
            {failure && <Alert>{failure.detail}</Alert>}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto] xl:items-end">
            <Field label="Report">
              <Select
                value={form.report_type}
                onChange={(e) => {
                  const next = types.data?.types.find((t) => t.code === e.target.value)
                  setForm({ ...form, report_type: e.target.value, report_format: next?.formats.includes(form.report_format) ? form.report_format : (next?.formats[0] ?? 'xlsx') })
                }}
                aria-label="Report"
              >
                {types.data?.types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
              <Field label="Format">
                <Select value={form.report_format} onChange={(e) => setForm({ ...form, report_format: e.target.value })} aria-label="Format">
                  {formats.map((f) => (
                    <option key={f} value={f}>
                      {f.toUpperCase()}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Schedule">
                <Select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} aria-label="Schedule">
                  {types.data?.schedules.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            <Field label="Estate">
              <Select value={form.estate_id} onChange={(e) => setForm({ ...form, estate_id: e.target.value })} aria-label="Estate">
                <option value="">All estates</option>
                {estates.data?.map((estate) => (
                  <option key={estate.estate_id} value={estate.estate_id}>
                    {estate.estate_name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-end justify-end gap-2">
              {form.report_type === 'ESTATE_DETAIL' && (
                <Button type="button" variant="secondary" onClick={() => inline.mutate(form.report_format)} disabled={inline.isPending}>
                  {inline.isPending ? 'Building' : 'Download now'}
                </Button>
              )}
              <Button type="submit" disabled={request.isPending}>
                {request.isPending ? 'Requesting' : form.schedule === 'ONCE' ? 'Request report' : 'Schedule report'}
              </Button>
            </div>
            </div>
            <p className="text-xs text-ink-500">
              Leave the estate empty for every estate in your scope.
              {form.report_type === 'ESTATE_DETAIL' && <> <strong className="font-medium text-ink-700">Download now</strong> builds the file in your browser straight away;</>}{' '}
              <strong className="font-medium text-ink-700">{form.schedule === 'ONCE' ? 'Request report' : 'Schedule report'}</strong>{' '}
              {form.schedule === 'ONCE' ? 'builds it in the background and emails you a download link.' : `runs it ${form.schedule.toLowerCase()} and emails you a link each time.`}
            </p>
          </form>
        </section>

        <section aria-label="My reports" className="min-w-0">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            My reports
            {requests.data && <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 tabular-nums text-ink-600">{requests.data.length}</span>}
          </h2>
          {requests.isPending ? (
            <TableSkeleton cols={5} label="Loading reports" />
          ) : requests.error ? (
            <Alert>{toApiError(requests.error).detail}</Alert>
          ) : requests.data.length === 0 ? (
            <EmptyState title="No reports yet" description="Requested and scheduled reports appear here with their latest output." />
          ) : (
            <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Last run</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageOf(requests.data, page).map((r) => (
                    <tr key={r.report_request_id}>
                      <td>
                        <span className="font-medium text-ink-900">{r.report_type_label}</span>
                        <span className="block text-xs text-ink-500">
                          {r.report_format.toUpperCase()}
                          {r.parameters.estate_id ? ` · ${estates.data?.find((e) => e.estate_id === r.parameters.estate_id)?.estate_name ?? 'one estate'}` : ' · all estates'}
                        </span>
                      </td>
                      <td>
                        {r.schedule === 'ONCE' ? 'Once' : `${r.schedule.charAt(0)}${r.schedule.slice(1).toLowerCase()}`}
                        {r.schedule !== 'ONCE' && (
                          <span className="block text-xs text-ink-500">{r.active_flag ? `next ${formatDateTime(r.next_run_at)}` : 'stopped'}</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.status === 'COMPLETED' ? 'Completed' : r.status === 'FAILED' ? 'Failed' : 'PENDING'} />
                        {r.last_error && <span className="block max-w-56 truncate text-xs text-red-700" title={r.last_error}>{r.last_error}</span>}
                      </td>
                      <td className="whitespace-nowrap text-ink-500">
                        {formatDateTime(r.last_run_at)}
                        <span className="block text-xs">{r.run_count} run{r.run_count === 1 ? '' : 's'}</span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {r.document && (
                            <Button size="sm" variant="secondary" onClick={() => download.mutate(r.document!.entity_document_id)} disabled={download.isPending}>
                              Download
                            </Button>
                          )}
                          {r.schedule !== 'ONCE' && r.active_flag && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => run.mutate(r.report_request_id)} disabled={run.isPending}>
                                Run now
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => stop.mutate(r.report_request_id)} disabled={stop.isPending}>
                                Stop
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={page} total={requests.data.length} onPage={setPage} label="Report pages" />
            </div>
          )}
        </section>
      </div>
    </>
  )
}
