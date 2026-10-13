export interface PublicSeedConfig {
  embedHostOrigin?: string
  readonly organizationName: string
  readonly productName: string
  readonly publicFlowLogoUrl?: string
  readonly publicFlowSlug: string
  readonly publicFlowBusinessName: string
  readonly publicFlowPurpose: string
  readonly publicFlowTheme: {
    readonly accent: string
    readonly accentText?: string
    readonly accentInk?: string
    readonly background: string
    readonly surface: string
    readonly text: string
  }
  readonly showPoweredByCredit: boolean
}
