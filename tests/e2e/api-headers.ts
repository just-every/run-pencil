// Node's API client needs an explicit Origin; the browser supplies its own.
export const appHeaders = { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }
