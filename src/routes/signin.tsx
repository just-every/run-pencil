import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { loadSignIn } from '../core/app/loaders'
import { SignInPage } from '../core/features/auth/ui/SignInPage'
import { normalizeEmail } from '../base/operator-auth/policy.mjs'

function emailHint(value: unknown) {
  try { return normalizeEmail(value) } catch { return undefined }
}

export const Route = createFileRoute('/signin')({
  validateSearch: (search: Record<string, unknown>): { invalid?: string; notice?: 'access-removed'; login_hint?: string } => ({
    invalid: typeof search.invalid === 'string' ? search.invalid : undefined,
    notice: search.notice === 'access-removed' ? 'access-removed' : undefined,
    login_hint: emailHint(search.login_hint) ?? emailHint(search.email),
  }),
  loader: () => loadSignIn(),
  component: editorLeaf(Page),
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <SignInPage {...data} emailHint={search.login_hint} invalid={search.invalid} notice={search.notice} />
}
