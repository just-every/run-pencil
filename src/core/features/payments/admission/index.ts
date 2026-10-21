/** RESP-008 and RESP-009 on payment forms: a response holds an admission place only once Stripe has paid it. */
export const unpaidResponseSql = (responseId: string) => `EXISTS (SELECT 1 FROM response_payments unpaid WHERE unpaid.response_id = ${responseId} AND unpaid.state != 'paid')`
export const admittedResponseSql = (alias: string) => `${alias}.state = 'released' AND NOT ${unpaidResponseSql(`${alias}.id`)}`
