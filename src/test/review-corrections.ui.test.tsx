// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'
import { contract } from './contract'
import { StepCanvas } from '../core/features/flows/ui/StepCanvas'
import { publicSeedConfig } from '../ext/config'
import { neutralBrand, publicBrandConfig } from '../core/features/brand'
import { draft } from './ui-fixtures'
afterEach(cleanup)
contract('HOME-001', 'default identity and purpose are neutral for an owner installation', () => {
  const config = publicBrandConfig(neutralBrand, publicSeedConfig)
  for (const key of ['publicFlowSlug', 'publicFlowBusinessName', 'publicFlowPurpose']) expect(publicSeedConfig).not.toHaveProperty(key)
  expect(config.publicFlowSlug).not.toMatch(/aurora|cafe|café/i)
  expect(config.publicFlowBusinessName).not.toMatch(/aurora|cafe|café/i)
  expect(config.publicFlowPurpose).not.toMatch(/aurora|cafe|café/i)
})
contract(['FLOW-003', 'BASE-PUBLIC-003'], 'the draft 0–10 canvas visibly labels every score', () => {
  render(<StepCanvas step={{ ...draft.steps[0], questionType: 'rating', questionSettings: { min: 0, max: 10 } }} choices={[]} value={undefined} onChange={() => {}} />)
  expect(screen.getByRole('radiogroup')).toHaveAccessibleName(`${draft.steps[0].prompt} rating`)
  for (let value = 0; value <= 10; value++) expect(screen.getByRole('radio', { name: `${value} out of 10` })).toHaveTextContent(String(value))
})
