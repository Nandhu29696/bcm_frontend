import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { useToast } from '@/components/useToast'
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '@/components/ui'
import { reviewApi } from '@/features/review/api'

import { insightsApi, insightsKeys, type HelpResource } from './api'

/** The BCM team's document library (Phase 9.1): search, browse, download; managed by admins. */
export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const queryClient = useQueryClient()
  const toast = useToast()
  const library = useQuery({ queryKey: insightsKeys.help(q, category), queryFn: () => insightsApi.help(q, category) })
  const categories = useQuery({ queryKey: insightsKeys.helpCategories, queryFn: insightsApi.helpCategories })
  const [editing, setEditing] = useState<HelpResource | 'new' | null>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['help'] })
  }
  const remove = useMutation({ mutationFn: (id: number) => insightsApi.deleteHelp(id), onSuccess: refresh })
  const download = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })

  const canManage = library.data?.can_manage ?? false
  const grouped = new Map<string, HelpResource[]>()
  for (const r of library.data?.results ?? []) grouped.set(r.category || 'General', [...(grouped.get(r.category || 'General') ?? []), r])

  return (
    <>
      <PageHeader title="Help" eyebrow="BCM team document library" subtitle="Guides, runbooks and templates from the business continuity team.">
        {canManage && <Button onClick={() => setEditing('new')}>Add document</Button>}
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Search titles, descriptions and file names"
          aria-label="Search help"
          className="max-w-md"
        />
        <Select value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Category" className="w-48">
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>

      {library.isPending ? (
        <div className="py-16 text-center">
          <Spinner label="Loading the library" />
        </div>
      ) : library.error ? (
        <Alert>{toApiError(library.error).detail}</Alert>
      ) : grouped.size === 0 ? (
        <EmptyState title={q || category ? 'Nothing matches' : 'The library is empty'} description={canManage ? 'Add the first document.' : 'Documents added by the BCM team appear here.'} />
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([name, items]) => (
            <section key={name} aria-label={name}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">{name}</h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((r) => (
                  <li key={r.help_resource_id} className="flex flex-col rounded-card border border-ink-200/80 bg-white p-4 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-ink-900">{r.title}</h3>
                      {r.document && <Badge>{r.document.file_name.split('.').pop()?.toUpperCase()}</Badge>}
                    </div>
                    {r.description && <p className="mt-1 text-sm text-ink-600">{r.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {r.document?.entity_document_id && (
                        <Button size="sm" onClick={() => download.mutate(r.document!.entity_document_id as number)} disabled={download.isPending}>
                          Download
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.help_resource_id)} aria-label={`Remove ${r.title}`}>
                            Remove
                          </Button>
                        </>
                      )}
                      <span className="ml-auto text-xs text-ink-400">{r.document?.file_name}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <HelpDialog
          resource={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
            toast.success('Document saved')
          }}
        />
      )}
    </>
  )
}

function HelpDialog({ resource, onClose, onSaved }: { resource: HelpResource | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: resource?.title ?? '', description: resource?.description ?? '', category: resource?.category ?? 'Guides' })
  const [file, setFile] = useState<File | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = new FormData()
      body.append('title', form.title)
      body.append('description', form.description)
      body.append('category', form.category)
      if (file) body.append('file', file)
      return resource ? insightsApi.editHelp(resource.help_resource_id, body) : insightsApi.createHelp(body)
    },
    onSuccess: onSaved,
  })
  const failure = save.error ? toApiError(save.error) : null
  return (
    <Modal title={resource ? `Edit ${resource.title}` : 'Add a document'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        {failure && <Alert>{failure.detail}</Alert>}
        <Field label="Title" error={failure?.field_errors.title?.[0]}>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label="Title" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Description" />
        </Field>
        <Field label="Category">
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" list="help-categories" />
        </Field>
        <Field label={resource ? 'Replace file (optional)' : 'File'} hint="PDF, Word, Excel or an image.">
          <input type="file" aria-label="File" className="block w-full text-sm text-ink-700" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={!resource} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving' : resource ? 'Save' : 'Add document'}</Button>
        </div>
      </form>
    </Modal>
  )
}
