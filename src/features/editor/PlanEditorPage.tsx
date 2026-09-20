import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router-dom'

import { toApiError } from '@/api/client'
import { IconCheck, IconComment } from '@/components/icons'
import { Alert, Badge, Button, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { planKeys, plansApi } from '@/features/plans/api'
import type { PlanVersion } from '@/features/plans/types'
import { ReviewActions } from '@/features/review/ReviewActions'
import { RiskRegister } from '@/features/sections/RiskRegister'

import { editorApi, editorKeys } from './api'
import { CommentsDrawer } from './CommentsDrawer'
import { EvidencePanel } from './EvidencePanel'
import { BiaPart } from './parts/BiaPart'
import { isPartKey, LEGACY_SECTION_PARTS, PARTS, type PartKey } from './parts/parts'
import { PlanPart } from './parts/PlanPart'
import { RecoveryObjectivesPart } from './parts/RecoveryObjectives'
import { QuestionRenderer } from './QuestionRenderer'
import type { EditorQuestion, EditorSection, Questionnaire, SectionProgress } from './types'
import { useAutosave, type QuestionSaveState } from './useAutosave'
import { computeVisibility, wantsEvidence } from './visibility'

/**
 * Answers are stored per context. The editor writes the plan proper — BCP —
 * which is also the context submission and the generated document read.
 */
const CONTEXT = 'BCP'

/**
 * Journey step 5 — the BCP plan editor.
 *
 * The plan is worked through in parts (`?part=`): the questionnaire tabs, the
 * recovery-objective hub, then BIA, RA and Plan. The questionnaire tab lives in
 * `?section=` so a link lands on the right one. The editor body is keyed on the
 * version and remounts when it changes, which is what lets `useAutosave`
 * initialise its state once rather than sync it to props.
 */
export function PlanEditorPage() {
  const { planVersionId: param } = useParams()
  const versionId = Number(param)

  const version = useQuery({
    queryKey: planKeys.version(versionId),
    queryFn: () => plansApi.version(versionId),
    enabled: Number.isInteger(versionId),
  })
  const questionnaire = useQuery({
    queryKey: editorKeys.questionnaire(versionId, CONTEXT),
    queryFn: () => editorApi.questionnaire(versionId, CONTEXT),
    enabled: Number.isInteger(versionId),
    // The editor owns its state after load; a background refetch would clobber
    // half-typed answers.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  if (!Number.isInteger(versionId)) return <Alert>That plan address is not valid.</Alert>
  if (questionnaire.isPending) {
    return (
      <div className="py-12 text-center">
        <Spinner label="Loading plan" />
      </div>
    )
  }
  if (questionnaire.error) {
    const failure = toApiError(questionnaire.error)
    return (
      <Alert>
        {failure.code === 'not_found' ? 'That plan is not in your scope.' : failure.detail}
      </Alert>
    )
  }

  return <Editor key={versionId} questionnaire={questionnaire.data} version={version.data} />
}

function Editor({ questionnaire, version }: { questionnaire: Questionnaire; version?: PlanVersion }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { answers, progress, states, setAnswer, applyProgress, flush, retry, unsaved, failed } =
    useAutosave(questionnaire)
  const [commentsFor, setCommentsFor] = useState<EditorQuestion | null>(null)
  const [commentCounts, setCommentCounts] = useState<Map<number, number>>(
    () =>
      new Map(
        questionnaire.sections.flatMap((s) =>
          s.questions.map((q) => [q.question_id, q.comment_count] as const),
        ),
      ),
  )

  const readOnly = !questionnaire.editable || !questionnaire.can_author
  const allQuestions = useMemo(
    () => questionnaire.sections.flatMap((s) => s.questions),
    [questionnaire],
  )
  const visibility = useMemo(() => computeVisibility(allQuestions, answers), [allQuestions, answers])

  // The questionnaire tabs are every section except BIA, whose questions are
  // answered in the BIA part alongside the dependency and resource lists.
  const tabSections = useMemo(
    () => questionnaire.sections.filter((s) => s.group !== 'bia'),
    [questionnaire],
  )
  const biaQuestions = useMemo(
    () =>
      questionnaire.sections
        .filter((s) => s.group === 'bia')
        .flatMap((s) => s.questions)
        .filter((q) => visibility.get(q.question_id) ?? false),
    [questionnaire, visibility],
  )

  // Active part and tab from the URL. `?section=bia|risks|strategy` predates
  // the parts and still lands on the right one.
  const requestedPart = searchParams.get('part')
  const requestedSection = searchParams.get('section') ?? ''
  const part: PartKey = isPartKey(requestedPart)
    ? requestedPart
    : (LEGACY_SECTION_PARTS[requestedSection] ?? 'questionnaire')
  const activeSection =
    tabSections.find((s) => String(s.section_id) === requestedSection) ?? tabSections[0]

  function selectPart(next: PartKey) {
    const params = new URLSearchParams(searchParams)
    params.set('part', next)
    if (next !== 'questionnaire') params.delete('section')
    setSearchParams(params, { replace: true })
  }
  function selectSection(section: EditorSection) {
    const params = new URLSearchParams(searchParams)
    params.set('part', 'questionnaire')
    params.set('section', String(section.section_id))
    setSearchParams(params, { replace: true })
  }

  // Unsaved-changes guard (4.9): in-app navigation and the browser's own leave.
  // Only a change of *path* counts as leaving. Section and context tabs live in
  // the query string, and switching tabs mid-save must not trip the guard —
  // it did, and the tab click was silently swallowed while a save was in flight.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsaved && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!unsaved) return
    function onBeforeUnload(event: BeforeUnloadEvent) {
      flush()
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved, flush])

  const overall = useMemo(() => {
    const items = [...progress.values()]
    const done = items.filter((p) => p.status === 'Completed').length
    return { done, total: items.length }
  }, [progress])

  // One card per question, wherever it is shown — a questionnaire tab or the
  // BIA part — so autosave, comments and retry behave the same in both.
  function renderQuestion(question: EditorQuestion) {
    return (
      <QuestionCard
        key={question.question_id}
        question={question}
        answer={answers.get(question.question_id) ?? null}
        saveState={states.get(question.question_id)}
        readOnly={readOnly}
        commentCount={commentCounts.get(question.question_id) ?? 0}
        onChange={(answer, immediate) => setAnswer(question.question_id, answer, immediate)}
        onRetry={() => retry(question.question_id)}
        onComments={() => setCommentsFor(question)}
        versionId={questionnaire.plan_version_id}
        onProgress={applyProgress}
      />
    )
  }

  return (
    <>
      <PageHeader
        title={version ? `${version.cost_code} — BCP plan, version ${version.version_number}` : 'BCP plan'}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link
              to={version ? `/cost-codes/${version.cost_code_id}` : '/estates'}
              className="text-brand-700 hover:underline"
            >
              Back to cost code
            </Link>
            <StatusBadge status={questionnaire.status} />
            {readOnly && (
              <Badge>
                {!questionnaire.editable ? 'Read-only: this version is closed' : 'Read-only: you are not an author'}
              </Badge>
            )}
            {version && (
              // What the plan is for, so nobody has to go back to the cost code to check.
              <span className="text-ink-500">
                {[version.process_name, version.estate_name].filter(Boolean).join(' · ')}
                {version.bu_lead_name && <span> · BU lead {version.bu_lead_name}</span>}
              </span>
            )}
          </span>
        }
      >
        {/* Save state first, the primary action last at the right edge. */}
        <SaveIndicator unsaved={unsaved} failed={failed} readOnly={readOnly} />
        {version && (
          <ReviewActions
            version={version}
            onChanged={() => {
              // The version's status changed under us: reload so editability,
              // badges and the header all reflect it.
              window.location.reload()
            }}
          />
        )}
      </PageHeader>

      {/* Parts of the plan: questionnaire, the hub, then BIA / RA / Plan */}
      <nav
        aria-label="Plan parts"
        className="mb-4 flex flex-wrap items-center gap-1 rounded-card border border-ink-200/80 bg-white px-3 py-2 text-sm shadow-card animate-fade-up"
      >
        <ol className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Parts">
          {PARTS.map((p) => {
            const active = p.key === part
            return (
              <li key={p.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`part-${p.key}`}
                  onClick={() => selectPart(p.key)}
                  className={`flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[13px] font-medium transition-colors ${
                    active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {p.step}
                  </span>
                  {p.label}
                </button>
              </li>
            )
          })}
        </ol>
        <span className="ml-auto flex items-center gap-2 text-xs text-ink-500">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-accent-500 transition-[width]"
              style={{ width: `${overall.total ? (100 * overall.done) / overall.total : 0}%` }}
            />
          </span>
          <span className="tabular-nums" title="The questionnaire sections. BIA, RA and Plan have their own status on the Recovery objective part.">
            Questionnaire {overall.done} of {overall.total}
          </span>
        </span>
      </nav>

      {part === 'questionnaire' && (
        <div id="part-questionnaire" role="tabpanel" aria-label="Questionnaire">
          {/* Section tabs with live completion badges (4.9) */}
          <div role="tablist" aria-label="Sections" className="mb-5 flex flex-wrap gap-1 border-b border-ink-200">
            {tabSections.map((section) => {
              const p = progress.get(section.section_id)
              const active = section.section_id === activeSection?.section_id
              return (
                <button
                  key={section.section_id}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`section-${section.section_id}`}
                  onClick={() => selectSection(section)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-900'
                  }`}
                >
                  {section.section_name}
                  <CompletionBadge
                    status={p?.status ?? section.status}
                    percent={p?.percent ?? section.percent}
                    remaining={(p?.required_visible ?? section.required_visible) - (p?.required_answered ?? section.required_answered)}
                  />
                </button>
              )
            })}
          </div>

          {activeSection && (
            <section
              id={`section-${activeSection.section_id}`}
              role="tabpanel"
              aria-label={activeSection.section_name}
              className="space-y-4"
            >
              {activeSection.questions.map((question) =>
                (visibility.get(question.question_id) ?? false) ? renderQuestion(question) : null,
              )}
            </section>
          )}
        </div>
      )}

      {part === 'objectives' && (
        <section id="part-objectives" role="tabpanel" aria-label="Recovery objective">
          <RecoveryObjectivesPart versionId={questionnaire.plan_version_id} onOpen={selectPart} />
        </section>
      )}

      {part === 'bia' && (
        <section id="part-bia" role="tabpanel" aria-label="BIA">
          <BiaPart
            versionId={questionnaire.plan_version_id}
            readOnly={readOnly}
            questions={biaQuestions}
            renderQuestion={renderQuestion}
          />
        </section>
      )}

      {part === 'ra' && (
        <section id="part-ra" role="tabpanel" aria-label="RA">
          <RiskRegister versionId={questionnaire.plan_version_id} readOnly={readOnly} />
        </section>
      )}

      {part === 'plan' && (
        <section id="part-plan" role="tabpanel" aria-label="Plan">
          <PlanPart versionId={questionnaire.plan_version_id} readOnly={readOnly} />
        </section>
      )}

      {commentsFor && (
        <CommentsDrawer
          versionId={questionnaire.plan_version_id}
          question={commentsFor}
          onClose={() => setCommentsFor(null)}
          onPosted={(id) => setCommentCounts((c) => new Map(c).set(id, (c.get(id) ?? 0) + 1))}
        />
      )}

      {blocker.state === 'blocked' && (
        <div
          role="alertdialog"
          aria-label="Unsaved changes"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
            <span>Some answers are still being saved. Leave now and they may be lost.</span>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => blocker.reset()}>
                Stay
              </Button>
              <Button
                onClick={() => {
                  flush()
                  blocker.proceed()
                }}
              >
                Leave anyway
              </Button>
            </span>
          </div>
        </div>
      )}
    </>
  )
}

