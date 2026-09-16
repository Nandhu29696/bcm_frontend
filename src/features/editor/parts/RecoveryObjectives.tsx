import { useQuery } from '@tanstack/react-query'

import { toApiError } from '@/api/client'
import { IconChevronRight } from '@/components/icons'
import { Alert, Spinner, StatusBadge } from '@/components/ui'

import { editorApi, editorKeys } from '../api'
import type { PlanOverview, RecoveryObjectives as Objectives } from '../types'
import { hours, percent, type PartKey } from './parts'

/**
 * The plan's hub. The recovery objectives are read back from the questionnaire
 * answers (RTO, MBCO, RPO — and MAO, which belongs with them); beneath them the
 * three parts of the plan, each with its derived status, open on click.
 */
export function RecoveryObjectivesPart({
  versionId,
  onOpen,
}: {
  versionId: number
  onOpen: (part: PartKey) => void
}) {
  const overview = useQuery({
    queryKey: editorKeys.overview(versionId),
    queryFn: () => editorApi.overview(versionId),
  })
  if (overview.isPending) return <Spinner label="Loading recovery objectives" />
  if (overview.error) return <Alert>{toApiError(overview.error).detail}</Alert>

  const { objectives, stages } = overview.data
  return (
    <div className="space-y-6">
      <section aria-label="Recovery objectives" className="rounded-card border border-ink-200/80 bg-white shadow-card animate-fade-up">
        <header className="border-b border-ink-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink-950">Recovery objectives</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Read from the questionnaire answers. Change them on the RTO, MBCO, RPO and MAO tabs.
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          <ObjectiveTile label="RTO" hint="Recovery time objective" value={hours(objectives.rto_hours)} />
          <ObjectiveTile label="MBCO" hint="Minimum business continuity objective" value={percent(objectives.mbco_percent)} />
          <ObjectiveTile label="RPO" hint="Recovery point objective" value={rpo(objectives)} />
          <ObjectiveTile label="MAO" hint="Maximum acceptable outage" value={hours(objectives.mao_hours)} />
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-3" role="list" aria-label="Plan parts">
        <StageCard
          title="BIA"
          description="Business impact analysis: BIA details, dependencies, critical resources, people and the project network."
          status={stages.bia.status}
          detail={`${stages.bia.required_answered} of ${stages.bia.required_visible} questions · ${stages.bia.critical_resources} resources · ${stages.bia.network_requirements} network`}
          onOpen={() => onOpen('bia')}
        />
        <StageCard
          title="RA"
          description="Risk assessment: the risks to this process, scored and with mitigation and contingency actions."
          status={stages.ra.status}
          detail={
            stages.ra.risks === 0
              ? 'No risks yet'
              : `${stages.ra.risks} risk${stages.ra.risks === 1 ? '' : 's'}${stages.ra.unrated ? `, ${stages.ra.unrated} unrated` : ''}`
          }
          onOpen={() => onOpen('ra')}
        />
        <StageCard
          title="Plan"
          description="Recovery strategy, the critical resources and network from the BIA, the network diagram and project contacts."
          status={stages.plan.status}
          detail={`${stages.plan.strategies} strateg${stages.plan.strategies === 1 ? 'y' : 'ies'} · ${stages.plan.network_diagrams} diagram${stages.plan.network_diagrams === 1 ? '' : 's'}`}
          onOpen={() => onOpen('plan')}
        />
      </div>
    </div>
  )
}

function rpo(objectives: Objectives): string | null {
  if (objectives.rpo_in_contract === 'NO') return 'Not in contract'
  return hours(objectives.rpo_hours)
}

function ObjectiveTile({ label, hint, value }: { label: string; hint: string; value: string | null }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        {label}
        <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-400">{hint}</span>
      </dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${value === null ? 'text-ink-300' : 'text-ink-950'}`}>
        {value ?? 'Not answered'}
      </dd>
    </div>
  )
}

function StageCard({
  title,
  description,
  status,
  detail,
  onOpen,
}: {
  title: string
  description: string
  status: PlanOverview['stages']['bia']['status']
  detail: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onOpen}
      className="group flex flex-col rounded-card border border-ink-200/80 bg-white p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-raised focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 animate-fade-up"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-ink-950">{title}</span>
        <StatusBadge status={status} />
      </span>
      <span className="mt-2 text-sm text-ink-600">{description}</span>
      <span className="mt-4 flex items-center justify-between text-xs text-ink-500">
        <span className="tabular-nums">{detail}</span>
        <span className="inline-flex items-center gap-1 font-medium text-brand-700 group-hover:underline">
          Open <IconChevronRight size={14} />
        </span>
      </span>
    </button>
  )
}
