import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Button, Spinner } from '@/components/ui'

import { fetchRiskOptions, riskActionsApi, riskOptionsKey, sectionApi } from './api'
import { dash, employeeName } from './format'
import { RowEditor, RowForm, type FieldSpec } from './RowEditor'
import type { Risk, RiskAction, RiskOptions } from './types'

/**
 * The risk register (Phase 5.4-5.5) with its heat map.
 *
 * Scores are never computed here. The three ratings are sent, the server
 * derives inherent, residual and level, and the table shows what came back —
 * so the register, the heat map and the eventual document all agree because
 * they all read the same stored numbers.
 */
export function RiskRegister({ versionId, readOnly }: { versionId: number; readOnly: boolean }) {
  const options = useQuery({ queryKey: riskOptionsKey(versionId), queryFn: () => fetchRiskOptions(versionId), staleTime: 300_000 })
  const risks = useQuery({ queryKey: sectionApi<Risk>('risks').key(versionId), queryFn: () => sectionApi<Risk>('risks').list(versionId) })

  if (options.isPending || risks.isPending) return <Spinner label="Loading risk register" />
  if (options.error) return <Alert>{toApiError(options.error).detail}</Alert>

  const fields = riskFields(options.data)

  return (
    <div className="space-y-6">
      <HeatMap risks={risks.data ?? []} options={options.data} />

      <RowEditor<Risk & Record<string, unknown>>
        versionId={versionId}
        resource="risks"
        title="Risk register"
        singular="risk"
        idKey="risk_id"
        readOnly={readOnly}
        emptyText="No risks recorded. Rate likelihood, severity and control effectiveness and the scores are derived for you."
        columns={[
          { label: 'Risk', render: (r) => <span className="font-medium text-ink-900">{r.risk_name}</span> },
          { label: 'Resource', render: (r) => dash(r.resource_type) },
          { label: 'Owner', render: (r) => employeeName(r.owner_employee) },
          { label: 'L', render: (r) => dash(r.likelihood_rating && Number(r.likelihood_rating)) },
          { label: 'S', render: (r) => dash(r.severity_rating && Number(r.severity_rating)) },
          { label: 'C', render: (r) => dash(r.control_effectiveness_rating && Number(r.control_effectiveness_rating)) },
          { label: 'Inherent', render: (r) => dash(r.inherent_risk_score && Number(r.inherent_risk_score)) },
          { label: 'Residual', render: (r) => dash(r.residual_risk_score && Number(r.residual_risk_score)) },
          { label: 'Level', render: (r) => <LevelBadge level={r.risk_level} /> },
          {
            label: 'Actions',
            render: (r) => (
              <ActionsCell versionId={versionId} risk={r} options={options.data} readOnly={readOnly} />
            ),
          },
        ]}
        fields={fields}
        toForm={(r) => ({
          ...r,
          owner_employee: r.owner_employee?.id ?? '',
          likelihood_rating: r.likelihood_rating ? String(Number(r.likelihood_rating)) : '',
          severity_rating: r.severity_rating ? String(Number(r.severity_rating)) : '',
          control_effectiveness_rating: r.control_effectiveness_rating ? String(Number(r.control_effectiveness_rating)) : '',
        })}
      />
    </div>
  )
}

function riskFields(options: RatingSource): FieldSpec[] {
  const rating = (list: { points: string; label: string }[]) =>
    list.map((o) => ({ value: String(Number(o.points)), label: o.label }))
  return [
    { name: 'risk_name', label: 'Risk', type: 'text', required: true, wide: true, placeholder: 'e.g. Power failure at primary site' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'resource_type', label: 'Resource type', type: 'select', options: options.resource_types.map((v) => ({ value: v, label: v })) },
    { name: 'owner_employee', label: 'Risk owner', type: 'employee' },
    { name: 'impact_area', label: 'Impact area', type: 'text' },
    { name: 'target_closure_date', label: 'Target closure', type: 'date' },
    { name: 'likelihood_rating', label: 'Likelihood', type: 'select', options: rating(options.ratings.likelihood_rating) },
    { name: 'severity_rating', label: 'Severity', type: 'select', options: rating(options.ratings.severity_rating) },
    { name: 'control_effectiveness_rating', label: 'Control effectiveness', type: 'select', options: rating(options.ratings.control_effectiveness_rating) },
    { name: 'occurred_flag', label: 'Has this risk occurred?', type: 'checkbox' },
    { name: 'comments', label: 'Comments', type: 'textarea' },
  ]
}

type RatingSource = Pick<RiskOptions, 'ratings' | 'resource_types'>

export function LevelBadge({ level }: { level: Risk['risk_level'] }) {
  if (!level) return <span className="text-ink-400">—</span>
  const tone =
    level === 'High' ? 'bg-red-100 text-red-800' : level === 'Moderate' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{level}</span>
}

/**
 * Likelihood x severity heat map. Cells count the risks rated at that pair;
 * cell colour is the inherent score band. Reads the stored ratings only.
 */
