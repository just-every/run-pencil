const categories = [
  ['customer', 'Customer feedback', ['Store visit', 'Service appointment', 'Delivery experience', 'Support follow-up', 'Restaurant visit', 'Membership feedback']],
  ['recommendation', 'NPS', ['Customer loyalty', 'Subscription loyalty', 'Service recommendation', 'Retail recommendation', 'Product recommendation', 'Account relationship']],
  ['satisfaction', 'CSAT', ['Support satisfaction', 'Purchase satisfaction', 'Installation satisfaction', 'Training satisfaction', 'Returns satisfaction', 'Renewal satisfaction']],
  ['effort', 'CES', ['Checkout effort', 'Account setup effort', 'Support resolution effort', 'Return process effort', 'Booking effort', 'Billing effort']],
  ['research', 'Product research', ['Feature priorities', 'Product discovery', 'Prototype feedback', 'Pricing research', 'Purchase decisions', 'Cancellation research']],
  ['employee', 'Employee engagement and eNPS', ['Employee pulse', 'Manager feedback', 'New hire check-in', 'Remote work feedback', 'Benefits feedback', 'Employee recommendation']],
  ['event', 'Event registration', ['Workshop registration', 'Webinar registration', 'Conference registration', 'Networking registration', 'Training registration', 'Community event registration']],
  ['contact', 'Contact and lead capture', ['Sales enquiry', 'Demo request', 'Service quote request', 'Partnership enquiry', 'Newsletter interest', 'Consultation request']],
  ['orders', 'Order requests', ['Catering order request', 'Wholesale order request', 'Custom product request', 'Service booking request', 'Subscription enquiry', 'Merchandise order request']],
  ['jobs', 'Job applications', ['Retail job application', 'Customer service application', 'Office job application', 'Internship application', 'Operations job application', 'Sales job application']],
  ['intake', 'Client intake', ['Design project intake', 'Consulting client intake', 'Bookkeeping client intake', 'Marketing project intake', 'Coaching client intake', 'Home service intake']],
  ['vendor', 'Vendor onboarding', ['Supplier introduction', 'Contractor introduction', 'Service vendor onboarding', 'Wholesale supplier onboarding', 'Event vendor onboarding', 'Technology vendor onboarding']],
] as const
export const templateCatalog = categories.flatMap(([prefix, category, titles]) => titles.map((title, index) => ({ id: `${prefix}-${index + 1}`, title, category, description: `${title}: review the questions and paths before creating a draft.` })))

export const catalogPrompts: Record<string, readonly string[]> = {
  customer: ['How was your store visit?', 'How was your service appointment?', 'How was your delivery experience?', 'How was your support experience?', 'How was your restaurant visit?', 'How is your membership working for you?'],
  research: ['How do you feel about our current features?', 'How well does our product address your needs?', 'How did the prototype work for you?', 'How do you feel about our current pricing?', 'How was your purchasing experience?', 'How was your experience before cancelling?'],
  employee: ['How has work felt this week?', 'How is your manager supporting you?', 'How has your first month been?', 'How is remote work going for you?', 'How well do our benefits support you?', 'How likely are you to recommend working here?'],
  event: ['What do you hope to learn at the workshop?', 'What question should our webinar answer?', 'Which conference topics interest you?', 'Who would you like to meet at this event?', 'What skills do you want to practise?', 'How would you like to participate in this event?'],
  contact: ['What business problem can our sales team help with?', 'What would you like to see in a demonstration?', 'What work should we include in your quote?', 'What partnership would you like to explore?', 'Which topics would you like to hear about?', 'What would you like to discuss in a consultation?'],
  orders: ['What food, guest count and date do you need?', 'Which products and quantities would you like?', 'What specifications do you need for your custom order?', 'What service and appointment date do you need?', 'Which subscription are you interested in?', 'Which merchandise and quantities would you like?'],
  jobs: ['What retail experience would you bring to this role?', 'How have you helped a customer solve a problem?', 'What office systems and processes have you used?', 'What would you like to learn during this internship?', 'What operations experience would you bring?', 'Tell us about a sales relationship you developed.'],
  intake: ['What design work, deadline and budget do you have?', 'What business decision do you need help with?', 'What bookkeeping support does your business need?', 'What audience and campaign goals do you have?', 'What would you like to achieve through coaching?', 'What work does your property need and when?'],
  vendor: ['What goods can your business supply?', 'What services, coverage area and availability do you offer?', 'What business services and support do you provide?', 'What products, minimum orders and lead times do you offer?', 'What event services and dates can you support?', 'What technology and ongoing support do you provide?'],
}
