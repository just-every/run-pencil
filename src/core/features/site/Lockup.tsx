import { Link } from '@tanstack/react-router'
import { PencilMark } from './PencilMark'
import { useHomeUrl } from './variant'

/** The mark and the name "Pencil", linking to the product page. */
export function Lockup({ size }: { readonly size: number }) {
  return (
    <Link className="site-lockup" to={useHomeUrl()}>
      <PencilMark size={size} />
      <span>Pencil</span>
    </Link>
  )
}
