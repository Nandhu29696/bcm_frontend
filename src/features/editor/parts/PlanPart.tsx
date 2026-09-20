import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { toApiError } from '@/api/client'
import { IconFile, IconPlus } from '@/components/icons'
import { pageOf } from '@/components/paging'
import { Alert, Button, Pager, Spinner } from '@/components/ui'
import { reviewApi } from '@/features/review/api'
import { sectionApi } from '@/features/sections/api'
import { CriticalResourcesEditor, NetworkRequirementsEditor } from '@/features/sections/BiaSections'
import { RecoveryStrategySection } from '@/features/sections/RecoveryStrategy'
import type { CriticalContact } from '@/features/sections/types'

import { editorApi, editorKeys } from '../api'
import type { Attachment } from '../types'
import { PartSection } from './BiaPart'

/**
 * The Plan part: how the process recovers.
 *
 *   Recovery strategy   core and tactical, from the catalogue
 *   Critical resources  from the BIA — read-only here, edited there
 *   Network             the BIA's requirements, plus the network diagram upload
 *   Project contacts    BU leads, coordinators and the reachable critical contacts
 */
export function PlanPart({ versionId, readOnly }: { versionId: number; readOnly: boolean }) {
  return (
    <div className="space-y-8">
      <RecoveryStrategySection versionId={versionId} readOnly={readOnly} />

      <CriticalResourcesEditor
        versionId={versionId}
        readOnly
        title="Critical resources (from BIA)"
        emptyText="No critical resources yet. Add them in the BIA part; the plan protects this list."
      />

      <PartSection title="Network requirement" description="The connections from the BIA, and the diagram that shows them.">
        <NetworkRequirementsEditor
          versionId={versionId}
          readOnly
          title="Network requirements (from BIA)"
          emptyText="No network requirements yet. Add them in the BIA part."
        />
        <NetworkDiagram versionId={versionId} readOnly={readOnly} />
      </PartSection>

      <PartSection title="Project contacts" description="Who to reach when the plan is invoked.">
        <ProjectContacts versionId={versionId} />
      </PartSection>
    </div>
  )
}

const ACCEPT = '.png,.jpg,.jpeg,.pdf,.docx,.xlsx'

export function NetworkDiagram({ versionId, readOnly }: { versionId: number; readOnly: boolean }) {
  const queryClient = useQueryClient()
  const key = editorKeys.attachments(versionId, 'NETWORK_DIAGRAM')
  const diagrams = useQuery({
    queryKey: key,
    queryFn: () => editorApi.attachments(versionId, 'NETWORK_DIAGRAM'),
  })
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({ queryKey: editorKeys.overview(versionId) })
  }
  const upload = useMutation({
    mutationFn: (file: File) => editorApi.upload(versionId, 'NETWORK_DIAGRAM', file),
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (failure) => setError(toApiError(failure).detail),
  })
  const detach = useMutation({
    mutationFn: (id: number) => editorApi.detach(versionId, id),
    onSuccess: refresh,
    onError: (failure) => setError(toApiError(failure).detail),
  })
  const open = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })

  return (
    <section aria-label="Network diagram" className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card animate-fade-up">
      <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-950">
          Network diagram
          {diagrams.data && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600">
              {diagrams.data.length}
            </span>
          )}
        </h3>
        {!readOnly && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Choose a network diagram"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload.mutate(file)
                event.target.value = ''
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              <IconPlus size={14} /> {upload.isPending ? 'Uploading' : 'Upload diagram'}
            </Button>
          </>
        )}
      </header>

      {error && (
        <div className="p-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {diagrams.isPending ? (
        <div className="px-4 py-6">
          <Spinner label="Loading network diagram" />
        </div>
      ) : diagrams.error ? (
        <div className="p-4">
          <Alert>{toApiError(diagrams.error).detail}</Alert>
        </div>
      ) : diagrams.data.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-500">
          No diagram uploaded. An image or PDF of how the process connects — sites, links and the systems it reaches.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {diagrams.data.map((d) => (
            <DiagramRow
              key={d.entity_document_id}
              diagram={d}
              readOnly={readOnly}
              onOpen={() => open.mutate(d.entity_document_id)}
              onRemove={() => detach.mutate(d.entity_document_id)}
              removing={detach.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function DiagramRow({
  diagram,
  readOnly,
  onOpen,
  onRemove,
  removing,
}: {
  diagram: Attachment
  readOnly: boolean
  onOpen: () => void
  onRemove: () => void
  removing: boolean
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <IconFile size={18} />
        </span>
        <span className="min-w-0">
          <button type="button" onClick={onOpen} className="block truncate font-medium text-brand-700 hover:underline">
            {diagram.file_name}
          </button>
          <span className="block text-xs text-ink-500">
            {formatSize(diagram.file_size_bytes)} · {diagram.uploaded_by || 'Unknown'} ·{' '}
            {new Date(diagram.uploaded_at).toLocaleDateString()}
          </span>
        </span>
      </span>
      {!readOnly && (
        <button type="button" onClick={onRemove} disabled={removing} className="text-xs text-red-600 hover:underline disabled:opacity-50">
          Remove
        </button>
      )}
    </li>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** BU leads and coordinators from the overview; reachable contacts from the BIA. */
function ProjectContacts({ versionId }: { versionId: number }) {
  const [page, setPage] = useState(1)
  const overview = useQuery({
    queryKey: editorKeys.overview(versionId),
    queryFn: () => editorApi.overview(versionId),
  })
  const contactsApi = sectionApi<CriticalContact>('critical-contacts')
  const contacts = useQuery({ queryKey: contactsApi.key(versionId), queryFn: () => contactsApi.list(versionId) })

  if (overview.isPending || contacts.isPending) return <Spinner label="Loading project contacts" />
  if (overview.error) return <Alert>{toApiError(overview.error).detail}</Alert>
  if (contacts.error) return <Alert>{toApiError(contacts.error).detail}</Alert>

  const { people } = overview.data
  const rows: { key: string; role: string; name: string; contact: string }[] = [
    ...people.bu_leads.map((l) => ({
      key: `lead-${l.bu_lead_id}`,
      role: l.primary ? 'BU lead' : 'BU lead (add-on)',
      name: l.lead_name,
      contact: l.email,
    })),
    ...people.coordinators.map((c) => ({
      key: `coord-${c.coordinator_assignment_id}`,
      role: `Coordinator${c.coordinator_type ? ` · ${c.coordinator_type}` : ''}`,
      name: c.full_name,
      contact: c.email,
    })),
    ...contacts.data
      .filter((c) => c.employee || c.primary_phone || c.alternate_phone)
      .map((c) => ({
        key: `contact-${c.critical_contact_id}`,
        role: c.contact_type ? `Critical contact · ${c.contact_type}` : 'Critical contact',
        name: c.employee?.name ?? '—',
        contact: [c.primary_phone, c.alternate_phone, c.employee?.email].filter(Boolean).join(' · '),
      })),
  ]

  return (
    <section aria-label="Project contacts" className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card animate-fade-up">
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-500">
          No contacts yet. Set the cost code's BU lead, assign a coordinator, or add critical resources in the BIA.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {pageOf(rows, page).map((r) => (
                <tr key={r.key}>
                  <td className="whitespace-nowrap text-ink-600">{r.role}</td>
                  <td className="font-medium text-ink-900">{r.name}</td>
                  <td className="text-ink-600">{r.contact || <span className="text-ink-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={rows.length} onPage={setPage} label="Project contact pages" />
        </div>
      )}
    </section>
  )
}
