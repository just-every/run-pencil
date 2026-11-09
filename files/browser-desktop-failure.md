# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calculations.spec.ts >> [LOGIC-003,LOGIC-006,PAY-001,PAY-005,PAY-003,PAY-004,DIST-009] builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals
- Location: tests/e2e/contract.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Standard order · Total 48', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Standard order · Total 48', exact: true }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Standard order · Total 48', exact: true })

```

```yaml
- main:
  - article:
    - paragraph: Synthetic business
    - heading "Returning from Stripe" [level=1]
    - status: Loading your response…
```

