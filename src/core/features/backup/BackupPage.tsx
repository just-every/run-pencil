import { useState } from 'react'
import type { BackupSummary } from './model'
import type { BrowserRestoreResult, testBrowserRestore } from './browser-restore'

const restoreCommand = 'node scripts/deployment-data-restore-test.mjs --input exports/pencil-backup.rer --output exports/restore-test.sqlite'
async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as {message?:string}
  throw new Error(body.message ?? `Backup could not finish (${response.status}). Keep your deployment and try again.`)
}
/** The route supplies the browser-only restore test, so the Worker build never carries sql.js or its WASM. */
export function BackupPage({loadRestoreTest}: {loadRestoreTest?: () => Promise<{testBrowserRestore: typeof testBrowserRestore}>}) {
  const [busy,setBusy] = useState<'download'|'check'|'restore'>()
  const [notice,setNotice] = useState<{error:boolean; text:string}>()
  const [checked,setChecked] = useState<BackupSummary>()
  const [file,setFile] = useState<File>()
  const [laterFile,setLaterFile] = useState<File>()
  const [restored,setRestored] = useState<BrowserRestoreResult>()
  const download = async () => {
    setBusy('download'); setNotice(undefined)
    try {
      const response = await fetch('/api/app/backup/export', {method:'POST', credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'})
      if (!response.ok) await responseError(response)
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'pencil-backup.rer'; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setNotice({error:false,text:'Backup downloaded. Choose that file below to check the saved copy.'})
    } catch (error) { setNotice({error:true,text:error instanceof Error ? error.message : 'Backup could not finish.'}) }
    finally { setBusy(undefined) }
  }
  const check = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) return
    setBusy('check'); setChecked(undefined); setNotice(undefined)
    try {
      if (file.size > 8*1024*1024) throw new Error('This file exceeds the 8 MiB browser limit. Use the restore-test command below.')
      const response = await fetch('/api/app/backup/check', {method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:file})
      if (!response.ok) await responseError(response)
      setChecked(await response.json() as BackupSummary)
    } catch (error) { setNotice({error:true,text:error instanceof Error ? error.message : 'The backup could not be checked.'}) }
    finally { setBusy(undefined) }
  }
  const restore = async () => {
    if (!file || !loadRestoreTest) return
    setBusy('restore'); setRestored(undefined); setNotice(undefined)
    try {
      const { testBrowserRestore } = await loadRestoreTest()
      setRestored(await testBrowserRestore(file,laterFile))
    } catch (error) { setNotice({error:true,text:error instanceof Error ? error.message : 'Restoration did not pass. Keep the original deployment and archive.'}) }
    finally { setBusy(undefined) }
  }
  return <section className="workspace-settings" aria-labelledby="backup-title">
    <header className="page-heading"><p className="eyebrow">Owner tools</p><h1 className="display" id="backup-title">Backup and restore</h1></header>
    {notice ? <p className="status-note" role={notice.error ? 'alert' : 'status'} data-tone={notice.error ? 'error':'success'}>{notice.text}</p> : null}
    <div className="settings-grid">
      <section className="panel settings-card" aria-labelledby="backup-download"><h2 className="display" id="backup-download">1. Download your backup</h2>
        <p>The file holds personal data. Store it privately.</p>
        <button className="primary-button focus-ring" disabled={!!busy} type="button" onClick={() => void download()}>{busy === 'download' ? 'Creating backup…' : 'Download backup'}</button>
        <details><summary className="focus-ring">What it holds and its size limit</summary><p className="muted settings-help">Forms, answers (quarantined ones too) and workspace history. Passwords, sign-in links, sessions and private integration settings stay out, so everyone signs in again after a restore. Browser backups stop at 8 MiB; larger workspaces need the <a href="/docs/backup#large-workspace-export">large-workspace export</a>.</p></details>
      </section>
      <form className="panel settings-card" onSubmit={event => void check(event)} aria-labelledby="backup-check"><h2 className="display" id="backup-check">2. Check the saved file</h2>
        <label className="inspector-field">Pencil backup file<input disabled={!!busy} type="file" accept=".rer,application/json" required onChange={event => {setFile(event.target.files?.[0]);setChecked(undefined);setRestored(undefined)}} /></label>
        <button className="secondary-button focus-ring" disabled={!file || !!busy} type="submit">{busy === 'check' ? 'Checking…' : 'Check backup'}</button>
        {checked ? <div className="status-note" role="status" data-tone="success"><strong>Backup contents checked.</strong><p>{checked.records.toLocaleString()} records across {checked.tables} tables. Checksum: <code style={{overflowWrap:'anywhere'}}>{checked.sha256}</code></p></div> : null}
      </form>
      <section className="panel settings-card" aria-labelledby="backup-restore"><h2 className="display" id="backup-restore">3. Test restoration</h2>
        <p>Restores the file into a throwaway database in this browser. Your workspace is never changed.</p>
        <label className="inspector-field">Newer backup, if anyone was erased since (optional)<input disabled={!!busy} type="file" accept=".rer,application/json" onChange={event => {setLaterFile(event.target.files?.[0]);setRestored(undefined)}} /></label>
        {!file ? <p>Choose your saved backup file in step 2 first.</p> : <p>Selected backup: <strong>{file.name}</strong></p>}
        <button className="primary-button focus-ring" disabled={!file || !!busy} type="button" onClick={() => void restore()}>{busy === 'restore' ? 'Testing restoration…' : 'Test restoration'}</button>
        {restored ? <div className="status-note" role="status" data-tone="success"><strong>Restoration passed.</strong><p>{restored.records.toLocaleString()} records restored and re-exported to the same checksum: <code style={{overflowWrap:'anywhere'}}>{restored.reexportSha256}</code></p></div> : null}
        <details><summary>Advanced: test restoration on your computer</summary>
          <p>For larger archives or an independent test, use the matching Pencil source with Node.js 22.20 or later and installed dependencies. Save the file as <code>exports/pencil-backup.rer</code> and run from that checkout:</p>
          <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><code>{restoreCommand}</code></pre>
          <button className="secondary-button focus-ring" type="button" onClick={() => {void navigator.clipboard.writeText(restoreCommand).then(() => setNotice({error:false,text:'Restore-test command copied.'})).catch(() => setNotice({error:true,text:'Copy the displayed command manually; clipboard access was refused.'}))}}>Copy restore-test command</button>
        </details>
        <p><a href="/docs/backup#restore-into-a-new-database">Read the restore instructions</a>.</p>
      </section>
    </div>
  </section>
}
