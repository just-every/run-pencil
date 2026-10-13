import { Fragment, createElement } from 'react';

// Inline code never breaks inside a word or a flag (--only-shell stays whole), which the stylesheet does with
// white-space: nowrap. A long snippet would then run past a phone's column, so it is marked up to wrap where it is
// harmless: between its words, and inside a long path, address or identifier through a <wbr> right after a separator
// (/ . - _ : ? = &) that follows a letter or digit. A separator that opens the word or a segment stays on its name
// (.wrangler, /state, https://), a run of separators is never split, and neither is a flag inside the word. The pieces
// between breaks are nowrap spans, so the browser adds no break of its own. A flag, or a word shorter than wrapFrom,
// is never split.

const longest = 24;
const wrapFrom = 20;
const breakAfter = /(?<=[\p{L}\p{N}][/._:?=&-])(?![/._:?=&-])(?<!(?:^|[^\p{L}\p{N}-])--?[\p{L}\p{N}-]*)/u;

function word(text: string, key: number) {
  if (text.length < wrapFrom || text.startsWith('-')) return createElement('span', { key }, text);
  const parts = text.split(breakAfter);
  return createElement('span', { key, className: 'docs-wrap' }, parts.map((part, index) => createElement(Fragment, { key: index }, index ? createElement('wbr') : null, createElement('span', null, part))));
}

/** The children of an inline `<code>` and its class, for the text it holds. */
export function inlineCode(text: string) {
  if (text.length <= longest) return { children: text };
  return { className: 'docs-phrase', children: text.split(/(\s+)/).map((part, index) => index % 2 ? part : word(part, index)) };
}
