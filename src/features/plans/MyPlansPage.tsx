import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { Button, EmptyState, FilterItem, Input, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { IconEye, IconSearch } from '@/components/icons'
import { estateApi } from '@/features/estates/api'
import { MultiSelect } from '@/features/estates/FilterBar'
import { BCP_STATUS } from '@/features/estates/types'
import { fetchMasterData, masterDataKey } from './api'

import { planKeys, plansApi } from './api'

const PAGE_SIZE = 5

export function MyPlansPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const filters = {
    cost_code: searchParams.get('cost_code') ? [searchParams.get('cost_code')!] : [],
    estate: searchParams.getAll('estate'),
    process: searchParams.getAll('process'),
    subprocess: searchParams.getAll('subprocess'),
    region: searchParams.getAll('region'),
    bu_lead: searchParams.getAll('bu_lead'),
    bcp_status: searchParams.getAll('bcp_status'),
  }
  const masterData = useQuery({ queryKey: masterDataKey, queryFn: fetchMasterData, staleTime: 300_000 })
  const estates = useQuery({ queryKey: ['estates'], queryFn: estateApi.list, staleTime: 300_000 })
  const plans = useQuery({
    queryKey: planKeys.myPlans(page, filters),
    queryFn: () => plansApi.myPlans(page, filters),
    placeholderData: keepPreviousData,
  })

  const total = plans.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const rows = plans.data?.results ?? []

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage === 1) next.delete('page')
    else next.set('page', String(nextPage))
    setSearchParams(next)
  }

  function setFilter(key: string, values: string[]) {
    const next = new URLSearchParams(searchParams)
    next.delete(key)
    for (const value of values) next.append(key, value)
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  function toggleFilter(key: string, value: string) {
    const values = filters[key as keyof typeof filters]
    setFilter(key, values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return (
    <>
      <PageHeader title="My plans" subtitle="Plans assigned to you or owned by your BU lead role.">
        <div className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 shadow-card">
          {plans.isFetching ? <Spinner label="Updating" /> : `${total} plan${total === 1 ? '' : 's'}`}
        </div>
      </PageHeader>

      <search aria-label="My plan filters" className="mb-4 block rounded-card border border-ink-200/80 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <FilterItem className="relative min-w-56 flex-1">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              className="pl-9"
              type="search"
              value={filters.cost_code[0] ?? ''}
              onChange={(e) => setFilter('cost_code', e.target.value ? [e.target.value] : [])}
              placeholder="Filter by cost code"
              aria-label="Filter by cost code"
            />
          </FilterItem>
          <MultiSelect label="Estate" options={estates.data?.map((item) => ({ id: item.estate_id, name: item.estate_name })) ?? []} selected={filters.estate.map(Number)} loading={estates.isPending} onToggle={(value) => toggleFilter('estate', String(value))} />
          <MultiSelect label="Process" options={masterData.data?.process ?? []} selected={filters.process.map(Number)} loading={masterData.isPending} onToggle={(value) => toggleFilter('process', String(value))} />
          <MultiSelect label="Subprocess" options={masterData.data?.subprocess ?? []} selected={filters.subprocess.map(Number)} loading={masterData.isPending} onToggle={(value) => toggleFilter('subprocess', String(value))} />
          <MultiSelect label="Region" options={masterData.data?.region ?? []} selected={filters.region.map(Number)} loading={masterData.isPending} onToggle={(value) => toggleFilter('region', String(value))} />
          <MultiSelect label="BU lead" options={masterData.data?.bu_lead ?? []} selected={filters.bu_lead.map(Number)} loading={masterData.isPending} onToggle={(value) => toggleFilter('bu_lead', String(value))} />
          <MultiSelect label="BCP status" options={BCP_STATUS.map((status) => ({ id: status, name: status }))} selected={filters.bcp_status} loading={false} onToggle={(value) => toggleFilter('bcp_status', value)} />
          {Object.values(filters).some((values) => values.length > 0) && (
            <button type="button" className="rounded-control px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button>
          )}
        </div>
      </search>

      {plans.error ? (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {toApiError(plans.error).detail}
        </div>
      ) : plans.isPending ? (
        <div className="py-12 text-center"><Spinner label="Loading plans" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No plans assigned yet"
          description="Plans will appear here when they are assigned to you or linked to your BU lead account."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-ink-200/80 bg-white shadow-card">
            <table className="w-full min-w-[1120px] whitespace-nowrap text-left text-sm">
              <thead className="border-b border-ink-200 bg-brand-50 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-900">
                <tr>
                  <th className="sticky left-0 z-20 w-[142px] bg-brand-50 px-5 py-3 shadow-[4px_0_6px_-6px_oklch(0.2_0.05_270/0.4)]">Estate</th>
                  <th className="sticky left-[142px] z-20 w-[116px] bg-brand-50 px-4 py-3 shadow-[4px_0_6px_-6px_oklch(0.2_0.05_270/0.4)]">Cost code</th>
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Subprocess</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">BU lead</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="sticky right-0 z-20 w-20 bg-brand-50 px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((plan) => (
                  <tr key={plan.plan_version_id} className="group align-middle hover:bg-ink-50/60">
                    <td className="sticky left-0 z-10 w-[142px] whitespace-nowrap bg-white px-5 py-3 font-medium text-ink-900 shadow-[4px_0_6px_-6px_oklch(0.2_0.05_270/0.4)] group-hover:bg-ink-50">{plan.estate_name || '—'}</td>
                    <td className="sticky left-[142px] z-10 w-[116px] whitespace-nowrap bg-white px-4 py-3 shadow-[4px_0_6px_-6px_oklch(0.2_0.05_270/0.4)] group-hover:bg-ink-50">
                      <Link to={`/plan-versions/${plan.plan_version_id}`} className="font-medium text-brand-700 hover:underline">
                        {plan.cost_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{plan.process_name || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{plan.subprocess_name || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{plan.region_name || '—'}</td>
                    <td className="px-4 py-3 text-ink-700">{plan.bu_lead_name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-700">v{plan.version_number}</td>
                    <td className="sticky right-0 z-10 w-20 bg-white px-5 py-3 text-right shadow-[-4px_0_6px_-6px_oklch(0.2_0.05_270/0.4)] group-hover:bg-ink-50">
                      <Link
                        to={`/cost-codes/${plan.cost_code_id}`}
                        aria-label={`View details for ${plan.cost_code}`}
                        title="View details"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-ink-200 bg-white text-ink-600 shadow-card hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <IconEye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <nav aria-label="My plan pages" className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-xs text-ink-500">
              <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous plans page">Previous</Button>
                <span aria-live="polite" className="min-w-16 text-center">Page {currentPage} of {pageCount}</span>
                <Button size="sm" variant="secondary" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next plans page">Next</Button>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  )
}
