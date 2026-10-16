import { useState } from 'react'

export function CopyTask({ text, label = 'Copy task JSON' }: { text: string; label?: string }) {
  const [notice, setNotice] = useState('')
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setNotice('Copied.') }
    catch { setNotice('Copy was unavailable. Select and copy the text above.') }
  }
  return <><button className="quiet-button focus-ring" type="button" onClick={() => void copy()}>{label}</button>{notice ? <span role="status"> {notice}</span> : null}</>
}
