import { CopyTask } from './CopyTask'

const example = {
  idempotencyKey: 'pencil-action-example-action-id',
  action: {
    title: 'Shorten the wait at the counter',
    rationale: 'Improve the waiting experience.',
    owner: { name: 'Example owner', email: 'owner@example.com' },
    metric: { name: 'Short waits', unit: 'percent', direction: 'increase', baseline: { value: 33, source: 'Revision 1 results', observedAt: '2026-10-12T09:00:00.000Z' } },
    reviewDate: '2026-12-01',
    reportLink: 'https://pencil.example.com/app/actions/example-action-id',
  },
}



export function ReceiverContract() {
  return <details style={{ marginTop: '1rem' }}>
    <summary>Advanced: custom receiver contract</summary>
    <p>Your receiver must validate the bearer key and create or get one task by the idempotency key. Store the key-to-task mapping atomically: repeated requests, including simultaneous requests, must return the same task ID without creating another task.</p>
    <p>Pencil sends POST to your endpoint with these headers (replace the example key with your secret):</p>
    <pre tabIndex={0} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{'Authorization: Bearer <your bearer key>\nContent-Type: application/json\nAccept: application/json\nIdempotency-Key: pencil-action-example-action-id'}</pre>
    <p>The JSON body has this exact shape. These are fictional example values. For real actions, the confirmation screen shows the actual title, rationale, owner name and email, metric, review date and signed-in action link before sending. It includes no raw answers, excerpts or evidence counts.</p>
    <pre tabIndex={0} aria-label="Receiver request example" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: '100%' }}>{JSON.stringify(example, null, 2)}</pre>
    <CopyTask text={JSON.stringify(example, null, 2)} label="Copy receiver example" />
    <p>The header and body idempotency keys match. A real action uses <code>pencil-action-&lt;action ID&gt;</code> for its whole life; retries keep that key. Connection tests use a separate stable key, <code>pencil-connection-test-&lt;workspace ID&gt;</code>, so repeating a test checks that your receiver returns the same sample task.</p>
    <p>Return HTTP 200 or another 2xx status with JSON <code>{'{"taskId":"TASK-123"}'}</code>. The task ID must be 1–200 visible ASCII characters with no spaces. A repeat of this example request must return <code>{'{"taskId":"TASK-123"}'}</code> again. Pencil reads only the task ID.</p>
    <p>Respond within 10 seconds with at most 16 KiB. Redirects are not followed. A redirect or error status fails delivery; a timeout, lost connection or invalid response leaves its outcome unknown because the task may already exist. Pencil shows the outcome and offers manual retry with the same key.</p>
  </details>
}
