/** Native person routes share the registered resource vocabulary. */
export function personResourceEvents(path: string, body: Record<string, unknown>) {
  const events: Array<{type: string; uri: string}> = []
  const add = (area: string, id: unknown, type: string) => {
    if (typeof id === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(id)) events.push({ type, uri: `pencil://${area}/${id}` })
  }
  const studio = /^\/api\/app\/studio(?:\/([A-Za-z0-9_-]+))?$/.exec(path)
  if (studio) add('forms', studio[1] ?? body.flowId, 'form.draft-changed')
  const contact = /^\/api\/app\/distribution\/contacts(?:\/([A-Za-z0-9_-]+)(?:\/(?:consent|erase))?)?$/.exec(path)
  if (contact && contact[1] !== 'import') add('contacts', contact[1] ?? body.id, 'contact.changed')
  const action = /^\/api\/app\/actions(?:\/([A-Za-z0-9_-]+)(?:\/(?:transitions|measurements))?)?$/.exec(path)
  if (action) add('actions', action[1] ?? body.id, 'action.changed')
  const analysis = /^\/api\/app\/analysis(?:\/([A-Za-z0-9_-]+)(?:\/retry|\/findings\/([A-Za-z0-9_-]+)\/decision)?)?$/.exec(path)
  if (analysis && !['policies', 'options'].includes(analysis[1])) {
    add('analyses', analysis[1] ?? body.id, 'analysis.changed')
    if (analysis[2]) add('findings', analysis[2], 'finding.decided')
  }
  const response = /^\/api\/app\/responses\/([A-Za-z0-9_-]+)\/(?:release|quarantine|erase)$/.exec(path)
  if (response) add('responses', response[1], 'response.changed')
  return events
}
