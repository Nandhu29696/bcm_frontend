import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Badge, Input, Spinner } from '@/components/ui'
import {
  CriticalResourcesEditor,
  NetworkRequirementsEditor,
  ServiceDescriptionEditor,
} from '@/features/sections/BiaSections'

import { editorApi, editorKeys } from '../api'
import type { EditorQuestion, PlanOverview } from '../types'
import { DEPENDENCY_GROUPS, DEPENDENCY_ORDER, percent } from './parts'

/**
 * The BIA part of the plan.
 *
 *   BIA details        the BIA section's own questions (site, work-from-home)
 *   Dependencies       internal (corporate functions), external (vendors),
 *                      subcontractor — the same section's remaining questions
 *   Critical resources the people and assets the process cannot run without
 *   People             everyone on the cost code, the MBCO headcount, BU leads,
 *                      coordinators
 *   Project network    the connections the process needs
 *
 * The questions are the editor's own — autosave, comments and completion all
 * keep working — so the editor renders them and hands the cards in.
 */
export function BiaPart({
  versionId,
  readOnly,
  questions,
  renderQuestion,
}: {
  versionId: number
  readOnly: boolean
  /** The BIA section's visible questions, in display order. */
  questions: EditorQuestion[]
  renderQuestion: (question: EditorQuestion) => ReactNode
}) {
  const details = questions.filter((q) => !DEPENDENCY_GROUPS[q.question_code])
  const dependencies = DEPENDENCY_ORDER.map((group) => ({
    group,
    questions: questions.filter((q) => DEPENDENCY_GROUPS[q.question_code] === group),
  })).filter((g) => g.questions.length > 0)

  return (
    <div className="space-y-8">
      <PartSection title="BIA details" description="Where the process runs and how it is staffed.">
        {details.length === 0 ? (
          <p className="text-sm text-ink-500">No BIA questions are in the question bank.</p>
        ) : (
          details.map(renderQuestion)
        )}
        <ServiceDescriptionEditor versionId={versionId} readOnly={readOnly} />
      </PartSection>

      <PartSection
        title="Dependencies"
        description="What the process depends on inside the company, outside it, and by subcontract."
      >
        {dependencies.length === 0 ? (
          <p className="text-sm text-ink-500">No dependency questions are in the question bank.</p>
        ) : (
          dependencies.map((d) => (
            <div key={d.group} className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                {d.group}
                <Badge>{d.questions.length}</Badge>
              </h4>
              {d.questions.map(renderQuestion)}
            </div>
          ))
        )}
      </PartSection>

      <CriticalResourcesEditor versionId={versionId} readOnly={readOnly} />

      <PartSection
        title="People"
        description="Everyone on this cost code, sized against the MBCO; the BU leads and coordinators for the plan."
      >
        <PeoplePanel versionId={versionId} />
      </PartSection>

      <NetworkRequirementsEditor versionId={versionId} readOnly={readOnly} />
    </div>
  )
}

export function PartSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  // A heading over a group, not a landmark: the row editors inside are the
  // named regions, and a region of the same name around one would be ambiguous.
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-ink-950">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/** The cost code's employees with the MBCO headcount, its BU leads and the coordinators. */
export function PeoplePanel({ versionId }: { versionId: number }) {
  const overview = useQuery({
    queryKey: editorKeys.overview(versionId),
    queryFn: () => editorApi.overview(versionId),
  })
  const [search, setSearch] = useState('')
  if (overview.isPending) return <Spinner label="Loading people" />
  if (overview.error) return <Alert>{toApiError(overview.error).detail}</Alert>
  const { people } = overview.data
  const needle = search.trim().toLowerCase()
  const employees = needle
    ? people.employees.filter((e) => [e.full_name, e.employee_number, e.designation, e.email, e.bu_lead].some((v) => v.toLowerCase().includes(needle)))
    : people.employees

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ListCard
        title="Employees on this cost code"
        count={people.headcount}
        className="lg:col-span-2"
        aside={<MbcoSummary people={people} />}
        toolbar={
          people.employees.length > 5 ? (
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by name, number, designation" aria-label="Find an employee" />
          ) : undefined
        }
        empty={needle ? 'Nobody matches.' : 'No employees are recorded against this cost code.'}
        rows={employees.map((e) => ({
          key: e.employee_id,
          name: e.full_name,
          meta: [e.employee_number, e.designation, e.bu_lead].filter(Boolean).join(' · '),
          email: e.email,
        }))}
      />
      <div className="space-y-4">
        <ListCard
          title="BU leads"
          count={people.bu_leads.length}
          empty="This cost code has no BU lead. Set one on the cost code."
          rows={people.bu_leads.map((l) => ({
            key: l.bu_lead_id,
            name: l.lead_name,
            meta: l.primary ? 'Cost code BU lead' : 'Add-on lead',
            email: l.email,
          }))}
        />
        <ListCard
          title="Coordinators"
          count={people.coordinators.length}
          empty="Nobody is assigned to this version yet."
          rows={people.coordinators.map((c) => ({
            key: c.coordinator_assignment_id,
            name: c.full_name,
            meta: c.coordinator_type,
            email: c.email,
          }))}
        />
      </div>
    </div>
  )
}

function MbcoSummary({ people }: { people: PlanOverview['people'] }) {
  if (people.mbco_percent === null) {
    return <span className="text-xs text-ink-500">Answer the MBCO question to size the minimum team.</span>
  }
  return (
    <span className="inline-flex items-baseline gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-800" title={`MBCO ${percent(people.mbco_percent)} of ${people.headcount} employees`}>
      <span className="text-lg font-semibold tabular-nums leading-none text-brand-800">
        {people.mbco_required ?? 0}
        <span className="text-xs font-normal text-brand-700"> / {people.headcount}</span>
      </span>
      <span>needed for minimum service (MBCO {percent(people.mbco_percent)})</span>
    </span>
  )
}

function ListCard({
  title,
  count,
  rows,
  empty,
  aside,
  toolbar,
  className = '',
}: {
  title: string
  count: number
  rows: { key: number; name: string; meta: string; email: string }[]
  empty: string
  aside?: ReactNode
  toolbar?: ReactNode
  className?: string
}) {
  return (
    <section aria-label={title} className={`overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
          {title}
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">{count}</span>
        </h4>
        {aside}
      </header>
      {toolbar && <div className="border-b border-ink-100 px-5 py-2">{toolbar}</div>}
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink-900">{row.name}</span>
                {row.meta && <span className="ml-2 text-xs text-ink-500">{row.meta}</span>}
              </span>
              {row.email && <span className="text-xs text-ink-500">{row.email}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
