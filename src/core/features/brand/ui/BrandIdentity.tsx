import type { PublicSeedConfig } from '../../../shared/config'
export function BrandIdentity({ config }: { config: PublicSeedConfig }) {
  return <div className="brand-identity">{config.publicFlowLogoUrl ? <img className="brand-logo" src={config.publicFlowLogoUrl} alt={`${config.publicFlowBusinessName} logo`} /> : null}<p className="eyebrow">{config.publicFlowBusinessName}</p>{config.publicFlowPurpose ? <p className="brand-supporting-line">{config.publicFlowPurpose}</p> : null}</div>
}
