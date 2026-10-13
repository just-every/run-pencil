export function developmentInbox(get: (path: string) => Promise<{ status: number | (() => number); text(): Promise<string> }>, email: string): Promise<{ messages: Array<{ id: string; magicLinkToken: string }> }>
export function devKeyHeaders(root?: string): { 'x-rer-dev-key': string }
