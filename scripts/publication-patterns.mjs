// Provider credential prefixes start a token; an internal substring of an
// identifier such as cloudflare_invalid_response is not a Resend credential.
// Retain the original embedded detection for unambiguous prefixes; extended
// token alphabets require a boundary so CSS mask-* names are not credentials.
// Keep detection independent of filenames, source origin and allowlists.
export function hasProviderCredential(text) {
  return /(?:sk_live|sk-|SG\.|ghp_|github_pat_)[A-Za-z0-9_]{16,}|(?<![A-Za-z0-9_])(?:sk_live|sk-|SG\.|re_|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/.test(text)
}
