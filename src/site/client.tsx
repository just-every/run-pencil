// The run site's one script: it hydrates the hero's live note card (SITE-002), which the static page renders with
// renderToString into its island. Everything else on run-pencil.com works without JavaScript.
import { hydrateRoot } from 'react-dom/client'
import { NoteCard } from '../core/features/landing-hero/NoteCard'

const island = document.querySelector('[data-site-island="note-card"]')
if (island) hydrateRoot(island, <NoteCard />)
