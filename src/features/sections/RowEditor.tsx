import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { toApiError } from '@/api/client'
import { IconPlus } from '@/components/icons'
import { Alert, Button, Field, Input, Modal, Select, Spinner, Textarea } from '@/components/ui'

import { employeesKey, fetchEmployees, sectionApi } from './api'

export interface FieldSpec {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'employee' | 'checkbox'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  help?: string
  /** Column width hint for the table. */
  wide?: boolean
}

export interface ColumnSpec<T> {
  label: string
  render: (row: T) => ReactNode
}

interface RowEditorProps<T extends Record<string, unknown>> {
  versionId: number
  resource: string
  title: string
  singular: string
  idKey: keyof T & string
  columns: ColumnSpec<T>[]
  fields: FieldSpec[]
  readOnly: boolean
  emptyText: string
  /** Turn a stored row into form values (e.g. employee ref -> id). */
  toForm?: (row: T) => Record<string, unknown>
}

/**
 * A repeatable-row editor (Phase 5.7): a table of rows with add, edit and
 * delete, and a modal form driven by a field schema.
 *
 * Every structured section is this component with a different schema. That
 * keeps the five editors identical in behaviour — same validation display,
 * same keyboard handling, same read-only rendering — and means a new column on
 * the API is a new entry in a schema, not a new component.
 */
export function RowEditor<T extends Record<string, unknown>>({
  versionId,
  resource,
  title,
  singular,
  idKey,
  columns,
  fields,
  readOnly,
  emptyText,
  toForm,
}: RowEditorProps<T>) {
  const client = sectionApi<T>(resource)
  const queryClient = useQueryClient()
  const key = client.key(versionId)
  const rows = useQuery({ queryKey: key, queryFn: () => client.list(versionId) })
  const [editing, setEditing] = useState<T | 'new' | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => client.remove(versionId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  return (
    <section aria-label={title} className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card animate-fade-up">
      <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
          {title}
          {rows.data && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">
              {rows.data.length}
            </span>
          )}
        </h3>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            <IconPlus size={14} /> Add {singular}
          </Button>
        )}
      </header>

      {rows.isPending ? (
        <div className="px-4 py-6">
          <Spinner label={`Loading ${title.toLowerCase()}`} />
        </div>
      ) : rows.error ? (
        <div className="p-4">
          <Alert>{toApiError(rows.error).detail}</Alert>
        </div>
      ) : rows.data.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.data.map((row) => (
                <tr key={String(row[idKey])} className="align-top">
                  {columns.map((c) => (
                    <td key={c.label}>{c.render(row)}</td>
                  ))}
                  {!readOnly && (
                    <td className="whitespace-nowrap text-right text-xs">
                      <button type="button" onClick={() => setEditing(row)} className="text-brand-700 hover:underline">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove.mutate(row[idKey] as number)}
                        disabled={remove.isPending}
                        className="ml-3 text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <RowForm
          title={editing === 'new' ? `Add ${singular}` : `Edit ${singular}`}
          fields={fields}
          initial={editing === 'new' ? {} : (toForm ? toForm(editing) : editing)}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            if (editing === 'new') await client.create(versionId, values)
            else await client.update(versionId, editing[idKey] as number, values)
            await queryClient.invalidateQueries({ queryKey: key })
          }}
        />
      )}
    </section>
  )
}

export function RowForm({
  title,
  fields,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  fields: FieldSpec[]
  initial: Record<string, unknown>
  onClose: () => void
  onSubmit: (values: Record<string, unknown>) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seeded: Record<string, unknown> = {}
    for (const f of fields) seeded[f.name] = initial[f.name] ?? (f.type === 'checkbox' ? false : '')
    return seeded
  })
  const save = useMutation({
    mutationFn: () => onSubmit(normalise(values, fields)),
    onSuccess: onClose,
  })
  const failure = save.error ? toApiError(save.error) : null

  return (
    <Modal title={title} onClose={onClose} width="max-w-2xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        {failure && !Object.keys(failure.field_errors).length && <Alert>{failure.detail}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <FormField
                spec={f}
                value={values[f.name]}
                error={failure?.field_errors[f.name]?.[0]}
                onChange={(v) => setValues((c) => ({ ...c, [f.name]: v }))}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Empty numbers, dates and employee picks become null so the API sees "unset".
 * Selects stay as '' — most back plain text columns (resource type, strategy,
 * status) that take an empty string, and the rating DecimalFields treat '' as
 * null themselves.
 */
function normalise(values: Record<string, unknown>, fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = values[f.name]
    if ((f.type === 'number' || f.type === 'date' || f.type === 'employee') && v === '') {
      out[f.name] = null
    } else if (f.type === 'number' && typeof v === 'string') {
      out[f.name] = Number(v)
    } else {
      out[f.name] = v
    }
  }
  return out
}

function FormField({
  spec,
  value,
  error,
  onChange,
}: {
  spec: FieldSpec
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}) {
  const label = spec.required ? `${spec.label} *` : spec.label
  switch (spec.type) {
    case 'textarea':
      return (
        <Field label={label} error={error}>
          <Textarea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={spec.placeholder} />
        </Field>
      )
    case 'select':
      return (
        <Field label={label} error={error}>
          <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">{spec.placeholder ?? 'Choose'}</option>
            {spec.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      )
    case 'employee':
      return (
        <Field label={label} error={error}>
          <EmployeeSelect value={value as number | '' | null} onChange={onChange} />
        </Field>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 pt-6 text-sm text-ink-700">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-ink-300" />
          {spec.label}
        </label>
      )
    default:
      return (
        <Field label={label} error={error}>
          <Input
            type={spec.type === 'number' ? 'number' : spec.type === 'date' ? 'date' : 'text'}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={spec.placeholder}
            required={spec.required}
          />
          {spec.help && <span className="mt-1 block text-xs text-ink-500">{spec.help}</span>}
        </Field>
      )
  }
}

/**
 * Owner picker. Loads the directory once (200 people) — right for an
 * organisation of this size; a larger one wants the search-as-you-type picker
 * from the coordinator modal instead.
 */
function EmployeeSelect({ value, onChange }: { value: number | '' | null; onChange: (v: unknown) => void }) {
  const employees = useQuery({ queryKey: employeesKey, queryFn: fetchEmployees, staleTime: 300_000 })
  return (
    <Select value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
      <option value="">Nobody yet</option>
      {employees.data?.map((e) => (
        <option key={e.employee_id} value={e.employee_id}>
          {e.full_name}
        </option>
      ))}
    </Select>
  )
}
