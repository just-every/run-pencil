# Local native observations

Head: 0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef. Product and origin/main are byte-identical.

The complete affected native file was run with Node 22.20.0 and pinned pnpm 10.12.4:

`pnpm exec vitest run --config vitest.worker.config.ts tests/runtime/calculations.worker.test.ts`

Initial run: exit 1, five passed and one failed. The combined payment journey at line 548 timed out after 30000ms during concurrent setup migrations. No timeout or assertion was changed.

Isolated repeat after setup completed: exit 1, five passed and one failed. The same registration failed at line 569, before its ACH section, with HTTP 400 instead of HTTP 200:

> {"error":"VALIDATION_ERROR","message":"Stripe period totals could not be read. Reconciliation is incomplete."}

That line reconciles a synthetic pre-ledger payment for 2020-01-01. It belongs to the existing payment ledger workload. Both runs and the exact error are retained in the packet. There is no product diff or candidate-only regression. The same SHA already has successful push Verify 42593015478 and successful Run site 42593015597. No CI repair was attempted and no workflow was dispatched or rerun.

A focused registration run is also recorded separately to distinguish test-order state from a local transport failure. This does not alter the committed registration, production path or timeout.

Focused registration: exit 1, five other registrations unselected. It passed the earlier reconciliation section and failed later at line 768 while creating a recurring custom donation: HTTP 400 instead of 201, "Stripe could not be reached. Your answers are saved; retry to continue to payment." That occurs before the ACH section at line 781. This is another local transport observation on unchanged main, not an edited product failure. The browser harness first attempt also failed before tests because the temporary config resolved its server command under /tmp; its working directory was corrected outside the checkout.

The corrected browser harness reached app build but Playwright stopped it at its 120000ms server-start deadline, before any test began. The server is therefore prepared separately through the unchanged fixture script with a 1200-second hard timeout; the committed journey keeps its own 240000ms test limit and all existing assertions. Pinned Node 22.20.0 project typecheck passed with exit 0.

The external-server browser run passed the full desktop registration. The phone registration failed before ACH, at calculations.spec.ts line 268: its earlier card-return heading was not visible within the unchanged 5000ms assertion timeout. The captured page was still "Returning from Stripe" with "Loading your response…". One phone-only repeat against the warm server uses unchanged assertions and timeouts and a separate artifact directory. The original failure and desktop proof are preserved.

The phone-only full-registration repeat failed before ACH at line 432: the iframe checkout continuation link did not become visible within the unchanged 5000ms assertion timeout. The separate 390-pixel native ACH probe subsequently passed in 28.1 seconds using the unchanged processing helper. No full local mobile or native pass is claimed. Both existing current-main Verify and the earlier full exact-head Verify are successful. No production fix or CI repair round was performed.
