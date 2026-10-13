# Maintaining your Pencil installation

Follow [AGENTS.md](AGENTS.md) for source changes and verification, [README.md](README.md) for local startup and [OPERATIONS.md](OPERATIONS.md) for data recovery. [Hosting](docs/HOSTING.md) documents production configuration.

Upstream source is https://github.com/just-every/run-pencil (`main`). All source is editable under the MIT license. Preserve your customizations, applied migrations and requirements when adopting upstream changes. Prepare updates away from live data and test recovery first. The first-release profile defers ANLY-009 (builder assistance), NOTIFY-001 and NOTIFY-003 (3 clauses); passing its gate does not satisfy the full contract.
