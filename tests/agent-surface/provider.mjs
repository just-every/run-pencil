// Paid network boundary only. No native data store, auth adapter or network access.
export default {
  async fetch(request, { fixture }) {
    if (request.url !== 'https://api.openai.com/v1/responses' || request.method !== 'POST'
      || !fixture?.keys?.some(key => request.headers.get('authorization') === `Bearer ${key}`)) return new Response('Unexpected provider request', { status: 400 });
    const body = await request.json();
    if (body.store !== false || !['pencil_studio', 'draft_rewrite', 'pencil_analysis'].includes(body.text?.format?.name) || body.text.format.strict !== true
      || (body.text.format.name !== 'pencil_analysis' && !body.metadata?.prepared_by?.includes(' for '))) return new Response('Invalid native provider payload', { status: 400 });
    const input = JSON.parse(body.input[1].content[0].text);
    if (body.text.format.name === 'pencil_analysis') {
      if (!Array.isArray(input.questions) || !Array.isArray(input.responses) || !input.responses.length || !Number.isInteger(input.minimumThemeResponses) || input.responses.length < input.minimumThemeResponses || body.metadata !== undefined) return new Response('Invalid native analysis evidence', { status: 400 });
      const quotes = input.responses.map(response => { const [questionId, text] = Object.entries(response.answers).find(([, value]) => typeof value === 'string') ?? []; return { responseId: response.id, questionId, start: 0, end: text?.length, text }; });
      if (quotes.some(quote => !quote.questionId || typeof quote.text !== 'string' || !input.questions.some(question => question.id === quote.questionId))) return new Response('Invalid native analysis excerpt', { status: 400 });
      const output = { outcome: 'findings', reason: '', themes: [{ title: 'Arrival clarity', summary: 'Visitors asked for clearer arrival instructions.', responseIds: input.responses.map(response => response.id), count: input.responses.length, quotes }], recommendations: [{ title: 'Clarify arrival instructions', rationale: 'Review the cited visitor evidence before deciding.', themeIndexes: [0], confidence: 'medium', expectedImpact: 'medium', effort: 'low' }], contradictions: [] };
      return Response.json({ id: 'resp_synthetic_pencil_analysis', status: 'completed', usage: { input_tokens: 100, output_tokens: 150 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
    }
    if (body.text.format.name === 'draft_rewrite') {
      if (typeof input.source !== 'string' || !['sharper', 'broader', 'contextual'].includes(input.style) || typeof input.context !== 'string') return new Response('Invalid native rewrite evidence', { status: 400 });
      return Response.json({ id: 'resp_synthetic_pencil_rewrite', status: 'completed', usage: { input_tokens: 75, output_tokens: 40 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ proposal: 'What would make your next visit easier?' }) }] }] });
    }
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
