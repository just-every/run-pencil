export function TaskSetup({ todoist }: { todoist: boolean }) {
  return todoist ? <>
    <p>Send confirmed actions to your Todoist Inbox. You need a Todoist account and its API token; no code, automation builder or extra hosting is needed.</p>
    <ol>
      <li><a className="analysis-link focus-ring" href="https://app.todoist.com/auth/signup" target="_blank" rel="noreferrer">Create a Todoist account</a>, or sign in to your existing account.</li>
      <li>Open <a className="analysis-link focus-ring" href="https://app.todoist.com/app/settings/integrations/developer" target="_blank" rel="noreferrer">Settings → Integrations → Developer</a> in Todoist. Under <strong>API token</strong>, choose <strong>Copy API token</strong>. This token gives access to your Todoist account; keep it private.</li>
      <li>Paste it in <strong>Todoist API token</strong> below and choose <strong>Save connection</strong>.</li>
      <li>Choose <strong>Send test task</strong>. A success message includes the task ID and a link. Open it in Todoist and check the sample named <strong>Pencil connection test</strong>.</li>
      <li>Choose <strong>Create external task</strong> below. Review the fields, then <strong>Confirm and send</strong>. Pencil shows <strong>Confirmed</strong> and the Todoist task ID.</li>
    </ol>
    <p>The action title becomes the task name, its review date becomes the due date, and its rationale, owner, metric, baseline and Pencil link become the description. The task belongs to the account whose token you paste; the action owner is recorded in its description, not assigned as a Todoist collaborator.</p>
    <p className="muted">Pencil charges no integration fee. <a className="analysis-link focus-ring" href="https://www.todoist.com/pricing" target="_blank" rel="noreferrer">Todoist plans and limits</a> apply. A repeated send uses the same Todoist command so it cannot add a duplicate. Moving or completing the task in Todoist does not change the Pencil action.</p>
  </> : <>
    <p>For a different task tool, a developer can connect an HTTPS receiver that creates tasks in it. Ask for its endpoint URL and bearer key, then save and test below. The receiver must return a task ID and prevent duplicates as described in the advanced contract.</p>
    <p>A task tool’s website, ordinary API key, or Zapier Catch Hook alone does not meet that contract. Use Todoist above for setup without a custom server.</p>
  </>
}
