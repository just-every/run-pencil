import { z } from 'zod'
import { actionFieldsSchema } from '../actions/shared'
import { resourceId } from '../../shared/validation'

const secret = z.string().trim().min(1).max(4096).regex(/^\S+$/)
export const slackConnectionSchema = z.object({ botToken: secret, signingSecret: secret, apiOrigin: z.string().url().max(2000).default('https://slack.com/api') }).strict()
export const teamsConnectionSchema = z.object({ webhookUrl: z.string().url().max(4096) }).strict()
export type SlackConnection = z.infer<typeof slackConnectionSchema>
export type TeamsConnection = z.infer<typeof teamsConnectionSchema>
export const chatPlatforms = ['slack', 'teams'] as const
export type ChatPlatform = typeof chatPlatforms[number]
export const safeSummaryTypes = new Set(['number', 'rating', 'opinion_scale', 'nps', 'yes_no', 'boolean', 'single_choice', 'multiple_choice'])
const accountId = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/)
export const chatFormSchema = z.object({
  platform: z.enum(chatPlatforms), postResponses: z.boolean().default(true), channel: accountId.optional(),
  answerStepIds: z.array(resourceId).max(20).refine(ids => new Set(ids).size === ids.length),
  operatorId: resourceId, slackUserId: accountId.optional(), teamsUserId: accountId.optional(),
  action: actionFieldsSchema.omit({ ownerOperatorId: true }).optional(),
}).strict().superRefine((value, context) => {
  if (value.platform === 'slack' && (!value.channel || !value.slackUserId)) context.addIssue({code:'custom',message:'Choose the Slack channel and the action owner’s Slack user ID.'})
  if (value.platform === 'teams' && !value.teamsUserId) context.addIssue({code:'custom',message:'Enter the action owner’s Microsoft user ID for Teams mentions.'})
})
export type ChatFormSettings = z.infer<typeof chatFormSchema>
export type ChatFormLink = ChatFormSettings & { id: string; armed: boolean }
