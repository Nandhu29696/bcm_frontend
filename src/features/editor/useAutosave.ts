import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { toApiError } from '@/api/client'

import { editorApi, editorKeys } from './api'
import type { AnswerJson, Questionnaire, SectionProgress } from './types'

export type SaveState = 'dirty' | 'saving' | 'saved' | 'error'

export interface QuestionSaveState {
  state: SaveState
  error?: string
  answeredBy?: string | null
}

const TYPED_DEBOUNCE_MS = 800

/**
 * Autosave (Phase 4.4).
 *
 * Answers are held locally and applied to the screen immediately (optimistic),
 * then written to the API: at once for a click (a choice, a checkbox), after a
 * pause for typing (text, numbers). Each question saves independently, so a slow
 * write on one never blocks another, and each carries its own state so the
 * indicator can say exactly which answer is unsaved rather than a vague "saving".
 *
 * Section progress comes back with every save and is authoritative; the local
 * answers only drive what is rendered. If a save fails, the local answer is kept
 * (the user's work is not thrown away) and the question is marked so it can be
 * retried.
 */
export function useAutosave(questionnaire: Questionnaire) {
  const versionId = questionnaire.plan_version_id
  const context = questionnaire.context
  const queryClient = useQueryClient()

  // Initialised once from the loaded questionnaire. The page keys the editor on
  // version + context, so a change of either remounts and re-initialises rather
  // than syncing state to props.
  const [answers, setAnswers] = useState<Map<number, AnswerJson | null>>(() => {
    const initial = new Map<number, AnswerJson | null>()
    for (const section of questionnaire.sections) {
      for (const question of section.questions) initial.set(question.question_id, question.answer)
    }
    return initial
  })
  const [progress, setProgress] = useState<Map<number, SectionProgress>>(() => {
    const initial = new Map<number, SectionProgress>()
    for (const section of questionnaire.sections) {
      initial.set(section.section_id, {
        section_id: section.section_id,
        status: section.status,
        percent: section.percent,
        required_visible: section.required_visible,
        required_answered: section.required_answered,
      })
    }
    return initial
  })
  const [states, setStates] = useState<Map<number, QuestionSaveState>>(new Map())
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  // The value to write, read at write time so a debounced save sends the
  // latest keystrokes rather than the ones that scheduled it.
  const latest = useRef(new Map(answers))
  // A write sequence per question. Two saves can be in flight for one question
  // (No, then Yes, before the first reply lands) and replies can arrive out of
  // order; a reply is only applied if it is from the newest write. Without this
  // the stale "No" reply overwrote a newer "Yes" on screen.
  const sequence = useRef(new Map<number, number>())

  const setState = useCallback((questionId: number, next: QuestionSaveState) => {
    setStates((current) => new Map(current).set(questionId, next))
  }, [])

  const applyProgress = useCallback(
    (sections: SectionProgress[]) => {
      setProgress((current) => {
        const next = new Map(current)
        for (const s of sections) next.set(s.section_id, s)
        return next
      })
      // The overview (recovery objectives, BIA status, MBCO headcount) is
      // derived from the answers; a save makes whatever it holds stale.
      void queryClient.invalidateQueries({ queryKey: editorKeys.overview(versionId) })
    },
    [queryClient, versionId],
  )

  const write = useCallback(
    async (questionId: number) => {
      const answer = latest.current.get(questionId)
      const mine = (sequence.current.get(questionId) ?? 0) + 1
      sequence.current.set(questionId, mine)
      const isCurrent = () => sequence.current.get(questionId) === mine

      setState(questionId, { state: 'saving' })
      try {
        if (answer === null || answer === undefined) {
          const result = await editorApi.clearAnswer(versionId, questionId, context)
          if (!isCurrent()) return
          applyProgress(result.sections)
          setState(questionId, { state: 'saved', answeredBy: null })
        } else {
          const result = await editorApi.saveAnswer(versionId, questionId, context, answer)
          if (!isCurrent()) return
          applyProgress(result.sections)
          // The server may have normalised ("  8 " -> 8); adopt its version.
          latest.current.set(questionId, result.answer)
          setAnswers((current) => new Map(current).set(questionId, result.answer))
          setState(questionId, { state: 'saved', answeredBy: result.answered_by })
        }
      } catch (error) {
        if (!isCurrent()) return
        setState(questionId, { state: 'error', error: toApiError(error).detail })
      }
    },
    [versionId, context, applyProgress, setState],
  )

  /**
   * Record a new answer. `immediate` for clicks; otherwise debounced for typing.
   */
  const setAnswer = useCallback(
    (questionId: number, answer: AnswerJson | null, immediate: boolean) => {
      latest.current.set(questionId, answer)
      setAnswers((current) => new Map(current).set(questionId, answer))
      setState(questionId, { state: 'dirty' })

      const pending = timers.current.get(questionId)
      if (pending) clearTimeout(pending)
      if (immediate) {
        timers.current.delete(questionId)
        void write(questionId)
      } else {
        timers.current.set(
          questionId,
          setTimeout(() => {
            timers.current.delete(questionId)
            void write(questionId)
          }, TYPED_DEBOUNCE_MS),
        )
      }
    },
    [write, setState],
  )

  /** Write every debounced answer now — before navigating away. */
  const flush = useCallback(() => {
    for (const [questionId, timer] of timers.current) {
      clearTimeout(timer)
      timers.current.delete(questionId)
      void write(questionId)
    }
  }, [write])

  const retry = useCallback((questionId: number) => void write(questionId), [write])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const unsaved = useMemo(
    () => [...states.values()].some((s) => s.state === 'dirty' || s.state === 'saving'),
    [states],
  )
  const failed = useMemo(
    () => [...states.values()].some((s) => s.state === 'error'),
    [states],
  )

  return { answers, progress, states, setAnswer, applyProgress, flush, retry, unsaved, failed }
}