function HeatMap({ risks, options }: { risks: Risk[]; options: RiskOptions }) {
  const likelihoods = options.ratings.likelihood_rating
  const severities = options.ratings.severity_rating

  const counts = useMemo(() => {
    const map = new Map<string, Risk[]>()
    for (const r of risks) {
      if (r.likelihood_rating === null || r.severity_rating === null) continue
      const key = `${Number(r.likelihood_rating)}:${Number(r.severity_rating)}`
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return map
  }, [risks])

  const maxInherent = Number(likelihoods.at(-1)?.points ?? 3) * Number(severities.at(-1)?.points ?? 3)

  return (
    <section aria-label="Risk heat map" className="rounded-card border border-ink-200/80 bg-white shadow-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink-900">Heat map</h3>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium text-ink-500">Likelihood ↓ / Severity →</th>
              {severities.map((s) => (
                <th key={s.points} className="px-2 py-1 text-center text-xs font-medium text-ink-600">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...likelihoods].reverse().map((l) => (
              <tr key={l.points}>
                <th scope="row" className="px-2 py-1 text-left text-xs font-medium text-ink-600">
                  {l.label}
                </th>
                {severities.map((s) => {
                  const inherent = Number(l.points) * Number(s.points)
                  const here = counts.get(`${Number(l.points)}:${Number(s.points)}`) ?? []
                  const band = inherent / maxInherent
                  const tone = band >= 0.66 ? 'bg-red-200' : band >= 0.33 ? 'bg-amber-200' : 'bg-emerald-200'
                  return (
                    <td
                      key={s.points}
                      title={here.map((r) => r.risk_name).join(', ')}
                      className={`h-12 w-24 border border-white text-center align-middle ${tone}`}
                      aria-label={`${l.label} likelihood, ${s.label} severity: ${here.length} risk${here.length === 1 ? '' : 's'}`}
                    >
                      <span className="text-base font-semibold text-ink-800">{here.length || ''}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Cell colour is the inherent score band (likelihood × severity). Hover a cell to see which risks it holds.
      </p>
    </section>
  )
}

/** The mitigation and contingency actions for one risk, inline in its row. */
function ActionsCell({
  versionId,
  risk,
  options,
  readOnly,
}: {
  versionId: number
  risk: Risk
  options: RiskOptions
  readOnly: boolean
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RiskAction | 'new' | null>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: sectionApi<Risk>('risks').key(versionId) })
  const remove = useMutation({
    mutationFn: (id: number) => riskActionsApi.remove(versionId, risk.risk_id, id),
    onSuccess: invalidate,
  })

  const fields: FieldSpec[] = [
    {
      name: 'action_type',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'MITIGATION', label: 'Mitigation' },
        { value: 'CONTINGENCY', label: 'Contingency' },
      ],
    },
    { name: 'description', label: 'Action', type: 'textarea', required: true },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [...options.action_statuses.MITIGATION, ...options.action_statuses.CONTINGENCY].map((s) => ({ value: s, label: s })),
      help: 'Mitigation and contingency actions use different status lists.',
    },
    { name: 'target_date', label: 'Target date', type: 'date' },
    { name: 'comments', label: 'Comments', type: 'textarea' },
  ]

  return (
    <div className="min-w-56 space-y-1 text-xs">
      {risk.actions.length === 0 && <span className="text-ink-400">None</span>}
      {risk.actions.map((a) => (
        <div key={a.risk_action_id} className={`rounded px-2 py-1 ${a.is_overdue ? 'bg-red-50' : 'bg-ink-50'}`}>
          <div className="flex items-start justify-between gap-2">
            <span>
              <span className="font-medium text-ink-800">{a.action_type === 'MITIGATION' ? 'Mitigation' : 'Contingency'}</span>
              {a.status && <span className="text-ink-500"> · {a.status}</span>}
              {a.is_overdue && <span className="font-semibold text-red-700"> · overdue</span>}
            </span>
            {!readOnly && (
              <span className="shrink-0 whitespace-nowrap">
                <button type="button" onClick={() => setEditing(a)} className="text-brand-700 hover:underline">
                  Edit
                </button>
                <button type="button" onClick={() => remove.mutate(a.risk_action_id)} className="ml-2 text-red-600 hover:underline">
                  Delete
                </button>
              </span>
            )}
          </div>
          <p className="text-ink-600">{a.description}</p>
          {a.target_date && <p className="text-ink-500">Target {a.target_date}</p>}
        </div>
      ))}
      {!readOnly && (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing('new')}>
          + Add action
        </Button>
      )}
      {editing !== null && (
        <RowForm
          title={editing === 'new' ? `Add action to "${risk.risk_name}"` : 'Edit action'}
          fields={fields}
          initial={editing === 'new' ? {} : { ...editing }}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            if (editing === 'new') await riskActionsApi.create(versionId, risk.risk_id, values)
            else await riskActionsApi.update(versionId, risk.risk_id, editing.risk_action_id, values)
            await invalidate()
          }}
        />
      )}
    </div>
  )
}
