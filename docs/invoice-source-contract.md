# Invoice source and contract projection

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Base: develop `9e9b06f`; branch `chore/invoice-source-contract`. Dummy frontend only.
Authority: dlc-docs main `18813df4fca61f2d858edcbf6d873d507ef6729f`, verified through the GitHub connector. Projection pointers: `07-api/contracts/openapi/billing-service.yaml#/components/schemas/Invoice/properties/status` and `_shared.yaml#/components/schemas/Money`.

Both entry points inject INVOICE_LIST_SOURCE. A shared provider helper selects the default fixture once in configuration; neither the page nor either consumer imports that concrete default. Custom compatible sources are supplied through the same token in the portal-owned injector, not a shell injector. The port remains synchronous for this cut; asynchronous coordination and owner HTTP states are future work.
InvoiceListItem is a neutral presentation model, not an owner Invoice DTO. Its status derives from generated contract constants; its COP amount is a validated decimal string. Fixture reads clone rows. All list amounts and its fixed fictional summary retain two decimal places. Formatting groups the whole part as BigInt and preserves cents; no Number/parseFloat conversion, rounding or financial arithmetic is introduced.

The JSON projection is generated from the reviewed YAML with js-yaml 4.3.2, already present transitively and now declared directly for tooling. No package versions were upgraded or test runner migrated. Generated constraints must not be edited manually.
`npm run contract:check` checks generated constraints against the committed projection. Its regression test runs in the existing Vitest suite; the workflow is unchanged.
`node scripts/invoice-contract.mjs --check <authorized-docs-root>` also checks those fields against an available documentation checkout.
`node scripts/invoice-contract.mjs --refresh <authorized-docs-root> <reviewed-40-character-sha>` refreshes the projection and generated file together after specification review.
The docs repository is private: automatic comparison with its latest main is not configured. The offline guard detects divergence from the pinned projection, not unseen upstream changes. Reviewers must verify current docs before an owner-adapter increment. This projection covers money/status only, not a complete response validator, authorization or endpoint compatibility.

| Behavior | RED | GREEN |
|---|---|---|
| Shared source substitution | `2de1264`: source configuration absent | `81e3c4c`: 29 targeted tests; one configured replacement serves both consumers |
| Contract generation/drift detection | `b32a1c7`: generator absent | `1e81c01`: three tool tests; generated file and fresh docs projection matched |
| Decimal money and list model | `5289bb8`: 15 helper/list failures | `a65c219`: 30 targeted tests passed |
| Primitive string validation | `aed728a`: number/object coercions accepted | `9557fdd`: 15 money tests passed; invalid strings remain regression cases |

Final coverage: 147 tests passed in 14 files; 93.75% lines, 93.67% statements, 93.10% branches, 90.00% functions. Current domain utilities, including money helpers, retain 100% coverage. Include/exclude rules are unchanged; tool scripts remain outside this source metric.
Application build and composition release build passed. npm 10.9.9 clean-install dry-run passed; this does not claim a completed clean installation or green CI.
Browser verification used a disposable shell dist/fixtures copy and QA descriptor; list mount, exact COP display, search and restoration passed. Release: `0.1.0-source-contract-qa-1099a5f68acf4ec59efb46bed348992c`. Snapshot: ignored `.npm-cache/invoice-source-contract-proof.png`. Shell build provenance and real deployment were not revalidated.
No real registry changes, API requests, events, tokens, database changes, workflows or promotions are included. Backend authorization, transaction rules, persistence and owner totals are not proven. Other legacy billing pages still need model alignment; detail/payment/PDF composition, container/CI verification and independent acceptance remain pending.
