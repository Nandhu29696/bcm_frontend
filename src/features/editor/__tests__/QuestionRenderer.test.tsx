import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { QuestionRenderer } from '../QuestionRenderer'
import type { AnswerJson, EditorQuestion } from '../types'

/**
 * MULTI_CHOICE and DATE (Phase 4.9): rendered from the same switch as the
 * other answer types but, unlike them, never exercised by a seeded question
 * in the browser suite (docs/PENDING.md P2 #20). Covered here instead.
 */
function question(overrides: Partial<EditorQuestion>): EditorQuestion {
  return {
    question_id: 1,
    question_number: 1,
    question_code: 'Q1',
    question_text: 'A question',
    question_description: '',
    answer_type: 'TEXT',
    required: false,
    visible: true,
    depends_on: null,
    options: [],
    detail_options: [],
    subform_schema: [],
    answer: null,
    answered_by: null,
    answered_at: null,
    comment_count: 0,
    evidence: { offered: false, when_value: null, required: false, files: [] },
    ...overrides,
  }
}

describe('QuestionRenderer - MULTI_CHOICE', () => {
  const q = question({
    answer_type: 'MULTI_CHOICE',
    question_text: 'Which regions are affected?',
    options: [
      { code: 'APAC', label: 'APAC' },
      { code: 'EMEA', label: 'EMEA' },
    ],
  })

  it('renders a checkbox per option, none checked with no answer', () => {
    render(<QuestionRenderer question={q} answer={null} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'APAC' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'EMEA' })).not.toBeChecked()
  })

  it('checks the boxes matching the stored value array', () => {
    render(
      <QuestionRenderer question={q} answer={{ value: ['EMEA'] }} disabled={false} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('checkbox', { name: 'APAC' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'EMEA' })).toBeChecked()
  })

  it('adds a code to the array on check, without disturbing the others', () => {
    const onChange = vi.fn()
    render(
      <QuestionRenderer question={q} answer={{ value: ['EMEA'] }} disabled={false} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'APAC' }))
    expect(onChange).toHaveBeenCalledWith({ value: ['EMEA', 'APAC'] }, true)
  })

  it('removes a code on uncheck, and sends null once the array is empty', () => {
    const onChange = vi.fn()
    render(
      <QuestionRenderer question={q} answer={{ value: ['EMEA'] }} disabled={false} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'EMEA' }))
    expect(onChange).toHaveBeenCalledWith(null, true)
  })

  it('disables every checkbox when the question is disabled', () => {
    render(<QuestionRenderer question={q} answer={null} disabled={true} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'APAC' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'EMEA' })).toBeDisabled()
  })
})

describe('QuestionRenderer - DATE', () => {
  const q = question({ answer_type: 'DATE', question_text: 'Approval date' })

  it('renders a date input, empty with no answer', () => {
    render(<QuestionRenderer question={q} answer={null} disabled={false} onChange={vi.fn()} />)
    const input = screen.getByLabelText('Approval date') as HTMLInputElement
    expect(input.type).toBe('date')
    expect(input.value).toBe('')
  })

  it('shows the stored value', () => {
    const answer: AnswerJson = { value: '2026-09-23' }
    render(<QuestionRenderer question={q} answer={answer} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Approval date')).toHaveValue('2026-09-23')
  })

  it('reports the new value immediately on change', () => {
    const onChange = vi.fn()
    render(<QuestionRenderer question={q} answer={null} disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Approval date'), { target: { value: '2026-01-15' } })
    expect(onChange).toHaveBeenLastCalledWith({ value: '2026-01-15' }, true)
  })

  it('clears to null when the field is emptied', () => {
    const onChange = vi.fn()
    render(
      <QuestionRenderer question={q} answer={{ value: '2026-09-23' }} disabled={false} onChange={onChange} />,
    )
    fireEvent.change(screen.getByLabelText('Approval date'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null, true)
  })
})
