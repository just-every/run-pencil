import { PanelsTopLeft } from 'lucide-react'

interface BrandMarkProps {
  readonly name: string
  readonly href?: string
}

export function BrandMark({ name, href = '/' }: BrandMarkProps) {
  return (
    <a className="pencil-wordmark focus-ring" href={href}>
      <PanelsTopLeft aria-hidden="true" className="pencil-mark" size={25} strokeWidth={2.2} />
      <span>{name}</span>
    </a>
  )
}
