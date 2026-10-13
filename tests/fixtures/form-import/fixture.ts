// Synthetic inputs written from documented shapes. No real account export.
const choices = [{ ref: 'tea', label: 'Tea, green' }, { ref: 'coffee', label: 'Café ☕' }]
export const definition = {
  id: 'synthetic-form', title: 'Synthetic café visit',
  welcome_screens: [{ ref: 'welcome', title: 'Welcome', properties: { description: 'A short visit survey', button_text: 'Begin' } }],
  fields: [
    { ref: 'short', type: 'short_text', title: 'Name', validations: { required: true, max_length: 150 } },
    { ref: 'long', type: 'long_text', title: 'Notes' }, { ref: 'email', type: 'email', title: 'Email' },
    { ref: 'single', type: 'multiple_choice', title: 'Drink', properties: { choices } },
    { ref: 'multi', type: 'multiple_choice', title: 'Enjoyed', properties: { choices, allow_multiple_selection: true, randomize: true }, validations: { min_selection: 0, max_selection: 2 } },
    { ref: 'drop', type: 'dropdown', title: 'Next drink', properties: { choices } },
    { ref: 'yes', type: 'yes_no', title: 'Return?' }, { ref: 'rating', type: 'rating', title: 'Stars', properties: { steps: 5, shape: 'star' } },
    { ref: 'opinion', type: 'opinion_scale', title: 'Experience', properties: { steps: 11, start_at_one: false } },
    { ref: 'nps', type: 'nps', title: 'Recommend' }, { ref: 'number', type: 'number', title: 'Visits', validations: { min_value: 0 } },
    { ref: 'date', type: 'date', title: 'Visit date' }, { ref: 'legal', type: 'legal', title: 'I accept the stated terms.' },
    { ref: 'rank', type: 'ranking', title: 'Priority', properties: { choices } },
    { ref: 'phone', type: 'phone_number', title: 'Phone' }, { ref: 'web', type: 'website', title: 'Website' },
    ...['statement', 'group', 'matrix', 'file_upload', 'payment', 'signature', 'picture_choice', 'calendly', 'video', 'audio'].map((type, i) => ({ ref: `unsupported-${i}`, type, title: `Unsupported ${type}` })),
  ],
  thankyou_screens: [{ ref: 'thanks', title: 'Thank you', properties: { share_icons: true } }, { ref: 'special', title: 'See you soon', properties: { redirect_url: 'https://example.test/thanks' } }],
  logic: [
    { type: 'field', ref: 'single', actions: [{ action: 'jump', details: { to: { type: 'field', value: 'nps' } }, condition: { op: 'is', vars: [{ type: 'field', value: 'single' }, { type: 'choice', value: 'coffee' }] } }] },
    { type: 'field', ref: 'rating', actions: [{ action: 'jump', details: { to: { type: 'thankyou', value: 'special' } }, condition: { op: 'greater_than', vars: [{ type: 'field', value: 'rating' }, { type: 'constant', value: 4 }] } }] },
    { type: 'field', ref: 'short', actions: [{ action: 'add', details: { target: { type: 'variable', value: 'score' }, value: { type: 'constant', value: 5 } }, condition: { op: 'always', vars: [] } }] },
  ],
  hidden: ['never-import-hidden-value'], variables: { score: 991827 }, settings: { is_public: true },
}
export const formJson = JSON.stringify(definition)
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
const headers = ['Name', 'Notes', 'Email', 'Drink', 'Enjoyed', 'Next drink', 'Return?', 'Stars', 'Experience', 'Recommend', 'Visits', 'Visit date', 'I accept the stated terms.', 'Priority', 'Phone', 'Website', 'Start Date', 'Submit Date', 'Network ID', 'IP Address']
export const csv = [headers, ...Array.from({ length: 27 }, (_, i) => [
  `Visitor ${i} – 日本語`, i % 2 ? 'Line one, with comma\nLine two "quoted"' : '', `visitor${i}@example.test`, 'Café ☕', JSON.stringify(['Tea, green', 'Café ☕']), 'Tea, green', i % 2 ? '1' : '0', '4', '9', '10', '2.5', '2026-09-12', '1', JSON.stringify(['Café ☕', 'Tea, green']), '+1 555 0100', 'https://example.test', '2026-09-12 10:00:00', '2026-09-12 10:03:00', `forbidden-network-${i}`, `192.0.2.${i + 1}`,
])].map(row => row.map(quote).join(',')).join('\r\n')
export const simpleJson = JSON.stringify({ title: 'Simple import', fields: [{ ref: 'text', type: 'short_text', title: 'Answer' }], thankyou_screens: [{ ref: 'end', title: 'Thanks' }] })
export const simpleCsv = 'Answer,Submit Date,Network ID\nHello,2026-09-12 10:03:00,forbidden-network-value\n'
