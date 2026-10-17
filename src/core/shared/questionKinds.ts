export const questionTypes = [
  'short_text', 'long_text', 'email', 'single_choice', 'multiple_choice', 'rating',
  'priority', 'dropdown', 'yes_no', 'nps', 'number', 'date', 'consent',
  'csat', 'ces', 'emoji_rating', 'thumbs_rating',
  'phone', 'postal_address', 'full_name', 'url', 'currency',
] as const

export type QuestionType = typeof questionTypes[number]

export const questionTypeLabels: Record<QuestionType, string> = {
  short_text: 'Short text', long_text: 'Long text', email: 'Email',
  single_choice: 'Single choice', multiple_choice: 'Multiple choice', rating: 'Rating',
  priority: 'Priority', dropdown: 'Dropdown', yes_no: 'Yes / No', nps: 'NPS',
  number: 'Number', date: 'Date', consent: 'Consent', csat: 'CSAT', ces: 'CES',
  emoji_rating: 'Emoji rating', thumbs_rating: 'Thumbs rating', phone: 'Phone',
  postal_address: 'Postal address', full_name: 'Full name', url: 'URL', currency: 'USD amount',
}
