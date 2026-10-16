import { createFileRoute } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { BackupPage } from '../core/features/backup/BackupPage'
export const Route = createFileRoute('/app/backup')({component: editorLeaf(BackupPage)})
