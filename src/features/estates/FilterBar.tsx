import { useEffect, useRef, useState } from 'react'

import { IconChevronDown, IconSearch } from '@/components/icons'
import { Button, Input } from '@/components/ui'

import type { CostCodeFilters, FilterOptions, NamedRef } from './types'

interface FilterBarProps {
  filters: CostCodeFilters
  options?: FilterOptions
  optionsLoading: boolean
  activeCount: number
  onTextChange: (value: string) => void
  onToggle: (
    key: 'process' | 'subprocess' | 'region' | 'bu_lead' | 'bcp_status',
    value: number | string,
  ) => void
  onClear: () => void
}

/**
 * The six filters of journey step 3.
 *
 * Options come from the estate-scoped facet endpoint, so every choice offered
 * returns at least one row. A dropdown listing the organisation's two hundred
 * processes when this estate uses four is not a filter, it is a search problem
 * handed back to the user.
 */
export function FilterBar({
  filters,
  options,
  optionsLoading,
  activeCount,
  onTextChange,
  onToggle,
  onClear,
}: FilterBarProps) {
  return (
    // A named search landmark: it gives screen-reader users a way to jump
    // straight to the filters, and distinguishes these controls from the
    // identically-labelled sort buttons in the table header.
    <search
      aria-label="Cost code filters"
      className="mb-4 block rounded-card border border-ink-200/80 bg-white shadow-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            className="pl-9"
            type="search"
            value={filters.cost_code}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Filter by cost code"
            aria-label="Filter by cost code"
          />
        </div>

        <MultiSelect
          label="Process"
          options={options?.process ?? []}
          selected={filters.process}
          loading={optionsLoading}
          onToggle={(id) => onToggle('process', id)}
        />
        <MultiSelect
          label="Subprocess"
          options={options?.subprocess ?? []}
          selected={filters.subprocess}
          loading={optionsLoading}
          onToggle={(id) => onToggle('subprocess', id)}
        />
        <MultiSelect
          label="Region"
          options={options?.region ?? []}
          selected={filters.region}
          loading={optionsLoading}
          onToggle={(id) => onToggle('region', id)}
        />
        <MultiSelect
          label="BU lead"
          options={options?.bu_lead ?? []}
          selected={filters.bu_lead}
          loading={optionsLoading}
          onToggle={(id) => onToggle('bu_lead', id)}
        />
        <MultiSelect
          label="BCP status"
          options={(options?.bcp_status ?? []).map((status) => ({
            id: status,
            name: status,
          }))}
          selected={filters.bcp_status}
          loading={optionsLoading}
          onToggle={(value) => onToggle('bcp_status', value)}
        />

        {activeCount > 0 && (
          <Button variant="ghost" onClick={onClear}>
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </search>
  )
}

interface MultiSelectProps<T extends number | string> {
  label: string
  options: { id: T; name: string }[]
  selected: T[]
  loading: boolean
  onToggle: (value: T) => void
}

function MultiSelect<T extends number | string>({
  label,
  options,
  selected,
  loading,
  onToggle,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocumentClick(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const count = selected.length

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9.5 items-center gap-1.5 rounded-control border px-3 text-sm font-medium transition-colors ${
          count > 0
            ? 'border-brand-300 bg-brand-50 text-brand-800'
            : 'border-ink-200 bg-white text-ink-700 shadow-card hover:border-ink-300 hover:bg-ink-50'
        }`}
      >
        {label}
        {count > 0 && (
          <span className="rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
            {count}
          </span>
        )}
        <IconChevronDown size={14} className="text-ink-400" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute left-0 z-20 mt-1.5 max-h-72 w-64 overflow-auto rounded-card border border-ink-200 bg-white p-1.5 shadow-raised animate-fade-up"
        >
          {loading && <p className="px-3 py-2 text-sm text-ink-500">Loading…</p>}
          {!loading && options.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-500">
              No {label.toLowerCase()} values in this estate.
            </p>
          )}
          {options.map((option) => {
            const checked = selected.includes(option.id)
            return (
              <label
                key={String(option.id)}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 text-sm text-ink-700 hover:bg-brand-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.id)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="truncate">{option.name}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { NamedRef }
