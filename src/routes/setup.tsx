import { createFileRoute } from '@tanstack/react-router'
import { loadSetup } from '../core/app/loaders'
import { SetupPage } from '../core/features/workspace/ui/SetupPage'
export const Route = createFileRoute('/setup')({
  validateSearch: (search: Record<string, unknown>): { invalid?: 'name' | 'timeZone'; name?: string; timeZone?: string } => ({
    invalid: search.invalid === 'name' || search.invalid === 'timeZone' ? search.invalid : undefined,
    name: typeof search.name === 'string' ? search.name.slice(0, 100) : undefined,
    timeZone: typeof search.timeZone === 'string' ? search.timeZone.slice(0, 100) : undefined,
  }),
  loader: () => loadSetup(), component: Page,
})
function Page() {
  const data = Route.useLoaderData(), search = Route.useSearch()
  return <SetupPage {...data} {...(search.invalid ? search : {})} />
}
