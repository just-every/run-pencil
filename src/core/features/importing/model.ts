export const mappingVersion = 'documented-form-v1'
export type QuestionType = 'short_text' | 'long_text' | 'email' | 'single_choice' | 'multiple_choice' | 'dropdown' | 'yes_no' | 'rating' | 'nps' | 'number' | 'date' | 'consent' | 'priority'
export type ImportStep = { id: string; sourceId: string; groupSourceId?: string; sourceType: string; kind: 'question' | 'welcome' | 'completion'; questionType: QuestionType | null; prompt: string; helperText: string | null; required: boolean; settings: Record<string, unknown>; choices: { id: string; sourceId: string; label: string }[]; next: string | null }
export type ImportRule = { source: string; destination: string; predicate: string; expected: unknown; position: number }
export type ReportItem = { location: string; label: string; sourceType: string; state: 'imported' | 'changed' | 'unsupported'; change: string; reason: string }
export type ImportForm = { title: string; steps: ImportStep[]; rules: ImportRule[]; report: ReportItem[] }
export type ColumnMapping = { column: number; target: string; choice?: string }
export type ImportSource = 'typeform' | 'google-forms'
export type GoogleQuestion = { sourceId: string; type: QuestionType; choices?: string[]; min?: number; max?: number; confirmYesNo?: boolean; yesLabel?: string; noLabel?: string }
export type GoogleSettings = { timeZone?: string; dateOrder?: 'DMY' | 'MDY' | 'YMD'; title?: string; questions?: GoogleQuestion[] }
export type GoogleReview = { mode: 'definition' | 'csv-only'; timeZone?: string; dateOrder?: 'DMY' | 'MDY' | 'YMD'; firstTimestamp?: { local: string; utc: string }; lastTimestamp?: { local: string; utc: string }; proposals: { sourceId: string; column: number; title: string; observedChoices: string[]; suggestedType?: string; driveFiles?: true }[] }
export type ImportInput = { source?: ImportSource; definition: string; csv: string; plannedAt?: string; columns?: ColumnMapping[]; google?: GoogleSettings }
export type RowError = { row: number; column: string; message: string }
export type ParsedResponse = { row: number; startedAt: string | null; submittedAt: string; answers: Record<string, unknown> }
export type ImportReview = { source?: ImportSource; google?: GoogleReview; plannedAt: string; fingerprint: string; flowId: string; title: string; report: ReportItem[]; headers: string[]; forbiddenColumns: number[]; columns: ColumnMapping[]; questions: ImportStep[]; rowErrors: RowError[]; responseCount: number; lossRequired: boolean; alreadyImported: boolean; heldByOtherOperator: boolean; jobId?: string; jobState?: string; pendingCustody?: string }
export const forbiddenColumn = (name: string) => /(^|[^a-z])(network|ip|ipv4|ipv6)([^a-z]|$)|ipaddress|networkid/i.test(name)
export const googleIdentity = (title: string) => /^(?:email address|respondent email|verified(?: email(?: address)?| identity| account)?|workspace(?: email(?: address)?| identity| account)?|username)$/i.test(title.trim())
