export type ResponseEditSettings = { enabled: boolean; deadline: string }
export function responseEditsIssue(value: unknown): string | undefined {
 if(value===undefined)return
 if(!value || typeof value!=='object' || Array.isArray(value))return 'Choose valid response editing settings.'
 const settings=value as Record<string,unknown>
 if(Object.keys(settings).some(key=>!['enabled','deadline'].includes(key)) || typeof settings.enabled!=='boolean' || typeof settings.deadline!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(settings.deadline) || !Number.isFinite(Date.parse(settings.deadline)))return 'Choose an editing deadline.'
}
