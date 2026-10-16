import { useState } from 'react'

export const compatibleAddress = 'https://openrouter.ai/api/v1'
export const compatibleModel = 'openai/gpt-4.1-mini'

function CopyValue({ value, label }: { value: string; label: string }) {
  const [message, setMessage] = useState('')
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`) }
    catch { setMessage(`Copy was unavailable. Select and copy this value: ${value}`) }
  }
  return <span><code>{value}</code> <button type="button" className="quiet-button focus-ring" onClick={() => void copy()}>Copy {label}</button>{message ? <span role="status"> {message}</span> : null}</span>
}

function serviceOrigin(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url.origin : undefined }
  catch { return undefined }
}

export function ProviderSetup({ provider, baseUrl }: { provider: 'openai' | 'compatible' | 'models'; baseUrl: string }) {
  if (provider === 'openai') return <p><a className="analysis-link focus-ring" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Create an OpenAI API key</a> in your project and copy it when shown. Add credit or payment details in <a className="analysis-link focus-ring" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">API billing</a>. Check <a className="analysis-link focus-ring" href="https://developers.openai.com/api/docs/models/gpt-4.1-mini" target="_blank" rel="noreferrer">model access and current prices</a>. Paste the key below, save, then test.</p>
  if (provider === 'compatible') return <>
    <p>OpenRouter is one service you can connect yourself: it gives access to models from several providers through one account. Its address and a model that supports strict structured answers are filled in below.</p>
    <ol>
      <li>Open <a className="analysis-link focus-ring" href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">OpenRouter API keys</a>, sign in or create an account, then create a key named Pencil. Copy the key when it is shown and set a spending limit for it.</li>
      <li>Add credit in <a className="analysis-link focus-ring" href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">OpenRouter credits</a>. Check the <a className="analysis-link focus-ring" href="https://openrouter.ai/openai/gpt-4.1-mini" target="_blank" rel="noreferrer">model’s access and current prices</a>.</li>
      <li>Use API base address <CopyValue value={compatibleAddress} label="API address" /> and model <CopyValue value={compatibleModel} label="model" />. Paste your OpenRouter key below.</li>
      <li>Choose <strong>Save provider</strong>, then <strong>Test saved provider</strong>. Wait for <strong>Connection passed</strong>. If it fails, check credit, key permissions and model access before sending answers.</li>
    </ol>
    <p className="muted">Other services need the <a className="analysis-link focus-ring" href="https://openrouter.ai/docs/api/reference/responses/overview" target="_blank" rel="noreferrer">Responses API</a> and <a className="analysis-link focus-ring" href="https://openrouter.ai/docs/guides/features/structured-outputs" target="_blank" rel="noreferrer">strict JSON-schema output</a>: an answer must follow the exact format Pencil requests. A chat-only service or a native Anthropic/Google API key cannot connect directly. Pencil tests the actual saved address and model; it does not substitute another provider.</p>
  </>
  const origin = serviceOrigin(baseUrl)
  return <>
    <p>Models is a separate application your organization runs to share model access between apps, control spending and report costs. Its administrator keeps the upstream provider keys; Pencil receives a dedicated <strong>app key</strong>. It is useful when you already use Models. Pencil includes no hosted Models account or public signup.</p>
    <p>Enter your organization’s Models service HTTPS address below. Setup links will open that service in a new tab. If you do not have one, choose OpenAI or Other compatible provider above to create a provider account directly.</p>
    {origin ? <ol>
      <li>Sign in as an administrator at <a className="analysis-link focus-ring" href={`${origin}/app/providers`} target="_blank" rel="noreferrer">your Models service → Providers</a>. Add a provider key, verify its model catalogue and record the account’s data policies.</li>
      <li>In <a className="analysis-link focus-ring" href={`${origin}/app/routes`} target="_blank" rel="noreferrer">Routes</a>, add an exact model with Responses and strict JSON-schema support and confirm its prices. Copy its complete name, including the provider prefix.</li>
      <li>In <a className="analysis-link focus-ring" href={`${origin}/app/apps`} target="_blank" rel="noreferrer">Apps</a>, create a Pencil app. Approve that provider and model, set spending and request limits, and allow the features <code>analysis</code>, <code>draft-rewrite</code> and <code>connection-test</code>. Mint an app key that permits these features; copy it when shown.</li>
      <li>Paste that model name and app key below. Choose <strong>Save provider</strong>, then <strong>Test saved provider</strong>. A <strong>Connection passed</strong> message confirms access and structured output. Costs come from the service’s call receipts.</li>
    </ol> : <p className="muted">Paste the service address to show its Providers, Routes and Apps setup links. Ask its administrator for that address if you are not the Models owner.</p>}
  </>
}
