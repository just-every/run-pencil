import { createFileRoute } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { PaymentsPage } from '../core/features/payments/ui/PaymentsPage'
export const Route = createFileRoute('/app/payments')({component:editorLeaf(PaymentsPage)})
