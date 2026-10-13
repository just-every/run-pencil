import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { loadSignIn } from '../core/app/loaders'
import { SignInPage } from '../core/features/auth/ui/SignInPage'
export const Route = createFileRoute('/signin')({ validateSearch: (search: Record<string, unknown>): { invalid?: string; notice?: 'access-removed' } => ({ invalid: typeof search.invalid === 'string' ? search.invalid : undefined, notice: search.notice === 'access-removed' ? 'access-removed' : undefined }), loader: () => loadSignIn(), component: editorLeaf(Page) })
function Page() { return <SignInPage {...Route.useLoaderData()} invalid={Route.useSearch().invalid} notice={Route.useSearch().notice} /> }
