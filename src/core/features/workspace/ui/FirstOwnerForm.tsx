import { ArrowRight } from 'lucide-react'

export function FirstOwnerForm({ local }: { local: boolean }) {
  return <form action="/auth/bootstrap" method="post">
    <input type="hidden" name="returnTo" value="/setup" />
    <p className="muted">Create the first owner using the email configured during setup.</p>
    <p className="muted">{local ? <>Find <code>SETUP_TOKEN</code> in your local <code>.dev.vars</code> file.</> : <>Use the <code>SETUP_TOKEN</code> supplied by the person who deployed Pencil.</>}</p>
    <label className="inspector-field">Your name<input className="text-input" name="displayName" autoComplete="name" required maxLength={100} /></label>
    <label className="inspector-field">Setup token<input className="text-input" name="token" type="password" autoComplete="off" required maxLength={1024} /></label>
    <button className="primary-button focus-ring" type="submit">Set up the first owner <ArrowRight aria-hidden="true" size={17} /></button>
  </form>
}
