import landingCss from './styles/landing.css?url'

/**
 * What the sections below the hero add to their page's head: their stylesheet (pass to siteHead). It is linked from
 * the head, not rendered in the body: a body stylesheet with a React precedence makes the server stream the whole page
 * as a hidden boundary that only a script reveals, which would leave the page blank without JavaScript.
 */
export const landingHead = {
  stylesheets: [landingCss],
}
