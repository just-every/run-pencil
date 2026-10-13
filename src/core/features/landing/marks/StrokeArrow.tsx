/** A small hand-drawn arrow for drawn buttons and rows, pointing right unless `back` is set. Decorative. */
export function StrokeArrow({ back = false }: { readonly back?: boolean }) {
  return (
    <svg className={back ? 'stroke-arrow stroke-arrow--back' : 'stroke-arrow'} viewBox="0 0 24 14" aria-hidden="true" focusable="false">
      <path d="M 2 7.4 C 8 6.6, 15 7.2, 21 7" />
      <path d="M 15.5 2.2 L 21.4 7 L 15.8 11.8" />
    </svg>
  )
}
