# HU-BIL-002 test baseline

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Requirements: NFR-006, testing-strategy.md, quality-gates.md and definition-of-done.md
in dlc-docs at `638e4f227c318b9e62bc1ce5a152c71414c72d51`.

## Reproduce

Use Node 22 or newer: `npm ci`, `npm run test:coverage`, `npm run build`.
Vitest 4.1.11 and its matching V8 provider measured the baseline on 2026-10-10,
against portal source at `b4c75e1259b09fea957612ad952cec0d30e7d829`.
The measurement configuration is introduced by this maintenance increment.
CI runs the suite with coverage and uploads the HTML and JSON summary as
`billing-coverage`. Local output is ignored under `coverage/`.

## Measured baseline

| Metric | Covered / total | Percentage |
|---|---:|---:|
| Lines | 97 / 235 | 41.27% |
| Statements | 100 / 243 | 41.15% |
| Branches | 38 / 78 | 48.71% |
| Functions | 39 / 91 | 42.85% |
| Current domain utility lines | 10 / 10 | 100% |

All 62 existing tests pass across six files. Coverage includes all `src/**/*.ts`,
including unimported production files; only specs and declarations are excluded.
Empty files and type-only modules contain no executable lines and do not prove
implemented behavior. Templates, CSS and accessibility are not measured.

The global thresholds prevent regression below this measured baseline; they do
not replace the approved overall target of 80%, which remains unmet. Domain
line coverage enforces the approved 90% minimum. Catalog code currently has 0%
coverage and requires meaningful tests in subsequent scoped increments.

## Acceptance limits

These tests exercise local utility/component methods, route configuration and
fixtures. They do not verify rendered UI, owner authorization, persistence,
financial concurrency, HTTP integration or composition lifecycle. This is
maintenance, not a behavior change: no artificial TDD RED is claimed.
Local build passed with exit code 0. A separate gate check overriding global
lines to 80 failed with exit code 1 as expected, while all 62 tests still passed.
CI execution, independent revision-specific DoD review and integrated owner
responses remain pending; this increment does not close the issue or HU.
