import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { useToast } from '@/components/useToast'
import { PAGE_SIZE } from '@/components/paging'
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Pager, Select, StatusBadge, TableSkeleton } from '@/components/ui'
import type { EmployeeSummary, UserStatus } from '@/features/auth/types'
import { useCurrentUser } from '@/features/auth/useAuth'
import { estateApi, estateKeys } from '@/features/estates/api'
import { formatDateTime } from '@/features/plans/format'

import { adminApi, adminKeys, type AdminUser, type AdminUserPatch } from './api'

const STATUSES: UserStatus[] = ['Active', 'Pending', 'Suspended', 'Disabled']

/**
 * User administration: who can sign in, what they are, what they see, and
 * whether they need a one-time code. Everything an account needs after a
 * self-registration (SSO or the register form) is one dialog and one save.
 */
export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    search: searchParams.get('search') ?? '',
    user_status: searchParams.get('user_status') ?? '',
    auth_provider: searchParams.get('auth_provider') ?? '',
    page: Number(searchParams.get('page')) || 1,
  }
  const users = useQuery({ queryKey: adminKeys.users(filters), queryFn: () => adminApi.users(filters) })
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const upload = useMutation({
    mutationFn: () => adminApi.uploadEmployees(uploadFile as File),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] })
      setUploadFile(null)
      setImporting(false)
      if (result.errors.length) {
        toast.error(`${result.created} created, ${result.updated} updated, ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} skipped`)
      } else {
        toast.success(`${result.created} employees created, ${result.updated} updated`)
      }
    },
    onError: (error) => toast.error(toApiError(error).detail),
  })

  async function downloadTemplate() {
    setDownloadingTemplate(true)
    try {
      const blob = await adminApi.downloadEmployeeTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'employee_bulk_upload_template.xlsx'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(toApiError(error).detail)
    } finally {
      setDownloadingTemplate(false)
    }
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const pending = users.data?.results.filter((u) => u.user_status === 'Pending').length ?? 0
  const activeFilters = [filters.search, filters.user_status, filters.auth_provider].filter(Boolean).length

  return (
    <>
      <PageHeader
        title="User administration"
        eyebrow="Accounts, roles, estate scopes and the second factor"
        subtitle={users.data ? `${users.data.count} account${users.data.count === 1 ? '' : 's'}${pending ? ` · ${pending} awaiting activation on this page` : ''}` : undefined}
      >
        <Button variant="secondary" onClick={() => setImporting(true)}>
          Import employees
        </Button>
      </PageHeader>

      <div className="mb-5 rounded-card border border-ink-200/80 bg-white p-3 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Find an account</span>
            <Input
              type="search"
              value={filters.search}
              onChange={(e) => setParam('search', e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search users"
            />
          </label>
          <label className="lg:w-44">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Status</span>
            <Select value={filters.user_status} onChange={(e) => setParam('user_status', e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label className="lg:w-48">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Sign-in method</span>
            <Select value={filters.auth_provider} onChange={(e) => setParam('auth_provider', e.target.value)} aria-label="Filter by sign-in method">
              <option value="">All methods</option>
              <option value="local">Password</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </Select>
          </label>
          {activeFilters > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="lg:mb-0.5"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Clear filters
            </Button>
          )}
        </div>
        {(pending > 0 || activeFilters > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
          {pending > 0 && <Badge className="bg-amber-50 text-amber-800">{pending} awaiting activation</Badge>}
          {activeFilters > 0 && <span>{activeFilters} filter{activeFilters === 1 ? '' : 's'} applied · {users.data?.count ?? '…'} match</span>}
        </div>
        )}
      </div>


      {users.isPending ? (
        <TableSkeleton cols={7} label="Loading users" />
      ) : users.error ? (
        <Alert>{toApiError(users.error).detail}</Alert>
      ) : users.data.results.length === 0 ? (
        <EmptyState title="No accounts match" />
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-200/80 bg-white shadow-card">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Sign-in</th>
                <th>MFA</th>
                <th>Roles</th>
                <th>Employee</th>
                <th className="whitespace-nowrap">Last sign-in</th>
                <th className="w-20 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.data.results.map((u) => (
                <tr key={u.user_id} className={u.is_active ? '' : 'opacity-60'}>
                  <td>
                    <span className="font-medium text-ink-900">{u.display_name}</span>
                    <span className="block text-xs text-ink-500">{u.email}</span>
                  </td>
                  <td>
                    <StatusBadge status={u.user_status} />
                    {!u.is_active && <span className="block text-xs text-red-700">sign-in blocked</span>}
                  </td>
                  <td className="capitalize">{u.auth_provider === 'local' ? 'Password' : u.auth_provider}</td>
                  <td>{u.mfa_enabled ? <Badge className="bg-emerald-50 text-emerald-800">On</Badge> : <Badge>Off</Badge>}</td>
                  <td>
                    {u.role_codes.length === 0 ? (
                      <Badge className="bg-amber-50 text-amber-800">No role</Badge>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {u.role_codes.map((c) => (
                          <Badge key={c}>{roleLabel(c)}</Badge>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-xs">
                    {u.employee ? (
                      <>
                        <span className="text-ink-900">{u.employee.full_name}</span>
                        <span className="block text-ink-500">{u.employee.employee_number}</span>
                      </>
                    ) : (
                      <span className="text-ink-400">Not linked</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(u.last_login)}</td>
                  <td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(u)} aria-label={`Edit ${u.email}`}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={filters.page} pageSize={PAGE_SIZE} total={users.data.count} onPage={(n) => setParam('page', String(n))} label="Account pages" />
        </div>
      )}

      {importing && (
        <Modal title="Import employees" onClose={() => setImporting(false)}>
          <p className="text-sm text-ink-600">
            Upload the employee Excel export. Existing employee numbers are updated; new estate names are created automatically.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={downloadingTemplate} onClick={() => void downloadTemplate()}>
              {downloadingTemplate ? 'Preparing' : 'Download template'}
            </Button>
            <label className="inline-flex h-9.5 cursor-pointer items-center justify-center rounded-control border border-ink-200 bg-white px-4 text-sm font-medium text-ink-800 shadow-card transition-colors hover:border-ink-300 hover:bg-ink-50">
              <span>{uploadFile ? uploadFile.name : 'Choose Excel file'}</span>
              <input
                type="file"
                accept=".xlsx,.xlsm"
                className="sr-only"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                aria-label="Choose employee Excel file"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setImporting(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!uploadFile || upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending ? 'Uploading' : 'Upload'}
            </Button>
          </div>
        </Modal>
      )}

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function roleLabel(code: string): string {
  const words = code.replace(/^BCM_/, '').toLowerCase().split('_')
  return words.map((w) => (w === 'bu' ? 'BU' : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: me } = useCurrentUser()
  const roles = useQuery({ queryKey: adminKeys.roles, queryFn: adminApi.roles })
  const estates = useQuery({ queryKey: estateKeys.all, queryFn: estateApi.list })
  const [form, setForm] = useState<Required<Omit<AdminUserPatch, 'employee_id'>> & { employee: EmployeeSummary | null }>({
    display_name: user.display_name,
    user_status: user.user_status,
    is_active: user.is_active,
    mfa_enabled: user.mfa_enabled,
    role_codes: user.role_codes,
    estate_ids: user.estate_ids,
    employee: user.employee,
  })
  const [employeeSearch, setEmployeeSearch] = useState('')
  const employees = useQuery({
    queryKey: adminKeys.employees(employeeSearch),
    queryFn: () => adminApi.employees(employeeSearch),
    enabled: employeeSearch.trim().length >= 2,
  })
  const save = useMutation({
    mutationFn: () => {
      const { employee, ...rest } = form
      return adminApi.patchUser(user.user_id, { ...rest, employee_id: employee?.employee_id ?? null })
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(`${saved.display_name} saved`)
      onClose()
    },
  })
  const failure = save.error ? toApiError(save.error) : null
  const isSelf = me?.user_id === user.user_id
  const seesAll = form.role_codes.some((c) => c === 'BCM_ADMIN' || c === 'BCM_AUDITOR')

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  return (
    <Modal title={`${user.display_name} · ${user.email}`} onClose={onClose} width="max-w-2xl">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}
        {user.user_status === 'Pending' && (
          <Alert tone="info">
            This account is awaiting activation. Set the status to Active, link the employee record and give at least one role and one estate.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} aria-label="Display name" />
          </Field>
          <Field label="Status" error={failure?.field_errors.user_status?.[0]}>
            <Select value={form.user_status} onChange={(e) => setForm({ ...form, user_status: e.target.value as UserStatus })} aria-label="Status">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Access switches</legend>
          <label className="flex items-start gap-3 rounded-control border border-ink-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={form.mfa_enabled} onChange={(e) => setForm({ ...form, mfa_enabled: e.target.checked })} aria-label="Multi-factor authentication" />
            <span>
              <span className="font-medium text-ink-900">Multi-factor authentication</span>
              <span className="block text-xs text-ink-500">
                {form.mfa_enabled ? 'A one-time code is emailed at every sign-in.' : 'Signs in with email and password only.'}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-control border border-ink-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={form.is_active} disabled={isSelf} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} aria-label="Sign-in allowed" />
            <span>
              <span className="font-medium text-ink-900">Sign-in allowed</span>
              <span className="block text-xs text-ink-500">{isSelf ? 'You cannot block your own account.' : 'Off blocks every sign-in, including SSO.'}</span>
            </span>
          </label>
        </fieldset>

        <Field label="Employee record" hint="Links the account to HR data; a coordinator must be linked to be assignable.">
          {form.employee ? (
            <div className="flex items-center justify-between rounded-control border border-ink-200 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-ink-900">{form.employee.full_name}</span>
                <span className="ml-2 text-ink-500">
                  {form.employee.employee_number} · {form.employee.email}
                </span>
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, employee: null })}>
                Unlink
              </Button>
            </div>
          ) : (
            <div>
              <Input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Search employees by name, number or email" aria-label="Search employees" />
              {employees.data && employees.data.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-control border border-ink-200 bg-white text-sm shadow-card" aria-label="Employee matches">
                  {employees.data.map((emp) => (
                    <li key={emp.employee_id}>
                      <button
                        type="button"
                        className="flex w-full justify-between px-3 py-1.5 text-left hover:bg-ink-50"
                        onClick={() => {
                          setForm({ ...form, employee: emp })
                          setEmployeeSearch('')
                        }}
                      >
                        <span className="font-medium text-ink-900">{emp.full_name}</span>
                        <span className="text-ink-500">
                          {emp.employee_number} · {emp.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {failure?.field_errors.employee_id && <span className="mt-1 block text-xs font-medium text-red-600">{failure.field_errors.employee_id[0]}</span>}
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Roles</legend>
          <div className="grid gap-1.5 sm:grid-cols-2" aria-label="Roles">
            {roles.data?.filter((r) => r.active_flag).map((role) => (
              <label key={role.role_code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.role_codes.includes(role.role_code)} onChange={() => setForm({ ...form, role_codes: toggle(form.role_codes, role.role_code) })} aria-label={role.role_name} />
                {role.role_name}
              </label>
            ))}
          </div>
          {failure?.field_errors.role_codes && <span className="mt-1 block text-xs font-medium text-red-600">{failure.field_errors.role_codes[0]}</span>}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Estates</legend>
          {seesAll ? (
            <p className="text-sm text-ink-500">Administrators and auditors see every estate; no scope is needed.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2" aria-label="Estates">
              {estates.data?.map((estate) => (
                <label key={estate.estate_id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.estate_ids.includes(estate.estate_id)} onChange={() => setForm({ ...form, estate_ids: toggle(form.estate_ids, estate.estate_id) })} aria-label={estate.estate_name} />
                  {estate.estate_name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-400">
            {user.auth_provider === 'local' ? 'Password account' : `Signs in with ${user.auth_provider}`} · created {formatDateTime(user.created_at)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
