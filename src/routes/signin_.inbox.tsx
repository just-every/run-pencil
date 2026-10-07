import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig, requireOperator, requireLocalInbox } from '../core/app/loaders'
import { LocalDevInboxPage } from '../core/features/auth/ui/LocalDevInboxPage'
export const Route = createFileRoute('/signin_/inbox')({ validateSearch: (search: Record<string, unknown>) => ({ email: typeof search.email === 'string' ? search.email : '' }), beforeLoad: () => requireLocalInbox(), loader: () => loadPublicConfig(), component: Page })
function Page() { return <LocalDevInboxPage config={Route.useLoaderData()} email={Route.useSearch().email} /> }
