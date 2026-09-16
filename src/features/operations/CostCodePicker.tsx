import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Field, Select } from '@/components/ui'
import { estateApi, estateKeys } from '@/features/estates/api'
import { EMPTY_FILTERS } from '@/features/estates/types'

/**
 * Estate, then cost code - the same two steps as the journey, for dialogs that
 * start from a page rather than from a cost code row.
 */
export function CostCodePicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (costCodeId: number | null, label: string) => void
}) {
  const [estateId, setEstateId] = useState<number | null>(null)
  const estates = useQuery({ queryKey: estateKeys.all, queryFn: estateApi.list })
  const filters = { ...EMPTY_FILTERS, page_size: 200, ordering: 'cost_code' }
  const costCodes = useQuery({
    queryKey: estateKeys.costCodes(estateId ?? 0, filters),
    queryFn: () => estateApi.costCodes(estateId as number, filters),
    enabled: estateId !== null,
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Estate">
        <Select
          value={estateId ?? ''}
          onChange={(e) => {
            setEstateId(e.target.value ? Number(e.target.value) : null)
            onChange(null, '')
          }}
          aria-label="Estate"
        >
          <option value="">Choose an estate</option>
          {estates.data?.map((estate) => (
            <option key={estate.estate_id} value={estate.estate_id}>
              {estate.estate_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cost code">
        <Select
          value={value ?? ''}
          disabled={estateId === null}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            const row = costCodes.data?.results.find((c) => c.cost_code_id === id)
            onChange(id, row?.cost_code ?? '')
          }}
          aria-label="Cost code"
        >
          <option value="">{estateId === null ? 'Choose an estate first' : costCodes.isPending ? 'Loading' : 'Choose a cost code'}</option>
          {costCodes.data?.results.map((row) => (
            <option key={row.cost_code_id} value={row.cost_code_id}>
              {row.cost_code}
              {row.process ? ` · ${row.process.name}` : ''}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
