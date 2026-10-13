import { createContext, useContext, type ReactNode } from 'react'
import { homeUrl, sourceUrl } from './links'

/**
 * Which homepage the site chrome draws: the installed instance's (`instance`), or the static run site's (`site`,
 * run-pencil.com, written by `rer build --site`), where the primary action opens the Run page and the lockup goes home.
 */
export type SiteVariant = 'instance' | 'site'

const Variant = createContext<SiteVariant>('instance')

export function SiteVariantProvider({ variant, children }: { readonly variant: SiteVariant; readonly children: ReactNode }) {
  return <Variant.Provider value={variant}>{children}</Variant.Provider>
}

export const useSiteVariant = () => useContext(Variant)

/** Where the lockup goes: the product page on an instance, the run site's own `/` there. */
export const useHomeUrl = () => (useSiteVariant() === 'site' ? '/' : homeUrl)

/** The page's primary action: "Get the code" on an instance, "Run Pencil" to the Run page on the run site. */
export function PrimaryAction({ className }: { readonly className: string }) {
  return useSiteVariant() === 'site'
    ? <a className={className} href="/run">Run Pencil</a>
    : <a className={className} href={sourceUrl}>Get the code</a>
}
