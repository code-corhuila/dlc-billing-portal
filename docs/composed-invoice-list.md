# HU-BIL-002 composed invoice-list demo

Historical evidence for the original list increment. Current source configuration and exact monetary types are described in [invoice-source-contract.md](invoice-source-contract.md).

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Base: develop `1ddce33`. This is a Cut 2 fixture increment, not HU acceptance.
Contracts: ADR-011; frontend-composition.md C02-C04; design-system.md; Billing OpenAPI GET /api/v1/invoices and PARTIALLY_PAID vocabulary.

The root renders the existing invoice list at localPath `/`; unknown routes retain a local 404/unavailable frame. No shell frame, main landmark, HTTP client, session or token management is duplicated.
The page receives rows through @Input and has an empty default; it imports fixture types only. The composition root chooses the synchronous dummy source and binds cloned rows. The standalone route resolves rows using withComponentInputBinding, configured only in the legacy standalone app; the composition adapter provides no router.
No DI token is needed in the presentation page to replace its input. The asynchronous owner adapter remains future work; the synchronous fixture interface is not claimed to implement HTTP integration.
Search, filters and pagination remain local. Numeric COP amounts and fixed summary metrics are demo view representations, not decimal-string API payloads or calculated owner totals.
Invoice selection uses context.navigation. A repeated pending target is ignored; another target may supersede it, as C02 permits. Only the latest request may update messages or report failures. Cancellation and Angular destruction also discard late work.

| Behavior | RED | GREEN |
|---|---|---|
| Root list and compositor navigation | `08addd3`: three missing-behavior failures | `b1f4f8a`: 30 targeted tests passed |
| PARTIALLY_PAID state | `9e0b4bd`: two vocabulary/filter failures | `29c8da7`: 16 list tests passed |
| Destruction with a live context signal | `d2c98d3`: two late-write failures | `8290ac8`: DestroyRef guards; 20 root tests passed |
| Source choice at composition boundaries | `adf55aa`: page default, standalone resolver and root rows missing | `4ba3a11`: 44 targeted tests passed |
| Duplicate/obsolete navigation | `465d065`: duplicate pending target dispatched twice | `b326d32`: 22 root tests passed, including ignored superseded results |

Regression `48b7291` verifies late abort settlement and supplied rows without an artificial RED. Tests use real Angular injection-scope destruction, not a browser disposal assertion. Fixture reads clone rows; tests assign inputs explicitly.
Final suite: 128 tests passed across 11 files. Source coverage: 93.53% lines, 93.45% statements, 92.79% branches, 89.71% functions; current domain utilities retain 100%.
Application build passed; the coverage suite also compiles and audits an actual inert AOT release. Coverage rules and exclusions are unchanged. Scripts are outside the source coverage metric.

Original browser evidence used a disposable shell dist/fixtures copy, its actual proxy/compositor and a QA registry selecting the Billing release. Shell build provenance was not revalidated.
Verified mount, search, partial-payment filter, pagination, empty results, keyboard focus, pending-detail navigation/404 and return via global navigation. Checked 1280x800 and 390x844 layouts with horizontal table containment.
Screenshot: ignored `.npm-cache/composed-invoice-list-proof.png`. This evidence predates the final source-boundary adjustment and is not deployment or API acceptance.
Final source-boundary check rebuilt QA release `0.1.0-input-boundary-qa-0e65faa7a4354c2a85a97f27dd734209`, then verified populated rows and search in the same disposable shell. Snapshot: ignored `.npm-cache/invoice-source-boundary-proof.png`. No real shell registry was edited.

Review decisions: source selection now belongs to composition; navigation allows a different target instead of blocking all clicks. English identifiers/comments/docs are retained; existing Spanish UI is localized product copy, not a new i18n framework.
The list's original money debt is addressed in the source-contract follow-up; other legacy pages and the future owner adapter still require alignment.
Pending: publish/select a retained release in the real shell, compose detail/issuance/payments and /procedures, align legacy models, implement owner HTTP loading/validation/forbidden/failure states, verify containers/CI and obtain independent acceptance.
No API response, persistence, authorization, clinical narrative, PDF download or completed HU is claimed.
Suggested PR title: `feat(billing): compose invoice list for cut 2 demo`.
