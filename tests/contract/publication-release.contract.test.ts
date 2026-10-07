import { expect, test } from 'vitest'
// @ts-expect-error The publication CLI is maintained as JavaScript.
import { hasProviderCredential } from '../../scripts/publication-patterns.mjs'
test('publication detects every supported credential prefix in source, prose, headers, URLs and assignments without treating identifier substrings as tokens', () => {
  for(const prefix of ['sk_live','sk-','SG.','re_','ghp_','github_pat_']) {
    const credential=prefix+'SyntheticValue'.repeat(3)
    for(const text of [credential,`"${credential}"`,`Authorization: Bearer ${credential}`,`key=${credential}`,`https://example.test/?token=${credential}`,`'value': '${credential}'`]) expect(hasProviderCredential(text)).toBe(true)
    expect(hasProviderCredential(prefix+'A-'.repeat(16))).toBe(true)
    if(prefix !== 're_') expect(hasProviderCredential('unseparated'+credential)).toBe(true)
    expect(hasProviderCredential(`/*${credential}*/`)).toBe(true)
    expect(hasProviderCredential(`\n\t${credential}\n`)).toBe(true)
  }
  for(const text of ['cloudflare_invalid_unsubscribe_header','cloudflare_partial_recipient_failure','a_provider_error_code','mask-background-image-long-selector','No credential configured.']) expect(hasProviderCredential(text)).toBe(false)
})
