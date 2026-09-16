import { useQuery } from '@tanstack/react-query'

import { toApiError } from '@/api/client'
import { Alert, Spinner } from '@/components/ui'

import { fetchRiskOptions, riskOptionsKey } from './api'
import { dash, employeeName } from './format'
import { RowEditor } from './RowEditor'
import type { RecoveryStrategy as Strategy } from './types'

/** Phase 5.6: core and tactical strategy, sourced from the catalogue. */
export function RecoveryStrategySection({ versionId, readOnly }: { versionId: number; readOnly: boolean }) {
  const options = useQuery({ queryKey: riskOptionsKey(versionId), queryFn: () => fetchRiskOptions(versionId), staleTime: 300_000 })
  if (options.isPending) return <Spinner label="Loading strategy options" />
  if (options.error) return <Alert>{toApiError(options.error).detail}</Alert>

  const choices = (list: string[]) => list.map((v) => ({ value: v, label: v }))

  return (
    <RowEditor<Strategy & Record<string, unknown>>
      versionId={versionId}
      resource="recovery-strategies"
      title="Recovery strategy"
      singular="strategy"
      idKey="recovery_strategy_id"
      readOnly={readOnly}
      emptyText="No recovery strategy chosen yet. Core is how the service recovers; tactical is how the people do."
      columns={[
        { label: 'Core strategy', render: (r) => dash(r.core_strategy) },
        { label: 'Tactical strategy', render: (r) => dash(r.tactical_strategy) },
        { label: 'Owner', render: (r) => employeeName(r.owner_employee) },
      ]}
      fields={[
        { name: 'core_strategy', label: 'Core strategy', type: 'select', options: choices(options.data.core_strategies) },
        { name: 'tactical_strategy', label: 'Tactical strategy', type: 'select', options: choices(options.data.tactical_strategies) },
        { name: 'owner_employee', label: 'Owner', type: 'employee' },
      ]}
      toForm={(r) => ({ ...r, owner_employee: r.owner_employee?.id ?? '' })}
    />
  )
}
