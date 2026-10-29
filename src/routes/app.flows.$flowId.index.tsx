import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/app/flows/$flowId/')({ beforeLoad: ({ params }) => { throw redirect({ to: '/app/flows/$flowId/builder', params, replace: true }) } })
