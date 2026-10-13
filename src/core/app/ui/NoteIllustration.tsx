import { NoteArt } from '../../features/landing-hero/NoteArt'
import { sample } from '../../features/landing/sample'
import snapped from './art/note-card-snapped.webp'

type Variant = 'question' | 'blank' | 'snapped'

/**
 * The landing's cream note card and yellow pencil, for screens that introduce themselves or have nothing to show yet.
 * 'question' pencils the hero's question onto the card, 'blank' leaves it empty and 'snapped' is the error screen's
 * card with the pencil's tip broken off. Decorative: every word on the page says what it needs to without it.
 */
export function NoteIllustration({ variant, className }: { readonly variant: Variant; readonly className?: string }) {
  const classes = ['app-art', `app-art--${variant}`, className].filter(Boolean).join(' ')
  if (variant === 'snapped') return <img className={classes} src={snapped} width={650} height={340} alt="" />
  return <div className={classes} aria-hidden="true">
    <NoteArt />
    {variant === 'question' ? <div className="app-art__plane">
      <p className="app-art__question">{sample.question}</p>
      <p className="app-art__answers"><span className="app-art__chosen">{sample.great.answer}</span><span>{sample.good.answer}</span><span>{sample.better.answer}</span></p>
      <p className="app-art__followup">{sample.great.next}</p>
    </div> : null}
  </div>
}
