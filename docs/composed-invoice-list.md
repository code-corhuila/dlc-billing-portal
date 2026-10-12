# HU-BIL-002 composed invoice-list demo

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Base: develop `1ddce33`. This is an enabling Cut 2 fixture increment, not HU acceptance.
Specifications: ADR-011; frontend-composition.md C02-C04; design-system.md;
Billing OpenAPI GET /api/v1/invoices and canonical PARTIALLY_PAID vocabulary.
No domain API is called; owner authorization, persistence and financial rules are not proven.

The composition root selects the existing invoice list at localPath `/`.
Unknown routes retain a local unavailable/404 frame. The page does not duplicate
the shell frame or main landmark. Its composed actions emit an invoice ID to the root,
which requests navigation through context.navigation. Legacy standalone RouterLinks
remain only in the non-composed branch; no router is provided by the composition adapter.

The replaceable synchronous InvoiceListSource returns cloned fictional rows.
The page also accepts an invoices input. Numeric COP amounts and fixed summary
metrics remain demo representations, not API decimal-string payloads or calculated owner totals.
Search, status filtering and pagination retain their existing local behavior.
There is no asynchronous read, so domain loading/HTTP failure/forbidden states
remain for the future owner adapter rather than simulated backend acceptance.

| Behavior | RED | GREEN |
|---|---|---|
| Root list selection and compositor navigation | `08addd3`: three tests failed for missing selection/output/navigation | `b1f4f8a`: 30 targeted tests passed |
| Contract partial-payment state | `9e0b4bd`: two tests failed for PARTIAL/unsupported filter | `29c8da7`: 16 list tests passed; fixture isolation is regression evidence |

Final coverage suite: 118 tests passed in 11 files. Lines 93.35%, statements 92.94%,
branches 91.00%, functions 89.52%; current domain utility coverage remains 100%.
The suite builds and audits an actual AOT release. The standalone build passed.
Explicit release build passed for `0.1.0-invoice-list-final-188139d1216446e09a79bedd5d13a6c8`.
The final suite rebuilt the subsequent fallback-landmark refinement.

Browser evidence used a disposable copy of dlc-front dist/fixtures with its actual
preview proxy/compositor and a QA registry selecting the new release. Verified list
mount using an existing shell dist snapshot; its build provenance was not revalidated.
Verified search, partial-payment filter, pagination, empty results, keyboard focus,
navigation to the pending detail/404, and return through global navigation.
Checked 1280x800 and 390x844 layouts; the narrow table remains horizontally contained.
Screenshot: ignored local `.npm-cache/composed-invoice-list-proof.png`.
This is fixture composition evidence, not deployment or API integration acceptance.

Pending: publish/select a new retained release in the real shell registry, compose
invoice detail/issuance and payments, wire /procedures, owner HTTP states, container/CI
verification and independent review. Other legacy pages still need status/model alignment.
No issuance, PDF download or complete HU acceptance is claimed.
