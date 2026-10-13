// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { QuestionInput } from '../core/shared/ui/QuestionInput'
import { draft } from './ui-fixtures'
afterEach(cleanup)
const choices = ['a', 'b', 'c'].map((id, position) => ({ id, stepId: 'question', position, value: id, label: id }))
contract('RESP-003', 'all thirteen required question types expose required semantics on supported controls and stay unselected', () => {
  for (const questionType of ['short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating', 'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'] as const) {
    const changed = vi.fn(), step = { ...draft.steps[0], questionType, required: true, questionSettings: questionType === 'consent' ? { statement: 'Agree' } : {} }
    const view = render(<QuestionInput step={step} choices={choices} value={undefined} onChange={changed} />)
    const required = view.container.querySelectorAll('[aria-required=true]')
    expect(required, questionType).toHaveLength(questionType === 'priority' ? 3 : 1)
    for (const element of required) {
      expect(element.getAttribute('role')).not.toBe('group')
      expect(element.getAttribute('role')).not.toBe('button')
    }
    expect(view.container.querySelectorAll('[aria-checked=true],[aria-selected=true],input:checked')).toHaveLength(0)
    expect(changed).not.toHaveBeenCalled()
    view.rerender(<QuestionInput step={{ ...step, required: false }} choices={choices} value={undefined} onChange={changed} />)
    expect(view.container.querySelector('[aria-required=true]'), questionType).toBeNull()
    view.unmount()
  }
})
contract('RESP-003', 'radio arrows select one answer while listbox arrows only move focus and priority selection retains order', () => {
  const changed = vi.fn()
  const view = render(<QuestionInput step={{ ...draft.steps[0], questionType: 'rating' }} choices={[]} value={undefined} onChange={changed} />)
  const first = screen.getByRole('radio', { name: '1 out of 5' })
  first.focus(); fireEvent.keyDown(first, { key: 'End' })
  expect(screen.getByRole('radio', { name: '5 out of 5' })).toHaveFocus()
  expect(changed).toHaveBeenLastCalledWith(5)
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
  expect(first).toHaveFocus(); expect(changed).toHaveBeenLastCalledWith(1)
  view.rerender(<QuestionInput step={{ ...draft.steps[0], questionType: 'single_choice' }} choices={choices} value={undefined} onChange={changed} />)
  changed.mockClear(); screen.getByRole('radio', { name: 'a' }).focus()
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(screen.getByRole('radio', { name: 'b' })).toHaveFocus(); expect(changed).toHaveBeenCalledExactlyOnceWith('b')
  view.rerender(<QuestionInput step={{ ...draft.steps[0], questionType: 'multiple_choice' }} choices={choices} value={['a']} onChange={changed} />)
  changed.mockClear(); screen.getByRole('option', { name: 'a' }).focus()
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(screen.getByRole('option', { name: 'b' })).toHaveFocus(); expect(changed).not.toHaveBeenCalled()
  fireEvent.click(document.activeElement!); expect(changed).toHaveBeenCalledExactlyOnceWith(['a', 'b'])
  view.rerender(<QuestionInput step={{ ...draft.steps[0], questionType: 'priority' }} choices={choices} value={['b']} onChange={changed} />)
  changed.mockClear(); fireEvent.click(screen.getByRole('checkbox', { name: 'a' }))
  expect(changed).toHaveBeenCalledExactlyOnceWith(['b', 'a'])
  fireEvent.click(screen.getByRole('checkbox', { name: '1 b' }))
  expect(changed).toHaveBeenLastCalledWith([])
})