function CompletionBadge({ status, percent, remaining }: { status: string; percent: number; remaining: number }) {
  // Done is green; anything short of it is amber with what is still required,
  // so the tab that blocks submission is the one that stands out.
  const tone = status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
  const label = status === 'Completed' ? 'Done' : remaining > 0 ? `${remaining} left` : `${percent}%`
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`} title={status === 'Completed' ? 'Every required question answered' : `${remaining} required question${remaining === 1 ? '' : 's'} still to answer`}>
      {label}
    </span>
  )
}

function SaveIndicator({ unsaved, failed, readOnly }: { unsaved: boolean; failed: boolean; readOnly: boolean }) {
  if (readOnly) return null
  if (failed)
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
        Some answers failed to save
      </span>
    )
  if (unsaved)
    return (
      <span className="rounded-full border border-ink-200 bg-white px-3 py-1.5 shadow-card">
        <Spinner label="Saving" />
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
      <IconCheck size={14} /> All changes saved
    </span>
  )
}

/** Answer types whose control is small enough to sit on the question's line. */
const INLINE_TYPES = new Set<EditorQuestion['answer_type']>(['SINGLE_CHOICE', 'NUMBER', 'DATE'])

function QuestionCard({
  question,
  answer,
  saveState,
  readOnly,
  commentCount,
  onChange,
  onRetry,
  onComments,
  versionId,
  onProgress,
}: {
  question: EditorQuestion
  answer: EditorQuestion['answer']
  saveState?: QuestionSaveState
  readOnly: boolean
  commentCount: number
  onChange: (answer: EditorQuestion['answer'], immediate: boolean) => void
  onRetry: () => void
  onComments: () => void
  versionId: number
  onProgress: (sections: SectionProgress[]) => void
}) {
  // Short controls (a Yes/No, a number) sit on the same line as the question;
  // a sub-form or a text box takes the full width beneath it.
  const inline = INLINE_TYPES.has(question.answer_type)
  const answeredBy = saveState?.answeredBy ?? question.answered_by
  const control = <QuestionRenderer question={question} answer={answer} disabled={readOnly} onChange={onChange} />
  const comments = (
    <button
      type="button"
      onClick={onComments}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
        commentCount ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'text-ink-400 hover:bg-ink-100 hover:text-ink-900'
      }`}
      aria-label={`Comments on ${question.question_code}`}
      title="Comments"
    >
      <IconComment size={14} /> {commentCount}
    </button>
  )

  return (
    <article
      aria-labelledby={`q-${question.question_id}-label`}
      className="rounded-card border border-ink-200/80 bg-white px-5 py-3.5 shadow-card transition-shadow focus-within:border-brand-300 focus-within:shadow-raised animate-fade-up"
    >
      <div className={`gap-x-6 gap-y-3 ${inline ? 'md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center' : 'space-y-3'}`}>
        <div className="min-w-0">
          <p id={`q-${question.question_id}-label`} className="text-[15px] font-medium leading-snug text-ink-950">
            {question.question_text}
            {question.required && <span className="ml-1 text-red-500" title="Required">*</span>}
          </p>
          {question.question_description && (
            <p className="mt-0.5 text-xs text-ink-500">{question.question_description}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
            {answeredBy && <span>Answered by {answeredBy}</span>}
            <span aria-live="polite">
              {saveState?.state === 'saving' && 'Saving'}
              {saveState?.state === 'dirty' && 'Unsaved'}
              {saveState?.state === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <IconCheck size={12} /> <span>Saved</span>
                </span>
              )}
              {saveState?.state === 'error' && (
                <span className="text-red-600">
                  {saveState.error}{' '}
                  <button type="button" onClick={onRetry} className="underline">
                    Retry
                  </button>
                </span>
              )}
            </span>
          </p>
        </div>

        {inline ? (
          <div className="flex items-center gap-2 md:justify-end">
            {control}
            {comments}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">{control}</div>
            {comments}
          </div>
        )}
      </div>

      {wantsEvidence(question, answer) && (
        <EvidencePanel versionId={versionId} question={question} readOnly={readOnly} onProgress={onProgress} />
      )}
    </article>
  )
}
