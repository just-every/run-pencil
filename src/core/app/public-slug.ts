export function decodePublicSlug(encoded: string): string | undefined {
  try {
    const slug = decodeURIComponent(encoded)
    return slug.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : undefined
  } catch { return undefined }
}
