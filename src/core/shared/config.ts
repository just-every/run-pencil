export interface PublicSeedConfig {
  readonly organizationName: string
  readonly productName: string
  readonly publicFlowSlug: string
  readonly publicFlowBusinessName: string
  readonly publicFlowPurpose: string
  readonly publicFlowTheme: {
    readonly accent: string
    readonly background: string
    readonly surface: string
    readonly text: string
  }
  readonly showPoweredByCredit: boolean
}
