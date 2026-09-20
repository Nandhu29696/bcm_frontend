import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Button, Field, Input, Modal, Select } from '@/components/ui'
import { ROLE } from '@/features/auth/types'
import { useHasRole } from '@/features/auth/useAuth'

import { planKeys, plansApi } from './api'
import type { Coordinator, PlanVersion } from './types'

const COORDINATOR_TYPES = ['Primary', 'Backup', 'Additional']

/**
 * Assign a coordinator to a plan version (Phase 3.2).
 *
 * Search is debounced and server-side: the employee directory can be large and
 * the picker only ever needs the twenty best matches for what has been typed.
 *
 * One person per role. Choosing a role someone already holds asks whether to
 * replace them; the server enforces the same rule (409 `role_already_held`)
 * and only takes the role over when `replace` is sent.
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
  const canBrowseEmployees = useHasRole([ROLE.ADMIN, ROLE.BU_LEAD])
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [coordinatorType, setCoordinatorType] = useState('Primary')
  const [additional, setAdditional] = useState(false)
  // Set when the chosen role is already held: the confirmation step.
  const [confirmReplace, setConfirmReplace] = useState<Coordinator[] | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(handle)
  }, [search])

  const employees = useQuery({
    queryKey: planKeys.employees(debounced),
    queryFn: () => plansApi.searchEmployees(debounced),
    enabled: canBrowseEmployees && debounced.length >= 2,
  })

  const assign = useMutation({
    mutationFn: (replace: boolean) =>
      plansApi.assignCoordinator(version.plan_version_id, {
        employee: employeeId as number,
        coordinator_type: coordinatorType,
        additional_user_flag: additional,
        replace,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.versions(costCodeId) })
      void queryClient.invalidateQueries({
        queryKey: planKeys.coordinators(version.plan_version_id),
      })
      onClose()
    },
    onError: (error) => {
      // The list on screen was stale and the server found a holder we did not
      // know about: ask the same question rather than showing a dead-end error.
      if (toApiError(error).code === 'role_already_held') setConfirmReplace(holdersOf(coordinatorType))
    },
  })

  const failure = assign.error && !confirmReplace ? toApiError(assign.error) : null
  const alreadyAssigned = new Set(version.coordinators.map((c) => c.employee_id))
  const chosen = employees.data?.find((e) => e.employee_id === employeeId)

  /** Who currently holds a role on this version, other than the person being assigned. */
  function holdersOf(role: string): Coordinator[] {
    return version.coordinators.filter((c) => c.coordinator_type === role && c.employee_id !== employeeId)
  }

  function submit() {
    if (employeeId === null) return
    const holders = holdersOf(coordinatorType)
    if (holders.length > 0) setConfirmReplace(holders)
    else assign.mutate(false)
  }

  return (
    <Modal title={`Assign coordinator — version ${version.version_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}

        {confirmReplace && (
          <div role="alertdialog" aria-label="Replace the current holder" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              <strong>{confirmReplace.map((c) => c.name).join(', ')}</strong> already{' '}
              {confirmReplace.length === 1 ? 'holds' : 'hold'} the <strong>{coordinatorType}</strong> role on this version.
              Replace {confirmReplace.length === 1 ? 'them' : 'them all'} with{' '}
              <strong>{chosen?.full_name ?? 'this person'}</strong>? The current holder is removed from the role and the new one is notified.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmReplace(null)}>
                Keep current
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={assign.isPending}
                onClick={() => {
                  setConfirmReplace(null)
                  assign.mutate(true)
                }}
              >
                {assign.isPending ? 'Replacing…' : 'Replace'}
              </Button>
            </div>
          </div>
        )}

        {version.coordinators.length > 0 && (
          <CurrentCoordinators
            version={version}
            costCodeId={costCodeId}
            coordinators={version.coordinators}
          />
        )}

        {canBrowseEmployees && (
          <>
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
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role on this plan">
            <Select
              value={coordinatorType}
              onChange={(e) => {
                setCoordinatorType(e.target.value)
                setConfirmReplace(null)
              }}
            >
              {COORDINATOR_TYPES.map((type) => {
                const holder = version.coordinators.find((c) => c.coordinator_type === type)
                return (
                  <option key={type} value={type}>
                    {holder ? `${type} — held by ${holder.name}` : type}
                  </option>
                )
              })}
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
          <Button type="submit" disabled={employeeId === null || assign.isPending || confirmReplace !== null}>
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
