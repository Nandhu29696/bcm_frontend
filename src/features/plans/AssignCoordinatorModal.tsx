import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Button, Field, Input, Modal, Select } from '@/components/ui'

import { planKeys, plansApi } from './api'
import type { Coordinator, PlanVersion } from './types'

const COORDINATOR_TYPES = ['Primary', 'Backup', 'Additional']

/**
 * Assign a coordinator to a plan version (Phase 3.2).
 *
 * Search is debounced and server-side: the employee directory can be large and
 * the picker only ever needs the twenty best matches for what has been typed.
 */
export function AssignCoordinatorModal({
  version,
  costCodeId,
  onClose,
}: {
  version: PlanVersion
  costCodeId: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [coordinatorType, setCoordinatorType] = useState('Primary')
  const [additional, setAdditional] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(handle)
  }, [search])

  const employees = useQuery({
    queryKey: planKeys.employees(debounced),
    queryFn: () => plansApi.searchEmployees(debounced),
    enabled: debounced.length >= 2,
  })

  const assign = useMutation({
    mutationFn: () =>
      plansApi.assignCoordinator(version.plan_version_id, {
        employee: employeeId as number,
        coordinator_type: coordinatorType,
        additional_user_flag: additional,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(costCodeId) })
      void queryClient.invalidateQueries({
        queryKey: planKeys.coordinators(version.plan_version_id),
      })
      onClose()
    },
  })

  const failure = assign.error ? toApiError(assign.error) : null
  const alreadyAssigned = new Set(version.coordinators.map((c) => c.employee_id))

  return (
    <Modal title={`Assign coordinator — version ${version.version_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (employeeId !== null) assign.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}

        {version.coordinators.length > 0 && (
          <CurrentCoordinators
            version={version}
            costCodeId={costCodeId}
            coordinators={version.coordinators}
          />
        )}

        <Field label="Find a colleague">
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setEmployeeId(null)
            }}
            placeholder="Name, email or employee number"
            autoFocus
          />
        </Field>

        {debounced.length >= 2 && (
          <div
            role="listbox"
            aria-label="Matching employees"
            className="max-h-56 overflow-auto rounded-md border border-ink-200"
          >
            {employees.isPending && (
              <p className="px-3 py-2 text-sm text-ink-500">Searching…</p>
            )}
            {employees.data?.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink-500">No one matches.</p>
            )}
            {employees.data?.map((employee) => {
              const selected = employee.employee_id === employeeId
              const taken = alreadyAssigned.has(employee.employee_id)
              return (
                <button
                  key={employee.employee_id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={taken}
                  onClick={() => setEmployeeId(employee.employee_id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    selected ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span>
                    <span className="font-medium">{employee.full_name}</span>
                    <span className="ml-2 text-xs text-ink-500">{employee.employee_number}</span>
                  </span>
                  <span className="text-xs text-ink-500">
                    {taken ? 'already assigned' : employee.email}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role on this plan">
            <Select value={coordinatorType} onChange={(e) => setCoordinatorType(e.target.value)}>
              {COORDINATOR_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={additional}
              onChange={(e) => setAdditional(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300"
            />
            Additional user (not the owner)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={employeeId === null || assign.isPending}>
            {assign.isPending ? 'Assigning…' : 'Assign and notify'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CurrentCoordinators({
  version,
  costCodeId,
  coordinators,
}: {
  version: PlanVersion
  costCodeId: number
  coordinators: Coordinator[]
}) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: (assignmentId: number) =>
      plansApi.removeCoordinator(version.plan_version_id, assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(costCodeId) })
    },
  })

  return (
    <div className="rounded-md bg-ink-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Currently assigned
      </p>
      <ul className="space-y-1">
        {coordinators.map((c) => (
          <li key={c.coordinator_assignment_id} className="flex items-center justify-between text-sm">
            <span>
              <span className="font-medium text-ink-900">{c.name}</span>
              <span className="ml-2 text-xs text-ink-500">{c.coordinator_type}</span>
            </span>
            <button
              type="button"
              onClick={() => remove.mutate(c.coordinator_assignment_id)}
              disabled={remove.isPending}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
