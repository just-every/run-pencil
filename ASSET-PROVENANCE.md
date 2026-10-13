# Distributed asset provenance

The product interface is authored React/CSS/SVG source in this repository.
The brand mark and UI icons come
from the pinned `lucide-react` dependency (ISC with retained Feather MIT portions); font assets come from pinned
`@fontsource/dm-sans`, `@fontsource/dm-serif-display` and `@fontsource/caveat` packages (SIL Open Font
License 1.1; Caveat is the product site's pencil handwriting face), served locally by the built application. Their upstream license files
remain in installed packages and must accompany any repackaged font/icon assets.
The product site's pencil mark is authored SVG path data in `src/core/features/site/brand/mark.ts`; its
committed SVG and PNG icons are rendered from that data by `scripts/generate-site-icons.mjs`.
The product page's hero illustration (`src/core/features/landing-hero/art/note-card-{720,1200}.{webp,avif}`: a
blank note card, its shadow and a yellow pencil) is generated art made for Pencil: a hero image chosen during design
exploration with 12ui on 2026-10-10 (OpenAI image generation), and 12ui's conversion of that image delivered the
card-and-pencil layer as `conversation.png` (1510x1066, sha256
`bf4d9f5b505dae23e651cc827e96d0b34be609f93a72dce1bfd9593d1584fed7`). The shipped files are made from it by
`src/core/features/landing-hero/art/clean-note-card.py`, which erases the pencilled oval baked into the card, matches
the paper to the site's paper with a transparent surround, and encodes the two widths:
`PYTHONDONTWRITEBYTECODE=1 python3 -I src/core/features/landing-hero/art/clean-note-card.py conversation.png src/core/features/landing-hero/art`
(Pillow 12.3 with WebP and AVIF, NumPy). Every word on the card is HTML, not part of the image.

`src/core/features/site/brand/social-card.png` (1200x630, the `og:image` of `/pencil` and `/docs`) is rendered from
this repository's own source by `scripts/generate-social-card.mjs`: the site and hero stylesheets with the bundled
DM Serif Display, DM Sans and Caveat faces, the site mark, the hero headline and the live note card (`NoteCard.tsx`
with the note-card art above) server-rendered by Vite and screenshotted by the pinned Playwright's Chromium
(`@playwright/test` 1.62.1, Chromium Headless Shell 151.0.7922.34). Running `node scripts/generate-social-card.mjs`
reproduces it byte for byte on that toolchain (sha256
`6baeae006cdcfc4f47017a0e7b01c0cabd76ec36cb9754eceaeecb95f09180a8`); regenerate it whenever the hero, its art or the
site's look changes. It contains no third-party artwork or mark.

`src/core/features/landing/art/pencil-lying.webp` (the close of `/pencil`) is the lying pencil from an image the 12ui
design tool generated for this product on 2026-10-10 (hero exploration "fork", option B; text-free, no logo or third-party
mark). It was cropped to 810 x 360, the paper was divided out and turned into transparency, and it was encoded with
`cwebp -q 80 -alpha_q 85`. `src/core/app/ui/art/note-card-snapped.webp` (the app's load-error screens) is the blank
note card and the yellow pencil with its tip snapped off, from the error-screen design 12ui drew for this product on
2026-10-11 (style pass, "error-desktop" option A; the art only, no text, logo or third-party mark). It was cropped to
650 x 340, the paper was divided out and turned into transparency, and it was encoded as WebP at quality 90. The homepage's product plates are not images: they are authored SVG strokes and HTML text.
No other external image, competitor screenshot, generated mockup or third-party artwork is used by the runtime. Package
versions and integrity hashes are in `pnpm-lock.yaml`.

The documentation site (`/docs`) is authored source in `src/core/features/docs`, ported from the docs
feature of the sibling product Slate (same copyright holder, Run Edit Run, MIT) with Pencil's own layout,
stylesheets, pencil-stroke drawings (inline SVG data URIs) and tests. It uses the same DM Sans and DM Serif
Display font packages and no image, font or script from any other origin. Its Markdown renderer
(`react-markdown` 6.0.3 and `remark-gfm` 1.0.0, MIT, and `highlight.js` 10.7.3, BSD-3-Clause) runs only at
build time as development dependencies.

Research captures, generated design experiments and copied design HTML have been removed from the public release tree. They remain only in private development history. The public export begins with one reviewed commit and carries authored product source, dependency license notices and genuine test fixtures. Generated verification outputs are kept outside the distributed source.
