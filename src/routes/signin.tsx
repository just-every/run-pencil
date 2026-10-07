import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig } from '../core/app/loaders'
import { SignInPage } from '../core/features/auth/ui/SignInPage'
export const Route = createFileRoute('/signin')({ validateSearch: (search: Record<string, unknown>): { invalid?: string; notice?: 'access-removed' } => ({ invalid: typeof search.invalid === 'string' ? search.invalid : undefined, notice: search.notice === 'access-removed' ? 'access-removed' : undefined }), loader: () => loadPublicConfig(), component: Page })
function Page() { return <SignInPage config={Route.useLoaderData()} invalid={Route.useSearch().invalid} notice={Route.useSearch().notice} /> }
