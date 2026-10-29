import { useState } from 'react'
import type { BackupSummary } from './model'
import type { BrowserRestoreResult, testBrowserRestore } from './browser-restore'
import { FileInput } from '../../shared/ui/FileInput'

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
    <header className="page-heading"><p className="eyebrow">Owner tools</p><h1 className="display" id="backup-title">Backup and restore</h1><p>Keep a private copy of your forms, answers and workspace history.</p></header>
    {notice ? <p className="status-note" role={notice.error ? 'alert' : 'status'} data-tone={notice.error ? 'error':'success'}>{notice.text}</p> : null}
    <div className="settings-grid">
      <section className="panel settings-card" aria-labelledby="backup-download"><h2 className="display" id="backup-download">1. Download your backup</h2>
        <p>Pencil reads your complete product data in one consistent transaction. Your forms can stay open while it works.</p>
        <p>This file includes personal data and quarantined answers. Store it privately. Passwords, sign-in links, active sessions, captured mail and private integration settings are excluded. Everyone signs in again after restoration.</p>
        <button className="primary-button focus-ring" disabled={!!busy} type="button" onClick={() => void download()}>{busy === 'download' ? 'Creating backup…' : 'Download backup'}</button>
        <p className="muted settings-help">Browser backups have an 8 MiB file limit and a conservative workspace size limit. Larger workspaces need the <a href="/docs/backup#large-workspace-export">large-workspace export</a>.</p>
      </section>
      <form className="panel settings-card" onSubmit={event => void check(event)} aria-labelledby="backup-check"><h2 className="display" id="backup-check">2. Check the saved file</h2>
        <label className="inspector-field">Pencil backup file<FileInput disabled={!!busy} accept=".rer,application/json" required onChange={event => {setFile(event.target.files?.[0]);setChecked(undefined);setRestored(undefined)}} /></label>
        <p>This checks the file’s checksum, version, data inventory, privacy rules and linked records. It does not change your workspace or send email.</p>
        <button className="secondary-button focus-ring" disabled={!file || !!busy} type="submit">{busy === 'check' ? 'Checking…' : 'Check backup'}</button>
        {checked ? <div className="status-note" role="status" data-tone="success"><strong>Backup contents checked.</strong><p>{checked.records.toLocaleString()} records across {checked.tables} tables. The saved file’s checksum and linked records pass.</p><p>Checksum: <code style={{overflowWrap:'anywhere'}}>{checked.sha256}</code></p><p>Contents passed. Use Test restoration below to restore the saved file into a new test database.</p></div> : null}
      </form>
      <section className="panel settings-card" aria-labelledby="backup-restore"><h2 className="display" id="backup-restore">3. Test restoration</h2>
        <p>Restore the selected backup into a new, empty database in this browser. Pencil checks database constraints and linked records, then exports it again and compares every archived value through its checksum.</p>
        <p>Your selected file stays in this browser. The test database is discarded afterwards. Your running workspace is never changed, and no mail or external tasks are sent.</p>
        <label className="inspector-field">Newer backup for erasure protection (optional)<FileInput disabled={!!busy} accept=".rer,application/json" onChange={event => {setLaterFile(event.target.files?.[0]);setRestored(undefined)}} /></label>
        <p className="muted settings-help">If people or answers were erased after this backup, select a newer backup from the same installation. Pencil refuses the older file when that newer copy records an erasure. Without it, the test cannot know about later erasures.</p>
        {!file ? <p>Choose your saved backup file in step 2 first.</p> : <p>Selected backup: <strong>{file.name}</strong></p>}
        <button className="primary-button focus-ring" disabled={!file || !!busy} type="button" onClick={() => void restore()}>{busy === 'restore' ? 'Testing restoration…' : 'Test restoration'}</button>
        {restored ? <div className="status-note" role="status" data-tone="success"><strong>Restoration passed.</strong><p>{restored.records.toLocaleString()} records restored into a new test database. Integrity and linked-record checks passed. Re-exported contents exactly match your backup.</p><p>Matching checksum: <code style={{overflowWrap:'anywhere'}}>{restored.reexportSha256}</code></p><p>The test database has been discarded. Your running deployment has not changed.</p></div> : null}
        <details><summary>Advanced: test restoration on your computer</summary>
          <p>For larger archives or an independent test, use the matching Pencil source with Node.js 22.20 or later and installed dependencies. Save the file as <code>exports/pencil-backup.rer</code> and run from that checkout:</p>
          <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><code>{restoreCommand}</code></pre>
          <button className="secondary-button focus-ring" type="button" onClick={() => {void navigator.clipboard.writeText(restoreCommand).then(() => setNotice({error:false,text:'Restore-test command copied.'})).catch(() => setNotice({error:true,text:'Copy the displayed command manually; clipboard access was refused.'}))}}>Copy restore-test command</button>
          <p>The command creates a new local database and requires matching re-exported contents. An existing output file is refused.</p>
        </details>
        <p>To replace a live hosted installation, your hosting maintainer must provision and attach its replacement. This test verifies the archive without changing that installation. Keep it until the replacement is checked.</p>
        <p><a href="/docs/backup#restore-into-a-new-database">Read the restore instructions</a>.</p>
      </section>
    </div>
  </section>
}
