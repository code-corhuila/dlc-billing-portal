# Administrative correction before issuance

The existing DRAFT invoice detail now presents a correction form for pending
items to the authenticated Administrator. It calls the official
POST /api/v1/billable-items/{id}/approvals with exact COP unitPrice, mandatory
reason, expectedVersion and a stable per-intent idempotency key. The server remains
the authority; the Portal never supplies an actor or bypasses session validation.

Repeated clicks are blocked during a request. Ambiguous failures retain the key;
changed input creates a new intent. Item/version changes discard stale input.
Session identity changes and component destruction clear protected reason text.
Successful corrections clear the form and reload the authoritative invoice total
and version. Pending corrections block issuance and dirty forms block navigation.
Issued invoices never render the correction form.

Local validation: 609 tests passed; contract projection check and Angular build
passed. Artifact: /portals/billing/2.0.4-local-20261107/entry.js. Evidence is in the
Billing API target/portal-offline-{full-tests,contract,build}.log files. HTTP
collaborators are isolated in these tests. Real IAM/Gateway/browser acceptance
is explicitly deferred at the user's request. No artifact was published.
