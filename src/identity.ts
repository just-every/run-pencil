// Pencil's edition identity: what the installed Lobby and the run site say about it (Base's EditionIdentity).
// The installed `/` stays Pencil's own page (`page`): the owner's selected public form. With no form selected the
// Worker serves the Lobby, naming the installation by its saved business name when the owner has set one.
import type { EditionIdentity } from './base/identity'
import { publicSeedConfig } from './ext/config'

export const identity: EditionIdentity = {
  product: 'Pencil',
  deployment: publicSeedConfig.organizationName,
  purpose: '{deployment}’s forms and the answers they hear, in one private workspace.',
  tagline: 'Pencil is an open-source form builder that asks each person only what fits their last answer, so feedback feels like a conversation.',
  signInPath: '/signin',
  runSite: 'https://run-pencil.com',
  installedHome: 'page',
  theme: '/rer-theme.css',
  mark: '/brand/pencil-mark.svg',
  band: '/brand/band.svg',
}
