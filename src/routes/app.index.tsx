import { createFileRoute } from '@tanstack/react-router'
import { loadPrivateDashboard } from '../core/app/loaders'
import { DashboardPage } from '../core/features/dashboard/ui/DashboardPage'
export const Route = createFileRoute('/app/')({ loader: () => loadPrivateDashboard(), component: Page })
function Page() { return <DashboardPage initialData={Route.useLoaderData()} /> }
