import { Input, Select } from '@/components/ui'

import type { AnswerJson, EditorQuestion, Option, SubformField } from './types'

interface RendererProps {
  question: EditorQuestion
  answer: AnswerJson | null
  disabled: boolean
  onChange: (answer: AnswerJson | null, immediate: boolean) => void
}

/**
 * Renders the input for one question from its `answer_type` (Phase 4.9).
 *
 * Nothing here knows any question by code. A question added through the API
 * appears with the right control because the type, options, dependency and
 * sub-form schema all arrive in the payload. That is the third Phase 4 exit
 * criterion, and it is why this file must never grow a `switch` on question_code.
 */
export function QuestionRenderer({ question, answer, disabled, onChange }: RendererProps) {
  switch (question.answer_type) {
    case 'SINGLE_CHOICE':
      return (
        <SingleChoice question={question} answer={answer} disabled={disabled} onChange={onChange} />
      )
    case 'MULTI_CHOICE':
      return (
        <MultiChoice question={question} answer={answer} disabled={disabled} onChange={onChange} />
      )
    case 'NUMBER':
      return (
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          className="max-w-xs"
          aria-label={question.question_text}
          disabled={disabled}
          value={scalar(answer) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : { value: Number(e.target.value) }, false)
          }
        />
      )
    case 'DATE':
      return (
        <Input
          type="date"
          className="max-w-xs"
          aria-label={question.question_text}
          disabled={disabled}
          value={String(scalar(answer) ?? '')}
          onChange={(e) => onChange(e.target.value ? { value: e.target.value } : null, true)}
        />
      )
    case 'TEXT':
      return (
        <textarea
          rows={3}
          aria-label={question.question_text}
          disabled={disabled}
          className="w-full rounded-control border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
          value={String(scalar(answer) ?? '')}
          onChange={(e) => onChange(e.target.value ? { value: e.target.value } : null, false)}
        />
      )
    case 'SUBFORM':
      return (
        <SubformEditor question={question} answer={answer} disabled={disabled} onChange={onChange} />
      )
    default:
      return (
        <p className="text-sm text-red-600">Unsupported answer type: {question.answer_type}</p>
      )
  }
}

function scalar(answer: AnswerJson | null): string | number | undefined {
  if (!answer || !('value' in answer)) return undefined
  const value = answer.value
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function selectedCodes(answer: AnswerJson | null): string[] {
  if (!answer || !('value' in answer)) return []
  return Array.isArray(answer.value) ? answer.value : []
}

function detailCodes(answer: AnswerJson | null): string[] {
  if (!answer || !('detail' in answer) || !answer.detail) return []
  return answer.detail
}

function SingleChoice({ question, answer, disabled, onChange }: RendererProps) {
  const current = scalar(answer)
  const detail = detailCodes(answer)
  const hasDetail = question.detail_options.length > 0
  const name = `q-${question.question_id}`

  // A short list is radio buttons; a long catalogue is a select. Both write the
  // same shape, so the choice is purely about screen space.
  const asSelect = question.options.length > 6

  return (
    <div className="space-y-3">
      {asSelect ? (
        <Select
          aria-label={question.question_text}
          className="max-w-md"
          disabled={disabled}
          value={String(current ?? '')}
          onChange={(e) => onChange(e.target.value ? { value: e.target.value } : null, true)}
        >
          <option value="">Choose one</option>
          {question.options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <div role="radiogroup" aria-label={question.question_text} className="flex flex-wrap gap-2">
          {question.options.map((o) => (
            <label
              key={o.code}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-control border px-3.5 py-2 text-sm font-medium transition-colors ${
                current === o.code
                  ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={o.code}
                checked={current === o.code}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    // Keep a detail pick when the value stays "YES"; drop it otherwise.
                    o.code === 'YES' && detail.length ? { value: o.code, detail } : { value: o.code },
                    true,
                  )
                }
                className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}

      {hasDetail && current === 'YES' && (
        <DetailPicker
          label="Which ones?"
          options={question.detail_options}
          selected={detail}
          disabled={disabled}
          onChange={(codes) => onChange({ value: 'YES', detail: codes }, true)}
        />
      )}
    </div>
  )
}

function MultiChoice({ question, answer, disabled, onChange }: RendererProps) {
  return (
    <DetailPicker
      label={question.question_text}
      options={question.options}
      selected={selectedCodes(answer)}
      disabled={disabled}
      onChange={(codes) => onChange(codes.length ? { value: codes } : null, true)}
    />
  )
}

function DetailPicker({
  label,
  options,
  selected,
  disabled,
  onChange,
}: {
  label: string
  options: Option[]
  selected: string[]
  disabled: boolean
  onChange: (codes: string[]) => void
}) {
  return (
    <fieldset className="rounded-control border border-ink-200 bg-ink-50/70 p-3.5">
      <legend className="px-1 text-xs font-medium text-ink-600">{label}</legend>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const checked = selected.includes(o.code)
          return (
            <label key={o.code} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(checked ? selected.filter((c) => c !== o.code) : [...selected, o.code])
                }
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="truncate">{o.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * A repeatable-row form driven by `subform_schema` (BIA-004, subcontractors).
 * Rows save on blur and on structural changes; a half-typed cell is not sent.
 */
function SubformEditor({ question, answer, disabled, onChange }: RendererProps) {
  const rows: Record<string, string>[] = answer && 'rows' in answer ? answer.rows : []
  const schema = question.subform_schema
  const lookupOptions = question.detail_options.length ? question.detail_options : question.options

  function update(index: number, field: string, value: string, immediate: boolean) {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    onChange({ rows: next }, immediate)
  }
  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index)
    onChange(next.length ? { rows: next } : null, true)
  }
  function add() {
    onChange({ rows: [...rows, {}] }, false)
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                {schema.map((f) => (
                  <th key={f.name} className="px-2 py-1">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="align-top">
                  {schema.map((f) => (
                    <td key={f.name} className="px-2 py-1">
                      <SubformCell
                        field={f}
                        value={row[f.name] ?? ''}
                        lookupOptions={lookupOptions}
                        disabled={disabled}
                        onChange={(v, immediate) => update(index, f.name, v, immediate)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-xs text-red-600 hover:underline"
                        aria-label={`Remove row ${index + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="rounded-control border border-dashed border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
        >
          + Add {rows.length ? 'another' : 'a'} row
        </button>
      )}
    </div>
  )
}

function SubformCell({
  field,
  value,
  lookupOptions,
  disabled,
  onChange,
}: {
  field: SubformField
  value: string
  lookupOptions: Option[]
  disabled: boolean
  onChange: (value: string, immediate: boolean) => void
}) {
  if (field.type === 'lookup' || field.type === 'choice') {
    const options = field.type === 'choice' ? (field.options ?? []) : lookupOptions
    return (
      <Select
        aria-label={field.label}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value, true)}
      >
        <option value="">Choose</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }
  return (
    <Input
      aria-label={field.label}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value, false)}
      onBlur={(e) => onChange(e.target.value, true)}
    />
  )
}
