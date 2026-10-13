import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/pencil')({
  beforeLoad: () => { throw redirect({ to: '/', statusCode: 301 }) },
})
