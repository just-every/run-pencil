import { checkPencilResources } from '../tests/agent-door/resources.mjs'
import { resolveProject } from '@runeditrun/rer/internal/cli/project.mjs'
import { checkHostedOutput } from '@runeditrun/rer/internal/cli/hosted-output.mjs'
import { checkHydration } from '@runeditrun/rer/internal/cli/hydration/check.mjs'
import { checkAgentDoor } from '@runeditrun/rer/internal/cli/agent-door.mjs'

// These are the maintained checks rer verify runs after verify:app.
// CI runs them beside the application wall, against a fresh production build.
const project = await resolveProject(process.cwd())
const declaration = project.adapter.deployDeclaration ?? project.adapter.deploy?.declaration
await checkHostedOutput(project.root, { declaration })
await checkHydration(project.root, { pages: project.adapter.publicPages, declaration, report: lines => lines.forEach(line => console.log(line)) })
await checkAgentDoor(project.root, { declaration, setupManifest: project.setupManifest, owner: project.adapter.hooks?.owner })

await checkPencilResources(project.root, project.adapter.deployDeclaration ?? project.adapter.deploy?.declaration)
