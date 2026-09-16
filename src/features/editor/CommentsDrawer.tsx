import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/api/client'
import { Alert, Button, Modal, Spinner, Textarea } from '@/components/ui'
import { formatDateTime } from '@/features/plans/format'

import { editorApi, editorKeys } from './api'
import type { EditorQuestion } from './types'

/** Per-question comment thread (Phase 4.5). Anyone who can see the plan can comment. */
export function CommentsDrawer({
  versionId,
  question,
  onClose,
  onPosted,
}: {
  versionId: number
  question: EditorQuestion
  onClose: () => void
  onPosted: (questionId: number) => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const key = editorKeys.comments(versionId, question.question_id)

  const thread = useQuery({
    queryKey: key,
    queryFn: () => editorApi.comments(versionId, question.question_id),
  })

  const post = useMutation({
    mutationFn: () => editorApi.addComment(versionId, question.question_id, draft),
    onSuccess: () => {
      setDraft('')
      void queryClient.invalidateQueries({ queryKey: key })
      onPosted(question.question_id)
    },
  })

  return (
    <Modal title={`Comments on ${question.question_code}`} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-600">{question.question_text}</p>

      {thread.isPending ? (
        <Spinner label="Loading comments" />
      ) : thread.error ? (
        <Alert>{toApiError(thread.error).detail}</Alert>
      ) : thread.data.length === 0 ? (
        <p className="text-sm text-ink-500">No comments yet.</p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {thread.data.map((entry) => (
            <li key={entry.question_comment_id} className="rounded-md bg-ink-50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 text-xs text-ink-500">
                <span className="font-medium text-ink-800">{entry.author_name}</span>
                <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{entry.comment}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (draft.trim()) post.mutate()
        }}
      >
        {post.error && <Alert>{toApiError(post.error).detail}</Alert>}
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment for the coordinator or reviewer"
          aria-label="New comment"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!draft.trim() || post.isPending}>
            {post.isPending ? 'Posting' : 'Post comment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
