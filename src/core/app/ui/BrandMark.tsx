import { PencilMark } from '../../features/site/PencilMark'

interface BrandMarkProps {
  readonly name: string
  readonly href?: string
}

/** The product lockup: Pencil's drawn mark and its name in DM Sans. */
export function BrandMark({ name, href = '/' }: BrandMarkProps) {
  return (
    <a className="pencil-wordmark focus-ring" href={href}>
      <PencilMark className="pencil-mark" size={30} />
      <span>{name}</span>
    </a>
  )
}
