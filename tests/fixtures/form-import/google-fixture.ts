// Synthetic, written from the public forms.get resource and Forms response CSV help.
// https://developers.google.com/workspace/forms/api/reference/rest/v1/forms
// https://support.google.com/docs/answer/139706 — no account/export was accessed.
export const skippedIdentity = 'GOOGLE-SKIPPED-IDENTITY-73f2a@example.test'
export const answerCanary = 'Google historical answer – 日本語'
export const ordinaryEmail = 'ordinary-answer@example.test'
export const quoteCsv = (rows: string[][]) => '\uFEFF' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
const text = (itemId: string, questionId: string, title: string, paragraph = false) => ({ itemId, title, questionItem: { question: { questionId, textQuestion: { paragraph } } } })
export const simpleGoogleDefinition = { formId: 'synthetic-google', info: { title: 'Google café responses' }, items: [text('answer-item', 'answer', 'Answer')] }
export const simpleGoogleJson = JSON.stringify(simpleGoogleDefinition)
export const googleDefinition = {
  formId: 'synthetic-google-complete', info: { title: 'Google café history', description: 'Synthetic documented shape' }, settings: { emailCollectionType: 'VERIFIED', quizSettings: { isQuiz: true } },
  items: [text('answer-item', 'answer', 'Answer'), text('notes-item', 'notes', 'Notes', true), text('first-item', 'first', 'Same'), text('second-item', 'second', 'Same'),
    { itemId: 'colors-item', title: 'Colors', questionItem: { question: { questionId: 'colors', choiceQuestion: { type: 'CHECKBOX', options: [{ value: 'Red' }, { value: 'Blue' }], shuffle: true }, grading: { pointValue: 2, correctAnswers: { answers: [{ value: 'Red' }] }, whenRight: { text: 'Private quiz feedback' } } } } },
    { itemId: 'file-item', title: 'Attachment', questionItem: { question: { questionId: 'file', fileUploadQuestion: { folderId: 'synthetic-folder', types: ['PDF'], maxFiles: 1, maxFileSize: '1048576' } } } },
    { itemId: 'grid-item', title: 'Service', questionGroupItem: { questions: [{ questionId: 'speed', rowQuestion: { title: 'Speed' } }], grid: { columns: { type: 'RADIO', options: [{ value: 'Good' }, { value: 'Bad' }] }, shuffleQuestions: true } } },
    text('email-item', 'ordinary-email', 'Email Address'),
  ],
}
export const googleJson = JSON.stringify(googleDefinition)
export const googleHeaders = ['Timestamp', 'Answer', 'Notes', 'Same', 'Same', 'Colors', 'Email Address', 'Verified email', 'Score', 'Feedback', 'Attachment', 'Service [Speed]']
export const googleCsv = quoteCsv([googleHeaders,
  ['23/04/2026 09:10:11', answerCanary, 'First line, café\nSecond "quoted" line', 'left', 'right', 'Red, Blue', skippedIdentity, skippedIdentity, '2 / 2', 'PRIVATE-GRADE-73f2a', 'https://drive.google.com/file/d/SYNTHETIC-PRIVATE-73f2a/view', 'Good'],
  ['24/04/2026 11:12:13', 'Second answer', '', 'second-left', 'second-right', 'Blue', skippedIdentity, skippedIdentity, '1 / 2', '', '', 'Bad'],
])
export const ambiguousGoogleCsv = quoteCsv([['Timestamp', 'Answer', 'Email Address'], ['03/04/2026 00:05:06', answerCanary, skippedIdentity]])
export const settledGoogleCsv = quoteCsv([['Timestamp', 'Answer', 'Email Address'], ['23/04/2026 09:10:11', answerCanary, skippedIdentity]])
export const csvOnlyObservations = quoteCsv([['Timestamp', 'Code', 'Truth', 'Date-like', 'Choice', 'Same', 'Same'], ['23/04/2026 09:10:11', '0012', 'true', '1/2/2026', 'Tea, green', 'first', 'second'], ['24/04/2026 09:10:11', '0012', 'false', '2/3/2026', 'Café', 'third', 'fourth']])
export function branchDefinition(mode: 'supported' | 'intervening' | 'restart' | 'loop' | 'upload-target' | 'empty-target' = 'supported') {
  const options = [{ value: 'Next', goToAction: 'NEXT_SECTION' }, { value: 'Submit', goToAction: 'SUBMIT_FORM' }, { value: 'Special', goToSectionId: 'special-section' }, ...(mode === 'restart' ? [{ value: 'Restart', goToAction: 'RESTART_FORM' }] : [])]
  const choose = { itemId: 'route-item', title: 'Choose route', questionItem: { question: { questionId: 'route', choiceQuestion: { type: 'RADIO', options } } } }
  return { formId: `synthetic-${mode}`, info: { title: `Google branch ${mode}` }, items: [text('before-item', 'before', 'Before branch'), choose,
    ...(mode === 'intervening' ? [text('intervening-item', 'intervening', 'Must answer before leaving section')] : []),
    { itemId: 'next-section', title: 'Next section', pageBreakItem: {} }, text('next-item', 'next', 'Next answer'),
    { itemId: 'special-section', title: 'Special section', pageBreakItem: {} },
    ...(mode === 'empty-target' ? [] : mode === 'upload-target' ? [{ itemId: 'file-item', title: 'Only upload', questionItem: { question: { questionId: 'file', fileUploadQuestion: { folderId: 'synthetic-folder', maxFiles: 1 } } } }] : mode === 'loop' ? [{ itemId: 'loop-item', title: 'Loop back', questionItem: { question: { questionId: 'loop', choiceQuestion: { type: 'RADIO', options: [{ value: 'Again', goToSectionId: 'next-section' }] } } } }] : [text('special-item', 'special', 'Special answer')]),
  ] }
}
export const googleInput = { source: 'google-forms' as const, definition: googleJson, csv: googleCsv, google: { timeZone: 'Australia/Brisbane' }, plannedAt: '2026-10-12T00:00:00.000Z' }
