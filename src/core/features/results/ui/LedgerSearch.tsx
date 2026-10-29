import { Fragment } from 'react'
import { LiveText } from '../../../shared/ui/LiveText'
import { searchRanges } from '../../../shared/searchFold'

export function LedgerSearch({ value, onSearch }: { value?: string; onSearch: (value?: string) => void }) {
  return <div className="ledger-search" role="search" aria-label="Search responses"><LiveText type="search" label="Search responses" placeholder="Answer text, choice or participant" maxLength={200} value={value ?? ''} onCommit={query => onSearch(query.trim() || undefined)} /></div>
}

export function SearchHighlight({ text, search }: { text: string; search?: string }) {
  if (!search) return <>{text}</>
  const ranges = searchRanges(text, search)
  let end = 0
  return <>{ranges.map(range => {
    const before = text.slice(end, range.start)
    end = range.end
    return <Fragment key={range.start}>{before}<mark>{text.slice(range.start, range.end)}</mark></Fragment>
  })}{text.slice(end)}</>
}
