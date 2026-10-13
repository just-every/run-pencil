import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { participantInvitation } from './message'

contract(['DIST-003', 'DIST-005'], 'participant invitation preserves plain metadata and escapes every HTML text and URL attribute', () => {
  const message = participantInvitation('A&B <shop>', '"Feedback" <script>alert(1)</script>', 'https://forms.example/i/key?a=1&b="two"', 'https://forms.example/optout/key?a=1&b=2')
  expect(message.subject).toBe('A&B <shop>: "Feedback" <script>alert(1)</script>')
  expect(message.text).toBe('A&B <shop> invites your feedback on "Feedback" <script>alert(1)</script>.\nhttps://forms.example/i/key?a=1&b="two"\n\nStop future flow mail: https://forms.example/optout/key?a=1&b=2')
  expect(message.html).toContain('A&amp;B &lt;shop&gt; invites your feedback on &quot;Feedback&quot; &lt;script&gt;alert(1)&lt;/script&gt;.')
  expect(message.html).toContain('href="https://forms.example/i/key?a=1&amp;b=&quot;two&quot;"')
  expect(message.html).toContain('href="https://forms.example/optout/key?a=1&amp;b=2"')
  expect(message.html).not.toContain('<script>')
})
