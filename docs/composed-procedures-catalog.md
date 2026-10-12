# Composed procedures catalog demo

Related: code-corhuila/dlc-billing-portal#2; code-corhuila/dlc-docs#63 (HU-BIL-001).
Baseline: `901d928` (merged PR #35). No workflow changes.

## Scope and contracts

Reuse the existing catalog at `/app/billing/procedures`, selected by the shell registry.
ADR-011/frontend-composition.md C01-C05 retain global navigation and session ownership
in dlc-front. HU-BIL-001 requires positive COP prices, versions and preserved history.
Billing OpenAPI `/procedure-prices` defines shared Money strings and administrator-only
creation. The composed UI consumes shared session changes to gate demo editing;
this is not evidence of backend authorization. The standalone legacy demo remains isolated.
ProcedurePrice is a fictional display projection, not the owner Price DTO: names,
date-only validity and local active/history flags are not owner payload compatibility.
Overlap enforcement, timestamp validity, auditing and concurrent version authority remain
backend responsibilities. No domain API, HTTP client, tokens or domain events are added.

## Behavior and validation

Prices use canonical positive decimal strings and the shared presentation formatter.
Application-scoped dummy state survives local route changes, but not unmount or reload.
Submission captures form values, ignores duplicate sends, and cancels its timer on disposal.
An open form blocks canLeave until saved or cancelled. The form stays in the portal's
normal document flow; it is not a global modal. Extra-rule composition remains pending.

| Behavior | RED | GREEN | Result |
|---|---|---|---|
| Exact prices, retained versions, single submission and disposal | aa8d358: 3 expected failures | 618ea19: 20 targeted tests passed | Passed |
| Composed route and open-form leave guard | 5430813: 2 failures, 22 passes | 8ca3820: 44 targeted tests passed | Passed |
| Shared-session editing, revocation and subscription cleanup | 653c19c: 3 new expected failures across targeted runs | 87c54dc: 55 targeted tests passed | Passed |

Full suite: 168 tests passed in 19 files. Coverage: lines 93.67%, statements 93.45%,
branches 94.00%, functions 91.26%; thresholds/exclusions unchanged. Both builds passed.
Browser QA used a disposable dlc-front build and synthetic Dentist/Administrator sessions.
Verified disabled creation for Dentist, search, guarded navigation with an open form,
Administrator creation of PROC-001 v2 at COP 90.000,01, unchanged v1 at COP 80.000,00,
and retention after switching to invoices and back. Screenshot is ignored locally at
`.npm-cache/composed-procedures-proof.png`. This is local frontend integration evidence.

## Deployment and remaining work

Existing packaging is unchanged: service `billing-portal-demo`, generated default network
`dlc-billing-portal_default`, default entry `/portals/billing/0.1.0-demo/entry.js`, contract v1.
Compose configuration was checked; no container image or runtime validation is claimed.
The uniquely named QA release changes only the disposable registry, not shell delivery.
Extra-charge rules, final accessibility audit, deployment verification, real owner integration
and independent acceptance remain pending. This increment does not complete HU-BIL-001.
