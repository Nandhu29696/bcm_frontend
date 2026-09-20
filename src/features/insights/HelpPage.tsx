import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { useToast } from '@/components/useToast'
import { pageOf } from '@/components/paging'
import { Alert, Badge, Button, EmptyState, Field, FilterBar, FilterItem, Input, Modal, PageHeader, Pager, Select, TableSkeleton, Textarea } from '@/components/ui'
import { formatDate } from '@/features/operations/format'
import { reviewApi } from '@/features/review/api'

import { insightsApi, insightsKeys, type HelpResource } from './api'

/** The BCM team's document library (Phase 9.1): search, browse, download; managed by admins. */
export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const queryClient = useQueryClient()
  const toast = useToast()
  const library = useQuery({ queryKey: insightsKeys.help(q, category), queryFn: () => insightsApi.help(q, category) })
  const categories = useQuery({ queryKey: insightsKeys.helpCategories, queryFn: insightsApi.helpCategories })
  const [editing, setEditing] = useState<HelpResource | 'new' | null>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
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
  // One table, ordered by category then title, so a category reads as a block.
  const rows = [...(library.data?.results ?? [])].sort(
    (a, b) => (a.category || 'General').localeCompare(b.category || 'General') || a.title.localeCompare(b.title),
  )

  return (
    <>
      <PageHeader title="Help" eyebrow="BCM team document library" subtitle="Guides, runbooks and templates from the business continuity team.">
        {canManage && <Button onClick={() => setEditing('new')}>Add document</Button>}
      </PageHeader>

      <FilterBar
        active={[q, category].filter(Boolean).length}
        onClear={() => setSearchParams({}, { replace: true })}
        count={library.data ? `${rows.length} document${rows.length === 1 ? '' : 's'}` : undefined}
      >
        <FilterItem className="min-w-[16rem] flex-1 sm:max-w-md">
          <Input
            type="search"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search titles, descriptions and file names"
            aria-label="Search help"
          />
        </FilterItem>
        <FilterItem>
          <Select value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </FilterItem>
      </FilterBar>

      {library.isPending ? (
        <TableSkeleton cols={5} label="Loading the library" />
      ) : library.error ? (
        <Alert>{toApiError(library.error).detail}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState title={q || category ? 'Nothing matches' : 'The library is empty'} description={canManage ? 'Add the first document.' : 'Documents added by the BCM team appear here.'} />
      ) : (
        <div className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Help documents">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>File</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageOf(rows, page).map((r) => (
                  <tr key={r.help_resource_id}>
                    <td className="max-w-md">
                      <span className="block font-medium text-ink-900">{r.title}</span>
                      {r.description && <span className="mt-0.5 block text-xs text-ink-500">{r.description}</span>}
                    </td>
                    <td className="whitespace-nowrap">{r.category || 'General'}</td>
                    <td className="whitespace-nowrap">
                      {r.document ? (
                        <span className="inline-flex items-center gap-2">
                          <Badge>{r.document.file_name.split('.').pop()?.toUpperCase()}</Badge>
                          <span className="text-xs text-ink-500">{r.document.file_name}</span>
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {r.created_by_name || '—'}
                      <span className="block text-ink-400">{formatDate(r.created_at)}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <span className="inline-flex items-center gap-1">
                        {r.document?.entity_document_id && (
                          <Button size="sm" onClick={() => download.mutate(r.document!.entity_document_id as number)} disabled={download.isPending} aria-label={`Download ${r.title}`}>
                            Download
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.help_resource_id)} aria-label={`Remove ${r.title}`}>
                              Remove
                            </Button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={rows.length} onPage={(n) => setParam('page', String(n))} label="Document pages" />
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
