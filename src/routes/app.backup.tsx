import { createFileRoute } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { BackupPage } from '../core/features/backup/BackupPage'
// The restore test runs only in the browser; the server build drops it, keeping sql.js and its WASM out of the Worker.
const loadRestoreTest = import.meta.env.SSR ? undefined : () => import('../core/features/backup/browser-restore')
export const Route = createFileRoute('/app/backup')({component: editorLeaf(Page)})
function Page() { return <BackupPage loadRestoreTest={loadRestoreTest} /> }
