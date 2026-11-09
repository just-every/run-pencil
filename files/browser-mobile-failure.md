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

Locator: getByRole('region', { name: 'Draft preview', exact: true }).getByRole('heading', { name: 'Pay for the large order', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: 'Draft preview', exact: true }).getByRole('heading', { name: 'Pay for the large order', exact: true }) with timeout 5000ms
  - waiting for getByRole('region', { name: 'Draft preview', exact: true }).getByRole('heading', { name: 'Pay for the large order', exact: true })

```

```yaml
- main:
  - link "Pencil":
    - /url: /app
  - navigation "Operator navigation":
    - link "Flows":
      - /url: /app
    - link "Audience":
      - /url: /app/audience
    - link "Actions":
      - /url: /app/actions
    - link "Analysis":
      - /url: /app/analysis
    - link "Audit log":
      - /url: /app/audit
    - link "Settings":
      - /url: /app/settings
  - button "Sign out"
  - region "Calculated order":
    - link "All flows":
      - /url: /app
    - heading "Calculated order" [level=1]
    - paragraph: Draft
    - button "Share"
    - button "Preview draft"
    - button "Publish"
    - region "Draft preview":
      - paragraph: Preview
      - paragraph: Try your questions here. Preview answers are not collected.
      - button "Close preview"
      - paragraph: Synthetic business
      - paragraph: question
      - heading "Apply the discount?" [level=2]
      - paragraph: Required
      - group "Apply the discount?":
        - radiogroup "Apply the discount?":
          - radio "Yes" [checked]
          - text: "Yes"
          - radio "No"
          - text: "No"
      - button "Back in preview"
      - button "Continue preview"
      - button "Inspect answer path"
      - alert: The request could not be completed.
    - complementary "Flow steps":
      - paragraph: Steps
      - paragraph: 6 steps
      - button "Add step"
      - button "1 How many items? Number":
        - text: "1"
        - strong: How many items?
        - text: Number
      - button "2 Apply the discount? Yes / No":
        - text: "2"
        - strong: Apply the discount?
        - text: Yes / No
      - button "3 Pay for the standard order Payment":
        - text: "3"
        - strong: Pay for the standard order
        - text: Payment
      - button "4 Pay for the large order Payment":
        - text: "4"
        - strong: Pay for the large order
        - text: Payment
      - 'button "5 Standard order · Total {{variable:5f948257-8356-4c84-9404-6a441f30152b}} Completion"':
        - text: "5"
        - strong: "Standard order · Total {{variable:5f948257-8356-4c84-9404-6a441f30152b}}"
        - text: Completion
      - 'button "6 Large order · Total {{variable:5f948257-8356-4c84-9404-6a441f30152b}} Completion"':
        - text: "6"
        - strong: "Large order · Total {{variable:5f948257-8356-4c84-9404-6a441f30152b}}"
        - text: Completion
    - text: Number Required
    - heading "How many items?" [level=2]
    - spinbutton "How many items?"
    - complementary "Step settings":
      - text: Content
      - group: Prefill
      - group: Screen layout and visibility
      - text: Prompt
      - textbox "Prompt": How many items?
      - group: Rewrite this question
      - group: Insert an earlier answer
      - group: Extra wording
      - text: Question type
      - combobox "Question type":
        - option "Short text"
        - option "Long text"
        - option "Email"
        - option "Single choice"
        - option "Multiple choice"
        - option "Rating"
        - option "Priority"
        - option "Dropdown"
        - option "Yes / No"
        - option "NPS"
        - option "Number" [selected]
        - option "Date"
        - option "Consent"
        - option "CSAT"
        - option "CES"
        - option "Emoji rating"
        - option "Thumbs rating"
        - option "Phone"
        - option "Postal address"
        - option "Full name"
        - option "URL"
        - option "USD amount"
        - option "Matrix grid"
      - text: Minimum
      - spinbutton "Minimum": "1"
      - text: Maximum
      - spinbutton "Maximum": "100"
      - text: Decimal places
      - spinbutton "Decimal places": "0"
      - group: Video
      - text: Default next screen
      - combobox "Default next screen":
        - option "Choose a screen"
        - option "Apply the discount?" [selected]
        - option "Pay for the standard order"
        - option "Pay for the large order"
        - option "Standard order · Total…"
        - option "Large order · Total…"
      - text: Required response
      - checkbox "Required response" [checked]
      - button "Move up" [disabled]
      - button "Move down"
      - button "Duplicate"
      - button "Delete"
      - region "Branch rules":
        - group:
          - heading "Answer paths" [level=2]
          - button "Add rule"
      - button "Save"
    - group "Publication limits": Publication options
    - paragraph: Flow lifecycle
    - text: Draft
    - paragraph: Publish your saved changes when you are ready to share.
    - button "Archive flow"
```

