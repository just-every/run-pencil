import { AppNote } from '../../../app/ui/AppNote'
import { BrandMark } from '../../../app/ui/BrandMark'
import { NoteIllustration } from '../../../app/ui/NoteIllustration'
import { FirstOwnerForm } from './FirstOwnerForm'
import { HydrationUnit } from '../../../../base/hydration/unit'

export function SetupPage({ bootstrap, local, name, timeZone }: { bootstrap: boolean; local: boolean; name?: string; timeZone?: string }) {
  return <main className="pencil-canvas access-shell setup-shell">
    <HydrationUnit><section className="panel access-card" aria-labelledby="setup-title">
      <BrandMark name="Pencil" />
      <h1 className="display" id="setup-title">Set up your workspace</h1>
      {bootstrap ? <FirstOwnerForm local={local} /> : <form action="/setup" method="post">
        <p className="muted">Choose the business name shown on your forms and the time zone used for reporting and sending hours.</p>
        <div className="setup-field">
          <label className="inspector-field">Business name<input className="text-input" name="name" autoComplete="organization" required maxLength={100} defaultValue={name} /></label>
          <AppNote className="setup-note" wideOnly>shown on your forms</AppNote>
        </div>
        <label className="inspector-field">Time zone<input className="text-input" name="timeZone" required maxLength={100} defaultValue={timeZone} placeholder="Australia/Brisbane" /></label>
        <button className="primary-button focus-ring" type="submit">Finish setup</button>
      </form>}
    </section></HydrationUnit>
    <NoteIllustration className="access-art" variant="question" />
  </main>
}
