import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { AudiencePage } from '../core/features/distribution/ui/AudiencePage'
export const Route = createFileRoute('/app/audience')({ component: editorLeaf(AudiencePage) })
