// Paid network boundary only. No native data store, auth adapter or network access.
export default {
  async fetch(request) {
    if (request.url !== 'https://api.openai.com/v1/responses' || request.method !== 'POST'
      || !/^Bearer [A-Za-z0-9_-]{20,}$/.test(request.headers.get('authorization') ?? '')) return new Response('Unexpected provider request', { status: 400 });
    const body = await request.json();
    if (body.store !== false || body.text?.format?.name !== 'pencil_studio' || body.text.format.strict !== true
      || !body.metadata?.prepared_by?.includes(' for ')) return new Response('Invalid native provider payload', { status: 400 });
    const input = JSON.parse(body.input[1].content[0].text);
    if (!['study', 'form'].includes(input.mode) || !Array.isArray(input.priorForms)) return new Response('Invalid native evidence', { status: 400 });
    const output = { title: 'Customer visit study', hiddenFields: [], identityMode: 'anonymous', branches: [], flags: [],
      steps: [{ key: 'question', kind: 'question', questionType: 'long_text', prompt: 'What would improve your next visit?', required: false, consentStatement: null, choices: [], scale: null, next: 'done' },
        { key: 'done', kind: 'completion', questionType: null, prompt: 'Thank you', required: false, consentStatement: null, choices: [], scale: null, next: null }],
      study: input.mode === 'study' ? { decision: 'Choose the next visit improvement', hypotheses: ['Clearer arrival instructions reduce uncertainty'], audience: 'Consenting recent visitors', channel: 'Survey link', analysisPlan: 'Review cited comments alongside the visit score' } : null,
    };
    return Response.json({ id: 'resp_synthetic_pencil', status: 'completed', usage: { input_tokens: 125, output_tokens: 250 },
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    });
  },
};
