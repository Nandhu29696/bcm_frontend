import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { toApiError } from '@/api/client'
import { IconFile, IconPlus } from '@/components/icons'
import { Button } from '@/components/ui'
import { reviewApi } from '@/features/review/api'

import { editorApi } from './api'
import type { Attachment, EditorQuestion, SectionProgress } from './types'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

/**
 * The files behind an answer — the contract excerpt for an RTO, the penalty
 * clause behind a "Yes". Sits inside the question card. Files are held locally
 * after the initial load; every upload and removal returns the section
 * progress, which is applied the same way a saved answer's is.
 */
export function EvidencePanel({
  versionId,
  question,
  readOnly,
  onProgress,
}: {
  versionId: number
  question: EditorQuestion
  readOnly: boolean
  onProgress: (sections: SectionProgress[]) => void
}) {
  const [files, setFiles] = useState<Attachment[]>(question.evidence.files)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => editorApi.uploadEvidence(versionId, question.question_id, file),
    onSuccess: (result) => {
      setError(null)
      setFiles(result.files)
      onProgress(result.sections)
    },
    onError: (failure) => setError(toApiError(failure).detail),
  })
  const remove = useMutation({
    mutationFn: (id: number) => editorApi.removeEvidence(versionId, question.question_id, id),
    onSuccess: (result) => {
      setError(null)
      setFiles(result.files)
      onProgress(result.sections)
    },
    onError: (failure) => setError(toApiError(failure).detail),
  })
  const open = useMutation({
    mutationFn: (id: number) => reviewApi.downloadLink(id),
    onSuccess: (link) => window.open(link.url, '_blank', 'noopener'),
  })

  const missing = question.evidence.required && files.length === 0

  return (
    <section
      aria-label={`Evidence for ${question.question_code}`}
      className={`mt-4 rounded-lg border px-4 py-3 ${
        missing ? 'border-amber-200 bg-amber-50/60' : 'border-ink-200/80 bg-ink-50/60'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">
          Evidence
          {question.evidence.required ? (
            <span className="ml-1 text-red-500" title="Required">*</span>
          ) : (
            <span className="ml-2 text-xs font-normal text-ink-500">optional</span>
          )}
          {missing && (
            <span className="ml-2 text-xs font-normal text-amber-800">
              Upload the supporting document to complete this answer.
            </span>
          )}
        </p>
        {!readOnly && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label={`Choose evidence for ${question.question_code}`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) upload.mutate(file)
                event.target.value = ''
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              <IconPlus size={14} /> {upload.isPending ? 'Uploading' : 'Upload evidence'}
            </Button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {files.length === 0 ? (
        !missing && (
          <p className="mt-1 text-xs text-ink-500">
            A contract excerpt or other document that supports this answer.
          </p>
        )
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {files.map((f) => (
            <li key={f.entity_document_id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <IconFile size={16} className="shrink-0 text-brand-600" />
                <button
                  type="button"
                  onClick={() => open.mutate(f.entity_document_id)}
                  className="truncate font-medium text-brand-700 hover:underline"
                >
                  {f.file_name}
                </button>
                <span className="text-xs text-ink-500">
                  {f.uploaded_by || 'Unknown'} · {new Date(f.uploaded_at).toLocaleDateString()}
                </span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove.mutate(f.entity_document_id)}
                  disabled={remove.isPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
