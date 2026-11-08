import { checkAgentDoor } from '@runeditrun/rer/internal/cli/agent-door.mjs'
await checkAgentDoor(process.cwd(), { declaration: 'deploy.json' })
