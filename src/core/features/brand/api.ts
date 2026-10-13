import type { BrandInput, WorkspaceBrand } from './brand'
async function request(init?: RequestInit, path = '/api/app/brand'): Promise<WorkspaceBrand> {
  const response = await fetch(path, { credentials: 'same-origin', ...init })
  const data = await response.json() as WorkspaceBrand & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'Business branding could not be saved.')
  return data
}
export const brandApi = {
  get: () => request(),
  save: ({ name, supportingLine, accent, publicFlowSlug }: BrandInput) => request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, supportingLine, accent, publicFlowSlug }) }),
  upload: (file: File) => request({ method: 'PUT', headers: { 'Content-Type': file.type }, body: file }, '/api/app/brand/logo'),
  removeLogo: () => request({ method: 'DELETE' }, '/api/app/brand/logo'),
}
