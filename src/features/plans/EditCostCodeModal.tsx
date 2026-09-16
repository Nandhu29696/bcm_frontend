import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Button, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { estateKeys } from '@/features/estates/api'

import { fetchMasterData, masterDataKey, planKeys, plansApi } from './api'
import type { CostCodeDetail, CostCodeEdit, MasterData } from './types'

/**
 * The edit drawer (Phase 3.1).
 *
 * Dependent lists narrow as you go — pick a process and only its subprocesses
 * are offered — so the common mistake is prevented in the form. The server still
 * validates the combination; this is a convenience, not the enforcement.
 */
export function EditCostCodeModal({
  costCode,
  onClose,
}: {
  costCode: CostCodeDetail
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const masterData = useQuery({ queryKey: masterDataKey, queryFn: fetchMasterData, staleTime: 300_000 })

  const [form, setForm] = useState<CostCodeEdit>({
    cost_code: costCode.cost_code,
    process: costCode.process?.id ?? null,
    subprocess: costCode.subprocess?.id ?? null,
    region: costCode.region?.id ?? null,
    bu_lead: costCode.bu_lead?.id ?? null,
    lob: costCode.lob?.id ?? null,
    center: costCode.center?.id ?? null,
    location: costCode.location?.id ?? null,
  })

  const save = useMutation({
    mutationFn: () => plansApi.editCostCode(costCode.cost_code_id, form),
    onSuccess: (updated) => {
      queryClient.setQueryData(planKeys.costCode(costCode.cost_code_id), updated)
      // The table row and the estate facets both show these labels.
      void queryClient.invalidateQueries({ queryKey: estateKeys.all })
      onClose()
    },
  })

  const failure = save.error ? toApiError(save.error) : null
  const fieldError = (name: keyof CostCodeEdit) => failure?.field_errors[name]?.[0]

  function set<K extends keyof CostCodeEdit>(key: K, value: CostCodeEdit[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      // Clearing a parent clears children that no longer fit.
      if (key === 'process' && current.subprocess !== null) {
        const still = masterData.data?.subprocess.find(
          (s) => s.id === current.subprocess && s.process_id === value,
        )
        if (!still) next.subprocess = null
      }
      if (key === 'region' && current.location !== null) {
        const still = masterData.data?.location.find(
          (l) => l.id === current.location && (l.region_id === null || l.region_id === value),
        )
        if (!still) {
          next.location = null
          next.center = null
        }
      }
      if (key === 'location' && current.center !== null) {
        const still = masterData.data?.center.find(
          (c) => c.id === current.center && (c.location_id === null || c.location_id === value),
        )
        if (!still) next.center = null
      }
      return next
    })
  }

  return (
    <Modal title={`Edit ${costCode.cost_code}`} onClose={onClose}>
      {masterData.isPending ? (
        <Spinner label="Loading options" />
      ) : masterData.error ? (
        <Alert>{toApiError(masterData.error).detail}</Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          {failure && !Object.keys(failure.field_errors).length && (
            <Alert>{failure.detail}</Alert>
          )}

          <Field label="Cost code" error={fieldError('cost_code')}>
            <Input
              value={form.cost_code}
              onChange={(e) => set('cost_code', e.target.value)}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <RefSelect
              label="Process"
              value={form.process}
              options={masterData.data.process}
              error={fieldError('process')}
              onChange={(v) => set('process', v)}
            />
            <RefSelect
              label="Subprocess"
              value={form.subprocess}
              options={masterData.data.subprocess.filter(
                (s) => form.process === null || s.process_id === form.process,
              )}
              disabled={form.process === null}
              error={fieldError('subprocess')}
              onChange={(v) => set('subprocess', v)}
            />
            <RefSelect
              label="Region"
              value={form.region}
              options={masterData.data.region}
              error={fieldError('region')}
              onChange={(v) => set('region', v)}
            />
            <RefSelect
              label="Location"
              value={form.location}
              options={masterData.data.location.filter(
                (l) => form.region === null || l.region_id === null || l.region_id === form.region,
              )}
              error={fieldError('location')}
              onChange={(v) => set('location', v)}
            />
            <RefSelect
              label="Centre"
              value={form.center}
              options={masterData.data.center.filter(
                (c) =>
                  form.location === null || c.location_id === null || c.location_id === form.location,
              )}
              error={fieldError('center')}
              onChange={(v) => set('center', v)}
            />
            <RefSelect
              label="BU lead"
              value={form.bu_lead}
              options={masterData.data.bu_lead}
              error={fieldError('bu_lead')}
              onChange={(v) => set('bu_lead', v)}
            />
            <RefSelect
              label="Line of business"
              value={form.lob}
              options={masterData.data.lob}
              error={fieldError('lob')}
              onChange={(v) => set('lob', v)}
            />
          </div>

          <p className="text-xs text-ink-500">
            Estate: <span className="font-medium text-ink-700">{costCode.estate?.name}</span>{' '}
            — moving a cost code between estates is an administrative change, not an edit.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function RefSelect({
  label,
  value,
  options,
  onChange,
  error,
  disabled,
}: {
  label: string
  value: number | null
  options: { id: number; name: string }[]
  onChange: (value: number | null) => void
  error?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} error={error}>
      <Select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export type { MasterData }
