import { z } from 'zod'
import { calculationLimits } from '../../shared/calculations'
import { resourceId } from '../../shared/validation'
import { workflowTag } from '../submissions'
import { searchPhrase } from './search'

export const ledgerFilterSchema = z.object({
  deviceClass: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional(),
  codeId: resourceId.optional(), search: searchPhrase.optional(),
  workflowStatus: resourceId.optional(), workflowAssignee: resourceId.optional(), workflowTag: workflowTag.optional(),
  collectorId: resourceId.optional(), revisionId: resourceId.optional(),
  source: z.enum(['direct', 'embed', 'invitation', 'unknown', 'imported']).optional(),
  participantStatus: z.enum(['eligible', 'opted-out', 'bounced']).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  answerStepId: resourceId.optional(), answerValue: z.string().max(calculationLimits.textCharacters * 6 + 2).optional(),
  offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
})
