import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../core/features/workspace/ui/SettingsPage'
export const Route = createFileRoute('/app/settings')({  component: Page })
function Page() { return <SettingsPage operatorId={Route.useRouteContext().operatorId} /> }
