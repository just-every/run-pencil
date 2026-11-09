# Changelog

## 0.2.105

### Business authority and relay privacy

- A Business-sponsored approval saved by an agent door older than rer 0.2.96 (its persisted principal has no `source`) no longer executes after its Business stops. Approval execution now treats a saved principal with no `source`, a non-embedded door and a consent id as Business-admitted, so it is refused as `sponsor_unavailable` once the Business stops or its stop state is unreadable, like an approval saved with a `source`. Local approvals (no `consent`) and embedded approvals are unchanged.
- Code only: no migration is added, and the 0.2.104 migration `0043` is unchanged. Seeds adopting 0.2.105 get this refusal without tagging their saved approval rows.

## 0.2.104

### Business authority and relay privacy

- Business token admission, `person:`/`role:` approver and reviewer references, held Business calls and signed decision-relay pulls now share one fail-closed stop check. They require `people.businessStopped()` to positively return `false`; a missing or non-function reader, a thrown or rejected read, or any other answer refuses Business authority. Tokens receive 401, references match nobody, held calls refuse `sponsor_unavailable`, and relay pulls return empty 404. Adoption conformance covers all four paths after signed detachment with the old policy and trust retained.
- Approval execution audits inherit their original decision's Business relay membership, including no membership, so an old Business's approval cannot enter a newly paired Business's feed. Forward migration `default-seed/migrations/core/0043_agent_door_relay_privacy.sql` replaces the old triggers and removes only provable cross-Business execution memberships while preserving every audit; the current schema in `modules/agent-door/schema/agent-door.sql` includes the corrected triggers.
- Adopting seeds, including Pencil and HappyToHelp, must copy migration 0043 into their own forward migration sequence and implement `people.businessStopped()` from their durable Business stop state. Without a reader that positively returns `false` while running, every Business token, Business `person:`/`role:` reference, held Business call and relay pull is refused. Base's `operatorAuthPeople` already reads durable `bs_settings.stopped`; custom adapters must supply the equivalent reader. Keep `sponsor()` resolving subjects after a stop so signed policy remains adoptable.

### Container archive policies
