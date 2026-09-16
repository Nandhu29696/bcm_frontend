import { describe, expect, it } from 'vitest'

import type { EditorQuestion } from '../types'
import { answerCodes, computeVisibility, isAnswered, ruleSatisfied, wantsEvidence } from '../visibility'

/**
 * The client half of the shared visibility rule. These cases mirror
 * `apps/questionnaire/tests/test_visibility_and_validation.py`; if a case is
 * added there it belongs here too.
 */

function question(id: number, extra: Partial<EditorQuestion> = {}): EditorQuestion {
  return {
    question_id: id,
    question_code: `Q-${id}`,
    question_text: `Question ${id}`,
    answer_type: 'SINGLE_CHOICE',
    required: true,
    depends_on: null,
    options: [],
    lookup_type: null,
    subform_fields: [],
    section_id: 1,
    section_name: 'Basic',
    display_order: id,
    ...extra,
  } as EditorQuestion
}

describe('answerCodes', () => {
  it('reduces a scalar value to one code and a list to many', () => {
    expect([...answerCodes({ value: 'YES' })]).toEqual(['YES'])
    expect([...answerCodes({ value: ['A', 'B'] })]).toEqual(['A', 'B'])
  })
  it('treats missing, empty and non-object answers as no codes', () => {
    expect(answerCodes(null).size).toBe(0)
    expect(answerCodes({ value: '' }).size).toBe(0)
    expect(answerCodes({ value: ['', 3 as unknown as string] }).size).toBe(0)
    expect(answerCodes('YES' as unknown as { value: string }).size).toBe(0)
  })
})

describe('ruleSatisfied', () => {
  const codes = new Set(['NO'])
  it('EQUALS needs the exact code', () => {
    expect(ruleSatisfied({ question_id: 1, operator: 'EQUALS', value: 'NO' }, codes)).toBe(true)
    expect(ruleSatisfied({ question_id: 1, operator: 'EQUALS', value: 'YES' }, codes)).toBe(false)
  })
  it('NOT_EQUALS is false for an unanswered dependency', () => {
    expect(ruleSatisfied({ question_id: 1, operator: 'NOT_EQUALS', value: 'YES' }, codes)).toBe(true)
    expect(ruleSatisfied({ question_id: 1, operator: 'NOT_EQUALS', value: 'YES' }, new Set())).toBe(false)
  })
  it('IN intersects a comma list, ignoring spaces', () => {
    expect(ruleSatisfied({ question_id: 1, operator: 'IN', value: 'YES, NO ,MAYBE' }, codes)).toBe(true)
    expect(ruleSatisfied({ question_id: 1, operator: 'IN', value: 'YES,MAYBE' }, codes)).toBe(false)
  })
  it('fails closed on an unknown operator', () => {
    expect(ruleSatisfied({ question_id: 1, operator: 'LIKE' as never, value: 'NO' }, codes)).toBe(false)
  })
})

describe('computeVisibility', () => {
  const q1 = question(1)
  const q2 = question(2, { depends_on: { question_id: 1, operator: 'EQUALS', value: 'YES' } })
  const q3 = question(3, { depends_on: { question_id: 1, operator: 'EQUALS', value: 'NO' } })
  const q4 = question(4, { depends_on: { question_id: 2, operator: 'EQUALS', value: 'YES' } })

  it('shows the branch the answer selects and hides the other', () => {
    const visible = computeVisibility([q1, q2, q3, q4], new Map([[1, { value: 'YES' }]]))
    expect(visible.get(1)).toBe(true)
    expect(visible.get(2)).toBe(true)
    expect(visible.get(3)).toBe(false)
  })
  it('hides everything downstream of an unanswered root', () => {
    const visible = computeVisibility([q1, q2, q3, q4], new Map())
    expect(visible.get(2)).toBe(false)
    expect(visible.get(3)).toBe(false)
    expect(visible.get(4)).toBe(false)
  })
  it('a question whose dependency is hidden is hidden even if its own rule matches', () => {
    // q4 depends on q2 = YES; q2 is hidden because q1 = NO, so q4 stays hidden.
    const visible = computeVisibility([q1, q2, q3, q4], new Map([[1, { value: 'NO' }], [2, { value: 'YES' }]]))
    expect(visible.get(2)).toBe(false)
    expect(visible.get(4)).toBe(false)
    expect(visible.get(3)).toBe(true)
  })
})

describe('isAnswered', () => {
  it('scalars, lists and subform rows', () => {
    expect(isAnswered(question(1), { value: 'YES' })).toBe(true)
    expect(isAnswered(question(1), { value: '' })).toBe(false)
    expect(isAnswered(question(1, { answer_type: 'MULTI_CHOICE' }), { value: [] })).toBe(false)
    expect(isAnswered(question(1, { answer_type: 'MULTI_CHOICE' }), { value: ['A'] })).toBe(true)
    expect(isAnswered(question(1, { answer_type: 'SUBFORM' }), { rows: [] })).toBe(false)
    expect(isAnswered(question(1, { answer_type: 'SUBFORM' }), { rows: [{ subcontractor: 'x' }] })).toBe(true)
    expect(isAnswered(question(1), null)).toBe(false)
  })
})

describe('wantsEvidence', () => {
  const rule = (extra: Partial<EditorQuestion['evidence']>) =>
    question(1, { evidence: { offered: true, when_value: null, required: false, files: [], ...extra } })

  it('is never asked of a question without a rule', () => {
    expect(wantsEvidence(question(1), { value: 'YES' })).toBe(false)
    expect(wantsEvidence(rule({ offered: false }), { value: 'YES' })).toBe(false)
  })
  it('is always asked when the rule names no answer', () => {
    expect(wantsEvidence(rule({}), null)).toBe(true)
    expect(wantsEvidence(rule({}), { value: 8 })).toBe(true)
  })
  it('is asked only for the named answer', () => {
    expect(wantsEvidence(rule({ when_value: 'YES' }), { value: 'YES' })).toBe(true)
    expect(wantsEvidence(rule({ when_value: 'YES' }), { value: 'NO' })).toBe(false)
    expect(wantsEvidence(rule({ when_value: 'YES' }), null)).toBe(false)
  })
})
