import { TeamTemplates } from '../features/flows'
import { ResumeService, ResumeRepository } from '../features/resuming'
import { CollectorRepository, CollectorService } from '../features/collectors'
import { DigestDispatcher } from '../features/notifications/digest-dispatcher'
import { AnalysisAttention } from '../features/analysis/attention'
import { DraftRewrites } from '../features/analysis/rewrites'
import { eraseResponseAndImportCustody } from '../features/importing/erasure'
import { readNotificationBrand } from '../features/notifications/brand'
import type { MailSender } from '../../base/operator-auth/index.mjs'
import { notificationConfigurationFailure } from '../features/notifications/failure'
import { NotificationDispatcher } from '../features/notifications/dispatcher'
import { NotificationRepository } from '../features/notifications/repository'
import { notificationSenderError } from '../features/notifications/compose'
import { BrandRepository } from '../features/brand/repository'
import { BrandService } from '../features/brand/service'
import { DistributionDispatcher } from '../features/distribution/dispatcher'
import { baseMailSender } from '../platform/mail/base.server'
import { mountServerExtensions } from './mountExtensions.server'
import { DistributionSegments } from '../features/distribution/segments'
import { ContactImport } from '../features/distribution/contact-import'
import { DistributionContacts } from '../features/distribution/contacts'
import { InvitationLaunches } from '../features/distribution/launches'
import { MailDeliveries } from '../features/distribution/deliveries'
import { ReportingRepository } from '../features/reporting/repository'
import { ReportingService } from '../features/reporting/service'
import { FlowRepository } from '../features/flows/repository'
import { FlowService } from '../features/flows/service'
import { AuthRepository } from '../features/auth/repository'
import { AuthService } from '../features/auth/service'
import { AuditRepository, AuditService } from '../features/audit'
import { ResponseRepository } from '../features/responses/repository'
import { ResponseService } from '../features/responses/service'
import { WorkspaceRepository } from '../features/workspace/repository'
import { WorkspaceService } from '../features/workspace/service'
import type { PencilPlatform } from '../platform/runtime'
import { ActionService, TaskDeliveries } from '../features/actions'
import { AnalysisService } from '../features/analysis'
import { IntegrationConnections } from '../platform/config/connections'

export function createPencilServices(platform: PencilPlatform) {
  const { database } = platform
  const extensions = mountServerExtensions()
  const workspaceRepository = new WorkspaceRepository(database)
  const flowRepository = new FlowRepository(database, platform.databaseBinding)
  const responseRepository = new ResponseRepository(database, platform.databaseBinding, eraseResponseAndImportCustody)
  const authRepository = new AuthRepository(database, platform.databaseBatch)
  const audit = new AuditService(new AuditRepository(database))

  const collectors = new CollectorService(new CollectorRepository(platform.databaseBinding))
  const flows = new FlowService(flowRepository, responseRepository, extensions.flowPolicies)
  const brand = new BrandService(new BrandRepository(database), slug => flows.getPublicFlow(slug))
  const deliveries = new MailDeliveries(platform.databaseBinding)
  let sender: MailSender
  let senderFailure: string | null = null
  try { sender = baseMailSender(platform.configuration.mail, platform.databaseBinding) }
  catch (error) {
    senderFailure = notificationConfigurationFailure(error)
    if (!senderFailure) throw error
    // Preserve the genuine failure for mail callers while collection remains available.
    sender = { send: async () => { throw error } }
  }
  const dispatcher = new DistributionDispatcher(platform.databaseBinding, deliveries, sender, platform.configuration.appOrigin, platform.configuration.mail.kind === 'local-development' ? 'no-reply@pencil.test' : platform.configuration.mail.from)
  const from = platform.configuration.mail.kind === 'local-development' ? 'no-reply@pencil.test' : platform.configuration.mail.from
  const mailProvider = platform.configuration.mail.kind
  const responses = new ResponseService(flowRepository, responseRepository, collectors)
  return {
    resuming: new ResumeService(new ResumeRepository(platform.databaseBinding), responseRepository, flowRepository, collectors, responses, sender, {origin:platform.configuration.appOrigin,from,secret:platform.configuration.sessionSecret,local:platform.configuration.mail.kind==='local-development'}),
    templates: new TeamTemplates(platform.databaseBinding, flowRepository),
    collectors,
    connections: new IntegrationConnections(platform),
    notifications: {
      digest: new DigestDispatcher(platform.databaseBinding,sender,platform.configuration.appOrigin,from,undefined,senderFailure,mailProvider),
      preferences: new NotificationRepository(platform.databaseBinding, notificationSenderError(from,mailProvider) ?? senderFailure, mailProvider === 'local-development', platform.configuration.isHostedDemo),
      dispatcher: new NotificationDispatcher(platform.databaseBinding,sender,platform.configuration.appOrigin,from,workspaceId => readNotificationBrand(platform.databaseBinding,workspaceId),senderFailure,mailProvider),
    },
    distribution: { segments: new DistributionSegments(platform.databaseBinding), importer: new ContactImport(platform.databaseBinding), contacts: new DistributionContacts(platform.databaseBinding), launches: new InvitationLaunches(platform.databaseBinding, extensions.distributionPolicies, collectors), deliveries, dispatcher },
    reporting: new ReportingService(new ReportingRepository(platform.databaseBinding)),
    audit,
    brand,
    auth: new AuthService(authRepository, platform, audit, sender),
    workspace: new WorkspaceService(workspaceRepository, extensions.distributionPolicies['flow.reminder-schedule.v1'].delayHours),
    flows,
    responses,
    // Actions take no extension configuration: nothing but an operator's request can set a verdict (ACT-005).
    // Analysis reads only released responses and validates every provider answer before anything is shown (ANLY-002, ANLY-012).
    attention: new AnalysisAttention(platform.databaseBinding),
    rewrites: new DraftRewrites(platform.databaseBinding, platform.ai),
    analysis: new AnalysisService(platform.databaseBinding, platform.ai),
    actions: { records: new ActionService(platform.databaseBinding), tasks: new TaskDeliveries(platform.databaseBinding, platform.configuration.task, platform.configuration.appOrigin) },
  }
}

export type PencilServices = ReturnType<typeof createPencilServices>
