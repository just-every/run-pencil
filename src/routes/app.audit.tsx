import { createFileRoute } from '@tanstack/react-router'
import { AuditPage } from '../core/features/audit/ui/AuditPage'
export const Route = createFileRoute('/app/audit')({ component: AuditPage })
