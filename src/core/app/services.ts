import { DistributionDispatcher } from '../features/distribution/dispatcher'
import { baseMailSender } from '../platform/mail/base.server'
import { mountServerExtensions } from './mountExtensions.server'
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

export function createPencilServices(platform: PencilPlatform) {
  const { database } = platform
  const extensions = mountServerExtensions()
  const workspaceRepository = new WorkspaceRepository(database)
  const flowRepository = new FlowRepository(database, platform.databaseBinding)
  const responseRepository = new ResponseRepository(database, platform.databaseBinding)
  const authRepository = new AuthRepository(database, platform.databaseBatch)
  const audit = new AuditService(new AuditRepository(database))

  const deliveries = new MailDeliveries(platform.databaseBinding)
  const sender = baseMailSender(platform.configuration.mail, platform.databaseBinding)
  const dispatcher = new DistributionDispatcher(platform.databaseBinding, deliveries, sender, platform.configuration.appOrigin, platform.configuration.mail.kind === 'local-development' ? 'no-reply@pencil.test' : platform.configuration.mail.from)
  return {
    distribution: { contacts: new DistributionContacts(platform.databaseBinding), launches: new InvitationLaunches(platform.databaseBinding, extensions.distributionPolicies), deliveries, dispatcher },
    reporting: new ReportingService(new ReportingRepository(platform.databaseBinding)),
    audit,
    auth: new AuthService(authRepository, platform, audit),
    workspace: new WorkspaceService(workspaceRepository),
    flows: new FlowService(flowRepository, responseRepository, extensions.flowPolicies),
    responses: new ResponseService(flowRepository, responseRepository),
  }
}

export type PencilServices = ReturnType<typeof createPencilServices>
