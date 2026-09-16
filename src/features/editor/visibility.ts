/**
 * Conditional visibility — the client half of one shared rule.
 *
 * Mirrors `apps/questionnaire/visibility.py` exactly. The server evaluates this
 * for section completion; the client evaluates it for rendering. If the two
 * ever disagree, a question can be hidden on screen yet counted as required by
 * the server (a section that can never reach 100%), or shown but not counted.
 * Change one, change both, and keep the semantics below identical:
 *
 *  - The dependency's answer reduces to a set of codes: {value:"YES"} is {YES};
 *    {value:["A","B"]} is {A,B}; anything else is the empty set.
 *  - EQUALS      -> expected is in the set.
 *  - NOT_EQUALS  -> set is non-empty and expected is not in it.
 *  - IN          -> the set intersects the comma-separated expected values.
 *  - A question whose dependency is hidden is hidden.
 *  - Unknown operators hide the question (fail closed).
 */

import type { AnswerJson, DependencyRule, EditorQuestion } from './types'

export function answerCodes(answer: AnswerJson | null | undefined): Set<string> {
  if (!answer || typeof answer !== 'object') return new Set()
  const value = (answer as { value?: unknown }).value
  if (typeof value === 'string') return value ? new Set([value]) : new Set()
  if (Array.isArray(value)) {
    return new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))
  }
  return new Set()
}

export function ruleSatisfied(rule: DependencyRule, codes: Set<string>): boolean {
  switch (rule.operator) {
    case 'EQUALS':
      return codes.has(rule.value)
    case 'NOT_EQUALS':
      return codes.size > 0 && !codes.has(rule.value)
    case 'IN': {
      const wanted = rule.value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      return wanted.some((w) => codes.has(w))
    }
    default:
      return false
  }
}

/**
 * Visibility per question id. `questions` must be in evaluation order (section,
 * display order) so a dependency is decided before anything that depends on it.
 */
export function computeVisibility(
  questions: readonly EditorQuestion[],
  answers: ReadonlyMap<number, AnswerJson | null>,
): Map<number, boolean> {
  const visible = new Map<number, boolean>()
  for (const question of questions) {
    const rule = question.depends_on
    if (!rule) {
      visible.set(question.question_id, true)
      continue
    }
    if (!visible.get(rule.question_id)) {
      visible.set(question.question_id, false)
      continue
    }
    visible.set(
      question.question_id,
      ruleSatisfied(rule, answerCodes(answers.get(rule.question_id))),
    )
  }
  return visible
}

/** Does an answer count as given? Mirrors `is_answered` on the server. */
export function isAnswered(
  question: EditorQuestion,
  answer: AnswerJson | null | undefined,
): boolean {
  if (!answer || typeof answer !== 'object') return false
  if (question.answer_type === 'SUBFORM') {
    const rows = (answer as { rows?: unknown }).rows
    return Array.isArray(rows) && rows.length > 0
  }
  const value = (answer as { value?: unknown }).value
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

/**
 * Does the current answer call for evidence? Mirrors `Question.wants_evidence`
 * on the server: offered questions always, unless the rule names one answer.
 */
export function wantsEvidence(question: EditorQuestion, answer: AnswerJson | null): boolean {
  const rule = question.evidence
  if (!rule?.offered) return false
  if (!rule.when_value) return true
  return answer !== null && 'value' in answer && answer.value === rule.when_value
}
