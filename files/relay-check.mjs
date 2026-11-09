import { resolveProject } from '/workspace/run-pencil/node_modules/@runeditrun/rer/cli/project.mjs'
import { checkAgentDoor } from '/workspace/run-pencil/node_modules/@runeditrun/rer/cli/agent-door.mjs'
const project = await resolveProject(process.cwd())
const declaration = project.adapter.deployDeclaration ?? project.adapter.deploy?.declaration
try {
const result = await checkAgentDoor(project.root, {declaration, setupManifest:project.setupManifest, owner:project.adapter.hooks?.owner})
console.log(JSON.stringify({ok:result.ok,total:result.points.length,passed:result.points.filter(p=>p.ok).length,failed:result.points.filter(p=>!p.ok)}))
} catch(e) { console.error(JSON.stringify({code:e.code,message:e.message,failures:e.failures})); process.exitCode=1 }
