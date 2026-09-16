import { dash, employeeName } from './format'
import { RowEditor, type ColumnSpec, type FieldSpec } from './RowEditor'
import type { CriticalContact, NetworkRequirement, ServiceDescription } from './types'

/**
 * Phase 5.1-5.3: the three structured BIA lists. Each is one `RowEditor` with
 * its own schema. The BIA part of the plan shows them editable; the Plan part
 * shows the resources and network again, read-only, as what the plan protects.
 */

export function ServiceDescriptionEditor({ versionId, readOnly }: { versionId: number; readOnly: boolean }) {
  return (
    <RowEditor<ServiceDescription & Record<string, unknown>>
      versionId={versionId}
      resource="service-descriptions"
      title="Service description"
      singular="service description"
      idKey="service_description_id"
      readOnly={readOnly}
      emptyText="No service description yet. What the process does, who owns it, and the recovery targets it is contracted to."
      columns={[
        { label: 'Process', render: (r) => `${r.process_name}${r.subprocess_name ? ` / ${r.subprocess_name}` : ''}` },
        { label: 'Owner', render: (r) => employeeName(r.owner_employee) },
        { label: 'Description', render: (r) => dash(r.process_description) },
        { label: 'MAO (h)', render: (r) => dash(r.mao) },
        { label: 'MBCO (%)', render: (r) => dash(r.mbco) },
        { label: 'RTO (h)', render: (r) => dash(r.rto) },
        { label: 'RPO (h)', render: (r) => dash(r.rpo) },
      ]}
      fields={SERVICE_FIELDS}
      toForm={(r) => ({ ...r, owner_employee: r.owner_employee?.id ?? '' })}
    />
  )
}

export function CriticalResourcesEditor({
  versionId,
  readOnly,
  title = 'Critical resources',
  emptyText = 'No critical resources yet. Who must be reachable during a disruption, and what they need to work?',
}: {
  versionId: number
  readOnly: boolean
  title?: string
  emptyText?: string
}) {
  return (
    <RowEditor<CriticalContact & Record<string, unknown>>
      versionId={versionId}
      resource="critical-contacts"
      title={title}
      singular="resource"
      idKey="critical_contact_id"
      readOnly={readOnly}
      emptyText={emptyText}
      columns={CONTACT_COLUMNS}
      fields={CONTACT_FIELDS}
      toForm={(r) => ({ ...r, employee: r.employee?.id ?? '' })}
    />
  )
}

export function NetworkRequirementsEditor({
  versionId,
  readOnly,
  title = 'Project network',
  emptyText = 'No network requirements yet. Which connections must exist for the process to run?',
}: {
  versionId: number
  readOnly: boolean
  title?: string
  emptyText?: string
}) {
  return (
    <RowEditor<NetworkRequirement & Record<string, unknown>>
      versionId={versionId}
      resource="network-requirements"
      title={title}
      singular="requirement"
      idKey="network_requirement_id"
      readOnly={readOnly}
      emptyText={emptyText}
      columns={NETWORK_COLUMNS}
      fields={NETWORK_FIELDS}
      toForm={(r) => ({ ...r, employee: r.employee?.id ?? '' })}
    />
  )
}

const CONTACT_COLUMNS: ColumnSpec<CriticalContact & Record<string, unknown>>[] = [
  { label: 'Person', render: (r) => employeeName(r.employee) },
  { label: 'Type', render: (r) => dash(r.contact_type) },
  { label: 'Shift', render: (r) => dash(r.shift_timings) },
  { label: 'Phone', render: (r) => dash(r.primary_phone) },
  { label: 'Seats', render: (r) => dash(r.seat_count) },
  { label: 'Voice', render: (r) => dash(r.voice_non_voice) },
  { label: 'Asset', render: (r) => dash(r.asset_id) },
  { label: 'Hardware / software', render: (r) => dash(r.hardware_software) },
]

const NETWORK_COLUMNS: ColumnSpec<NetworkRequirement & Record<string, unknown>>[] = [
  { label: 'Type', render: (r) => (r.requirement_type === 'BCP_PLAN' ? 'BCP plan' : 'BIA project') },
  { label: 'Source', render: (r) => dash(r.source_ip) },
  { label: 'Destination', render: (r) => dash(r.destination_ip) },
  { label: 'Port', render: (r) => dash(r.port_number) },
  { label: 'Connectivity', render: (r) => dash(r.connectivity_type) },
  { label: 'Owner', render: (r) => employeeName(r.employee) },
]

const SERVICE_FIELDS: FieldSpec[] = [
  { name: 'process_description', label: 'Process description', type: 'textarea', placeholder: 'What the process does and who depends on it' },
  { name: 'owner_employee', label: 'Owner', type: 'employee' },
  { name: 'mao', label: 'MAO (hours)', type: 'text', help: 'Maximum acceptable outage' },
  { name: 'mbco', label: 'MBCO (%)', type: 'text', help: 'Minimum business continuity objective' },
  { name: 'rto', label: 'RTO (hours)', type: 'text', help: 'Recovery time objective' },
  { name: 'rpo', label: 'RPO (hours)', type: 'text', help: 'Recovery point objective' },
]

const CONTACT_FIELDS: FieldSpec[] = [
  { name: 'employee', label: 'Employee', type: 'employee' },
  { name: 'contact_type', label: 'Contact type', type: 'text', placeholder: 'Primary, Backup, Escalation' },
  { name: 'shift_timings', label: 'Shift timings', type: 'text', placeholder: '09:00-18:00 IST' },
  { name: 'primary_phone', label: 'Primary phone', type: 'text' },
  { name: 'alternate_phone', label: 'Alternate phone', type: 'text' },
  { name: 'seat_count', label: 'Seat count', type: 'number' },
  {
    name: 'voice_non_voice',
    label: 'Voice / non-voice',
    type: 'select',
    options: [
      { value: 'Voice', label: 'Voice' },
      { value: 'Non-voice', label: 'Non-voice' },
      { value: 'Both', label: 'Both' },
    ],
  },
  { name: 'asset_id', label: 'Asset id', type: 'text' },
  { name: 'asset_make', label: 'Asset make', type: 'text' },
  { name: 'hardware_software', label: 'Hardware / software', type: 'text' },
]

const NETWORK_FIELDS: FieldSpec[] = [
  {
    name: 'requirement_type',
    label: 'Requirement type',
    type: 'select',
    required: true,
    options: [
      { value: 'BCP_PLAN', label: 'BCP plan' },
      { value: 'BIA_PROJECT', label: 'BIA project' },
    ],
  },
  { name: 'employee', label: 'Owner', type: 'employee' },
  { name: 'source_ip', label: 'Source IP / host', type: 'text' },
  { name: 'destination_ip', label: 'Destination IP / host', type: 'text' },
  { name: 'port_number', label: 'Port', type: 'text' },
  { name: 'connectivity_type', label: 'Connectivity type', type: 'text', placeholder: 'MPLS, VPN, Internet' },
  { name: 'comments', label: 'Comments', type: 'textarea' },
]
