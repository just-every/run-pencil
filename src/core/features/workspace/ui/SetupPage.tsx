import { useEffect, useRef, useState } from 'react'
import { AppNote } from '../../../app/ui/AppNote'
import { BrandMark } from '../../../app/ui/BrandMark'
import { NoteIllustration } from '../../../app/ui/NoteIllustration'
import { FirstOwnerForm } from './FirstOwnerForm'
import { HydrationUnit } from '../../../../base/hydration/unit'
import { TimeZoneField } from './TimeZoneField'

function SetupTimeZone({ timeZone, error }: { timeZone?: string; error?: string }) {
  const [value, setValue] = useState(timeZone ?? 'UTC')
  const timeZoneEdited = useRef(false)
  useEffect(() => {
    // Completed workspaces never reach this page; retain any saved non-default zone or entered value.
    if (error || timeZoneEdited.current || (timeZone && timeZone !== 'UTC')) return
    setValue(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [timeZone, error])
  return <TimeZoneField name="timeZone" value={value} disabled={false} error={error} help="Search a city or choose UTC." onChange={next => { timeZoneEdited.current = true; setValue(next) }} />
}

export function SetupPage({ bootstrap, local, name, timeZone, invalid }: { bootstrap: boolean; local: boolean; name?: string; timeZone?: string; invalid?: 'name' | 'timeZone' }) {
  return <main className="pencil-canvas access-shell setup-shell">
    <HydrationUnit><section className="panel access-card" aria-labelledby="setup-title">
      <BrandMark name="Pencil" />
      <h1 className="display" id="setup-title">Set up your workspace</h1>
      {bootstrap ? <FirstOwnerForm local={local} /> : <form action="/setup" method="post">
        <p className="muted">Choose the business name shown on your forms and the time zone used for reporting and sending hours.</p>
        <div className="setup-field">
          <label className="inspector-field">Business name<input className="text-input" name="name" autoComplete="organization" required maxLength={100} defaultValue={name} aria-invalid={invalid === 'name'} aria-describedby={invalid === 'name' ? 'setup-name-error' : undefined} /></label>
          {invalid === 'name' ? <p id="setup-name-error" role="alert" className="status-note" data-tone="error">Enter a business name of at most 100 characters.</p> : null}
          <AppNote className="setup-note" wideOnly>shown on your forms</AppNote>
        </div>
        <SetupTimeZone timeZone={timeZone} error={invalid === 'timeZone' ? 'Choose a valid IANA time zone, such as UTC or America/Denver.' : undefined} />
        <button className="primary-button focus-ring" type="submit">Finish setup</button>
      </form>}
    </section></HydrationUnit>
    <NoteIllustration className="access-art" variant="question" />
  </main>
}
