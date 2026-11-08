# Native health probes at d85088cdbdc290e1f739df7cdfa7ed0632bc0296

PROBE AGENT-005 1: GET /api/app/actions/{actionId}/health after a real task receiver 500 and native owner DELETE -> failed task with exact action, key and attempt IDs plus no_owner reminder state and bounded operator repair instructions. The existing task registration invokes brokenActionHealth; helper lines 45 to 103. The focused four-test runtime run passed.

PROBE AGENT-005 2: GET the same health door without a session, from a foreign workspace, with a revoked session and with the deleted owner's session -> 401, 404, 401 and 401; no action ID, workspace ID, private rationale or task key disclosed. Helper lines 65 to 81; focused runtime run passed.

PROBE AGENT-005 3: Repeated authorized GET health -> identical report, unchanged six native tables and no outbound fetch. Helpers lines 27 to 40, 63 to 81 and 118 to 125. Focused runtime run passed.

PROBE AGENT-005 4: Native retained failed and unknown reminder occurrences, including a failure behind 31 later sent rows -> exact retained occurrence IDs and safe repair instructions; a later scheduler tick does not resend unknown reminders. Helper lines 105 to 140 and reminder registration lines 109 to 118. Focused runtime run passed.

PROBE AGENT-005 5: Existing POST task retry after receiver recovery -> original confirmed payload and original key, one remote task; after owner change, retry and old payload confirmation -> 409 with no send; only fresh explicit confirmation sends the changed payload. Task registration lines 30 to 63 and helper lines 87 to 101. Focused runtime run passed.

PROBE AGENT-005 6: Mail unavailable configuration at the health door -> unavailable schedule with repair-mail instructions and no sender address or credential disclosure. Helper lines 128 to 140. Focused runtime run passed.
