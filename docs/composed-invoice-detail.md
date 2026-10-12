# Composed invoice detail demo

Related: code-corhuila/dlc-billing-portal#3; code-corhuila/dlc-docs#64 (HU-BIL-002).
Baseline: `567f4df` (merged PR #34). No workflow changes.

## Scope and authority

HU-BIL-002 requires necessary financial charge details without clinical history.
`12-ux-ui/navigation-map.md` specifies `/app/billing/invoices/:invoiceId`.
ADR-011 and frontend-composition.md C01-C04 assign global navigation to dlc-front.
The owner-approved Cut 2 scope is fictional frontend data without domain API calls.
The existing injected source now supplies isolated detail projections as well as rows.
The page receives data and emits a return intent; composition selects the decoded id
and requests navigation through context.navigation. Unknown ids do not select INV-001.
Money remains exact decimal strings; display uses the existing presentation formatter.
Fixture totals are authored demo values, not owner-calculated financial records.
The legacy standalone review screen is unchanged; this increment targets composition.

## Evidence

| Behavior | RED | GREEN | Result |
|---|---|---|---|
| Exact, isolated detail fixtures matching list rows | de5828e: 2 failures, missing detail method | 557c8bd: 3 targeted tests passed | Passed |
| Route selection, missing ids, replacement source, composed return and disposal | dbaabde: 7 failures, missing selection/return behavior | b666101: 32 targeted tests passed | Passed |

Full validation: 160 tests passed in 17 files; lines 93.57%, statements 93.40%,
branches 93.70%, functions 90.67%. Coverage exclusions and thresholds are unchanged.
`npm run build` and `npm run build:portal` passed. The full suite also checks the
self-contained ESM release and existing lifecycle/navigation regressions.
Browser QA used a disposable copy of the existing dlc-front build, synthetic session
and release `0.1.0-detail-qa-1c418ae76a8d49cd9563a3b11c19a6cc`.
Confirmed INV-001 (two charges, COP 130.000,00), return to list, INV-002
(COP 120.000,00), and direct missing-id navigation. The shell initially displayed its
recovery frame; explicit Update restored mounting. Its cause remains unverified.
Screenshot: ignored `.npm-cache/composed-invoice-detail-proof.png`.

## Remaining work

No issuance, payment, PDF, owner authorization, persistence or backend integration
is credited. Async loading/failure/cancellation states require the future owner adapter.
Procedures/catalog composition and dummy operations are the next separate increment.
Real shell release selection, final responsive/keyboard/focus audit, independent review
and official HU acceptance remain pending. This browser run is local demo evidence.
