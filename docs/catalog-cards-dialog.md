# Catalog cards and price dialog

Related: dlc-billing-portal#2 / dlc-docs#63 (HU-BIL-001).
Baseline: `30b8927` (merged PR #36). Visual references: owner-supplied catalog
cards and new-procedure dialog images, Figma node `228:984`.

## Approved adaptation

Use three/two/one-column price cards, teal actions, a search field and a current-price
checkbox. Cards retain exact COP amounts, code, version, validity and historical state.
HU-BIL-001/OpenAPI price-version requirements take precedence over clinical catalog
reference fields: no procedure deletion, clinical description or duration is introduced.
Editing creates a new price version, retaining history; it does not mutate an old price.
The owned native dialog supplies a modal backdrop, focus containment and Escape handling.
Pending submissions retain the existing cancellation guard. Saving focuses the stable
New price button because the original card can disappear from the current-only filter.
Shared-session controls and the injected application-scoped dummy service are retained.

## Evidence

| Behavior | RED | GREEN | Result |
|---|---|---|---|
| Current-only filter combined with search; retained history | aab2c6b: 1 expected failure | 1985fce: 23 targeted tests passed | Passed |
| Owned dialog and active-price version editing | d8f7529: 2 expected failures | 3485621: 25 targeted tests passed | Passed |
| Stable focus after version submission | 4e08e9f: 1 failure, 1 pass | 48aac64: 2 targeted tests passed | Passed |

Full suite: 171 tests passed in 21 files. Coverage: lines 93.93%, statements 93.75%,
branches 94.40%, functions 91.40%; thresholds and exclusions unchanged.
The normal Angular build and final composition release build passed.
Local browser QA used a disposable dlc-front build with a synthetic Administrator:
three-column cards, modal autofocus/backdrop, Escape and focus restoration, editing
PROC-001 to COP 95.000,01, revealing retained v1 via the checkbox, and one-column mobile
cards. The final modal fit within the mobile viewport; saving focused New price.
Ignored screenshot artifacts: `.npm-cache/catalog-cards-proof.png`,
`.npm-cache/catalog-dialog-proof.png`, plus mobile captures. No full accessibility
certification or backend authorization/integration is claimed.

Docker aliases/network/default entry, composition contract, shell source and workflow
are unchanged. QA release paths are temporary; delivery retains
`billing-portal-demo`, `dlc-billing-portal_default`, `/portals/billing/0.1.0-demo/entry.js`.
Additional-rule composition, real deployment verification and independent acceptance
remain pending. No duration, clinical-description or deletion behavior is credited.

## Procedure creation vs. price versions

Owner review found that "+ Nuevo precio" with a free code silently superseded an
existing procedure and that a future-dated version became current immediately.
Billing OpenAPI `POST /procedure-prices` is one "Create price version" operation whose
validity cannot overlap per procedure and closes the previous validity; the demo now
mirrors that in two explicit entry points:

- **+ Nuevo procedimiento** creates version 1. Codes are trimmed and upper-cased; an
  existing code is rejected with guidance to version it from its card.
- **Card action (✎)** is enabled only on the latest version. Code and name are read-only;
  "Vigente desde" must be after the latest version's start. The previous version gets
  `validTo` = new start minus one day.
- Status is derived from dates against today: Vigente, Programado (future) or Histórico.
  The filter "Solo vigentes y programados" hides only historical versions.
- The amount error appears only after the field is touched.

The stored `active` flag was replaced by `validTo`. Date-only validity remains a display
simplification of the owner Timestamp; overlap and concurrency authority stay in Billing.

| Behavior | RED | GREEN | Result |
|---|---|---|---|
| Distinct creation, duplicate rejection, non-overlapping dated versions, derived status | e4f19d3: 6 expected failures | 185 tests passed in 24 files | Passed |

Coverage: lines 94.71%, statements 93.94%, branches 93.75%, functions 93.02%.
Normal Angular build and portal release build passed. Browser QA not yet performed.
