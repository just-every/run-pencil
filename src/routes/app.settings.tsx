import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../core/features/workspace/ui/SettingsPage'
export const Route = createFileRoute('/app/settings')({  component: editorLeaf(Page) })
function Page() { return <SettingsPage operatorId={Route.useRouteContext().operatorId} /> }
