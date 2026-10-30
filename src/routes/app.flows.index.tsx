import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/app/flows/')({ beforeLoad: () => { throw redirect({ to: '/app', replace: true }) } })
