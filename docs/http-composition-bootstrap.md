# HTTP composition bootstrap

The composed Billing root now receives HTTP mode before Angular bootstraps it.
Previously it started in demo mode and switched after bootstrap, allowing its
initial render to select the standalone fictional invoice list. The synchronous
legacy source in the composed injector now rejects read/detail access; HTTP
failures remain HTTP error states and cannot display demonstration invoices.

The invoice source token/interface live in a data-free module. The standalone
provider re-exports that same token for compatibility. The composed entry/root
import the data-free port directly, removing the fictional invoice fixture from
the composed dependency graph. The shell still owns HTTP and session capabilities.

## Verification on 2026-11-06

RED tests observed initial mode `demo` and an unrestricted fixture source.
After the fix, all 35 entry tests pass, including initial component state before
the post-bootstrap code runs and rejection of both legacy source methods.
The full suite passed 585 tests. Coverage: lines 91.51%, branches 86.22%; existing
thresholds/exclusions were preserved. Standalone and composed builds passed,
and the official invoice contract projection check passed.

The freshly generated local composed artifact at
`dist/portals/billing/0.1.0-demo/entry.js` contains the HTTP guard and contains
neither the `invoice-001` fixture ID nor the fictional patient-name marker.
Existing immutable release directories were retained. This is source/build
evidence; unavailable browser control still prevents visual acceptance.
