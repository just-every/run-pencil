import { expect, it } from 'vitest'
import { choiceValue } from './authoring'

it('generates bounded distinct values from labels, including accents, duplicates and non-Latin text', () => {
  expect(choiceValue(' Café / coffee ', [])).toBe('cafe-coffee')
  expect(choiceValue('Café / coffee', ['cafe-coffee', 'cafe-coffee-2'])).toBe('cafe-coffee-3')
  expect(choiceValue('ありがとう', ['choice'])).toBe('choice-2')
  expect(choiceValue('a'.repeat(300), [])).toHaveLength(180)
})
