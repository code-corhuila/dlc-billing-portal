# Composed invoice payments demo

Related: code-corhuila/dlc-billing-portal#4; code-corhuila/dlc-docs#65 (HU-BIL-003).
Baseline: `e23adba` (merged PR #37). No workflow or deployment configuration changes.

## Scope and authority

Owner clarification for this demo: the first payment must cover at least 50% of the
invoice total including extras, rounded upward to a cent. Subsequent positive payments
may settle the remaining balance. This extends the demo policy; the owner API contract
does not yet specify that minimum and must be aligned before real integration.
Initial snapshots predate the policy; previously recorded amounts are not rewritten.

HU-BIL-003, Billing OpenAPI payment operation/API-FIN-01, and monetary-calculation.md
require positive exact COP payments not above balance, payable ISSUED/PARTIALLY_PAID
states and partial/paid transitions. ADR-011/composition C01-C06 retain shell navigation,
session and HTTP ownership. Approved navigation is `/app/billing/invoices/:invoiceId/payment`.
The owner-approved cut uses fictional frontend data, without domain API calls.
One synchronous demo session wraps the configured invoice source per mount. It shares
local balances/statuses/history with list and detail; unmount/reload resets it.
Initial paid totals are fictional snapshots; displayed history contains new session payments.
Local cents use BigInt and decimal strings. Intent keys deduplicate local records; changed
payloads conflict. Explicit retries preserve the draft key; no automatic retry occurs.
Shared-session UI controls allow Administrator/Secretary-Assistant, without proving backend
authorization. Method strings are demo-only: real clinic configuration remains undefined here.
The session is not a Payment DTO or drop-in asynchronous owner adapter. Actor/time,
expectedVersion, database locking, durable idempotency, emails and PDF require owner integration.
The legacy standalone numeric payment screen is unchanged and is not the composed path.

## Evidence

| Behavior | RED | GREEN | Result |
|---|---|---|---|
| Exact isolated ledger, local duplicate/conflict and invalid inputs | 6593673: missing new module | 39aa163: 5 targeted tests passed | Passed |
| Composed form, payment route, shared balances and navigation | 9469763: missing page module and payment-route behavior | c7d7c77: 36 targeted tests passed | Passed |
| Stable draft key for explicit retry | 87a2111: 1 expected failure | cfc479e: 6 targeted tests passed | Passed |
| Focus after successful submission | a1da6d6: 1 expected failure | 4f1454b: 3 targeted tests passed | Passed |
| Paid/payable counters follow current rows | 0b14d27: 1 expected failure | 0ed60db: 19 targeted tests passed | Passed |
| First payment >= 50% of invoice total; subsequent payments and cent rounding | fd4021a: 2 expected failures across targeted runs | cbbeab6: 7 targeted tests passed | Passed |

179 tests passed in 23 files. Coverage: lines 94.63%, statements 94.37%, branches 95.55%,
functions 93.03%; thresholds/exclusions unchanged. Both final builds passed. Release
publication initially failed with EPERM on staging rename; target/lock were absent and
an explicit retry succeeded. No published artifact was replaced.
Local browser QA used a disposable dlc-front build and synthetic Administrator. Verified
list -> detail -> payment, dirty-form guard, COP 0.01 partial payment, exact remaining
COP 99999.99, final PAID/zero balance, two session history rows and heading focus.
The final counter release confirmed one payable and two paid rows after paying INV-001.
Minimum QA: INV-002 rejected COP 59999.99, accepted COP 60000.00 and showed the subsequent COP 0.01 minimum; `.npm-cache/minimum-deposit-proof.png`.
Ignored screenshots: `.npm-cache/composed-payments-proof.png` and
`.npm-cache/composed-payment-counters-proof.png`. Monthly income remains a fixed demo metric.
Backend responses, full accessibility certification, container runtime and official HU
acceptance are not credited. Independent review remains required. Delivery retains service
`billing-portal-demo`, network `dlc-billing-portal_default` and default entry
`/portals/billing/0.1.0-demo/entry.js`; unique QA releases affect only the disposable registry.
