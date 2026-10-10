# HU-BIL-002 composition lifecycle increment

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Specification: ADR-011 and frontend-composition.md C01-C04/C07 at docs `638e4f2`.
Base: develop `24dcfd5`; production revision: `bfca56d`.

## TDD evidence

| Behavior | RED revision and observed failure | GREEN revision and result |
|---|---|---|
| Inert Billing v1 identity | `36ddaab`: entry module absent, 1 failure | `f563efa`: 1 test passed |
| Owned mount, cancellation and cleanup | `c891136`: mount absent, 8 failures | `ba342f6`: 9 tests passed |
| Memory route updates and local frame | `4b0a52c`: handle/frame members absent, 3 failures | `ef96d3a`: 12 tests passed |
| Retained cleanup rejection | `d9bd215`: unmount resolved instead of rejecting, 1 failure | `bfca56d`: 14 tests passed |

The safe-render-error case is a regression test of existing error-handler wiring.
Runtime contract tests replace createApplication and DOM references with fixtures;
frame policies additionally exercise Angular dependency injection and signals.
They do not constitute a real browser mount or integrated shell acceptance.

## Validation

At `bfca56d`, `npm run test:coverage`: 76 tests passed in seven files.
General line coverage: 48.50%; current domain utility lines: 100%.
Entry line coverage: 100%; entry branch coverage: 90%.
`tsc --noEmit -p tsconfig.app.json` passed, including the entry source.
`npm run build` passed with exit code 0; it validates the existing development build.
The approved 80% general target remains unmet. No dependency or API changes.

## Delivery and acceptance limits

Only local `/` currently renders the explicit Billing-unavailable frame; other
local paths render 404. Domain screen wiring is a subsequent increment.
There are no forms, so canLeave permits a live mount and denies a disposed one.
The adapter consumes no session data or HTTP and creates no global router.
Importing src/portal-entry.ts does not bootstrap the application. Its mount
creates an owned child/application and its handle removes only those resources.
Abort forces cleanup; repeated unmount preserves the same result or rejection.

The entry is source-only. Independent ES-module bundling as release entry.js,
registry/deployment wiring, actual browser/Angular cleanup, CSS/focus checks and
real dlc-front integration remain pending. The existing standalone/federation
development build is unchanged and is not composition-v1 release evidence.
Unsaved-form vetoes must be implemented before domain forms enter this path.
Independent revision-specific review and remote CI remain pending. Neither
the portal issue nor the HU is complete; no push or promotion is included.
