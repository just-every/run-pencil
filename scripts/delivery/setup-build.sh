#!/usr/bin/env bash
set -euo pipefail
# Trusted delivery selects the project Node pin before this source-only preparation.
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
