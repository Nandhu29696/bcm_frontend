import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { toApiError } from '@/api/client'
import { pageOf } from '@/components/paging'
import { Alert, Button, EmptyState, Field, Input, Modal, Pager, Spinner } from '@/components/ui'

import { opsApi, opsKeys, type CmscMember, type CmscMemberInput, type UploadResult } from './api'

const EMPTY: CmscMemberInput = {
  member_name: '',
  member_email: '',
  country_code: '+91',
  phone_number: '',
  reporting_manager_name: '',
  reporting_manager_email: '',
  center: '',
  location: '',
}

/**
 * The CMSC roster for a cost code: who a crisis call tree dials. Maintained by
 * hand or by CSV upload (an upsert keyed on email, so re-uploading the same
 * sheet is safe).
 */
export function RosterPanel({ costCodeId }: { costCodeId: number }) {
  const queryClient = useQueryClient()
  const roster = useQuery({ queryKey: opsKeys.roster(costCodeId), queryFn: () => opsApi.roster(costCodeId) })
  const [editing, setEditing] = useState<CmscMember | 'new' | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [page, setPage] = useState(1)
  const fileInput = useRef<HTMLInputElement>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: opsKeys.roster(costCodeId) })
  }
  const remove = useMutation({ mutationFn: (id: number) => opsApi.removeMember(id), onSuccess: refresh })
  const upload = useMutation({
    mutationFn: (file: File) => opsApi.uploadRoster(costCodeId, file),
    onSuccess: (result) => {
      setUploadResult(result)
      refresh()
    },
    onError: (error) => {
      const data = (error as { response?: { data?: UploadResult } }).response?.data
      setUploadResult(data && 'errors' in data ? data : { created: 0, updated: 0, errors: [{ line: 0, error: toApiError(error).detail }] })
    },
  })

  if (roster.isPending) {
    return (
      <div className="py-6 text-center">
        <Spinner label="Loading roster" />
      </div>
    )
  }
  if (roster.error) return <Alert>{toApiError(roster.error).detail}</Alert>

  const { results, can_manage } = roster.data

  return (
    <section aria-label="CMSC roster" className="rounded-card border border-ink-200/80 bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-800">CMSC roster</h2>
          <p className="text-xs text-ink-500">{results.length} member{results.length === 1 ? '' : 's'} the call tree will contact</p>
        </div>
        {can_manage && (
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Roster CSV"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate(file)
                e.target.value = ''
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? 'Uploading' : 'Upload CSV'}
            </Button>
            <Button size="sm" onClick={() => setEditing('new')}>
              Add member
            </Button>
          </div>
        )}
      </div>

      {uploadResult && (
        <div className="mb-3">
          {uploadResult.errors.length === 0 ? (
            <Alert tone="success">
              Roster updated: {uploadResult.created} added, {uploadResult.updated} updated.{' '}
              <button type="button" className="underline" onClick={() => setUploadResult(null)}>
                Dismiss
              </button>
            </Alert>
          ) : (
            <Alert>
              Nothing was imported. Fix these rows and upload again:
              <ul className="mt-1 list-disc pl-5">
                {uploadResult.errors.map((e, i) => (
                  <li key={i}>
                    {e.line ? `Line ${e.line}: ` : ''}
                    {e.error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          title="No committee members yet"
          description="Add members one by one or upload a CSV with columns member_name, member_email, country_code, phone_number, reporting_manager_name, reporting_manager_email."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Reporting manager</th>
                {can_manage && <th />}
              </tr>
            </thead>
            <tbody>
              {pageOf(results, page).map((member) => (
                <tr key={member.cmsc_member_id}>
                  <td className="font-medium text-ink-900">{member.member_name}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {member.phone_number ? `${member.country_code} ${member.phone_number}` : '—'}
                  </td>
                  <td>{member.member_email || '—'}</td>
                  <td>
                    {member.reporting_manager_name || '—'}
                    {member.reporting_manager_email && <span className="block text-xs text-ink-500">{member.reporting_manager_email}</span>}
                  </td>
                  {can_manage && (
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(member)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(member.cmsc_member_id)}
                          aria-label={`Remove ${member.member_name}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={results.length} onPage={setPage} label="Roster pages" />
        </div>
      )}

      {editing && (
        <MemberDialog
          costCodeId={costCodeId}
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </section>
  )
}

function MemberDialog({
  costCodeId,
  member,
  onClose,
  onSaved,
}: {
  costCodeId: number
  member: CmscMember | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CmscMemberInput>(member ? { ...EMPTY, ...member } : EMPTY)
  const save = useMutation({
    mutationFn: () => (member ? opsApi.editMember(member.cmsc_member_id, form) : opsApi.addMember(costCodeId, form)),
    onSuccess: onSaved,
  })
  const failure = save.error ? toApiError(save.error) : null
  const set = (key: keyof CmscMemberInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  return (
    <Modal title={member ? `Edit ${member.member_name}` : 'Add committee member'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Name" error={failure?.field_errors.member_name?.[0]}>
          <Input value={form.member_name} onChange={set('member_name')} required aria-label="Name" />
        </Field>
        <Field label="Email" error={failure?.field_errors.member_email?.[0]}>
          <Input type="email" value={form.member_email} onChange={set('member_email')} aria-label="Email" />
        </Field>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field label="Country code">
            <Input value={form.country_code} onChange={set('country_code')} aria-label="Country code" />
          </Field>
          <Field label="Phone number" error={failure?.field_errors.phone_number?.[0]}>
            <Input value={form.phone_number} onChange={set('phone_number')} aria-label="Phone number" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reporting manager">
            <Input value={form.reporting_manager_name} onChange={set('reporting_manager_name')} aria-label="Reporting manager" />
          </Field>
          <Field label="Manager email">
            <Input type="email" value={form.reporting_manager_email} onChange={set('reporting_manager_email')} aria-label="Manager email" />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : member ? 'Save' : 'Add member'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
