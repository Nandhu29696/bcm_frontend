import { useQuery } from '@tanstack/react-query'

import { api, toApiError } from '@/api/client'

interface Readiness {
  status: string
  database?: string
  detail?: string
}

/**
 * Phase 0 proof that the whole stack is connected: React -> Vite proxy -> Django
 * -> MySQL. If this page is green, the foundation holds.
 */
export function HealthPage() {
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ['system', 'readiness'],
    queryFn: async (): Promise<Readiness> => {
      const response = await api.get<Readiness>('/ready/')
      return response.data
    },
  })

  const apiError = error ? toApiError(error) : null
  const ok = data?.status === 'ready'

  return (
    <div className="max-w-xl rounded-card border border-ink-200/80 bg-white shadow-card p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink-900">System health</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-control border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {isFetching ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Frontend" value="ok" ok />
        <Row
          label="API"
          value={isPending ? 'checking…' : apiError ? apiError.detail : 'ok'}
          ok={!apiError && !isPending}
        />
        <Row
          label="Database"
          value={isPending ? 'checking…' : (data?.database ?? 'unreachable')}
          ok={ok}
        />
      </dl>
    </div>
  )
}

function Row({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0">
      <dt className="text-ink-600">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">
        <span
          aria-hidden
          className={`size-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
        />
        <span className={ok ? 'text-emerald-700' : 'text-red-700'}>{value}</span>
      </dd>
    </div>
  )
}
