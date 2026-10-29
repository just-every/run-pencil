import type { Locator } from '@playwright/test'

/** Opens a list's folded Filter control; a no-op when it is already open. */
export async function openFilters(scope: Locator) {
  const toggle = scope.getByRole('button', { name: 'Filter', exact: true })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Clears the applied filters when there are any (the control exists only then). */
export async function clearResponseFilters(scope: Locator) {
  const clear = scope.getByRole('button', { name: 'Clear response filters', exact: true })
  if (await clear.count()) await clear.click()
}
