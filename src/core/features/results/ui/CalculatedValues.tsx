import type { Calculation, CalculationValue } from '../../../shared/calculations'
import { SearchHighlight } from './LedgerSearch'

type Value = Pick<Calculation, 'id' | 'name' | 'type'> & { value: CalculationValue }
export function CalculatedValues({ values, search }: { values: Value[]; search?: string }) {
  if (!values.length) return null
  return <><p className="muted">Calculated values</p><dl>{values.map(calculation => <div className="ledger-answer" key={calculation.id}>
    <dt><strong>{calculation.name}</strong></dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><SearchHighlight search={search} text={calculation.value === null ? 'Blank · missing input' : String(calculation.value)} /></dd>
  </div>)}</dl></>
}
