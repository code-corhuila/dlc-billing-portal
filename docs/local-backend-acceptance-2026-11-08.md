# Local Billing backend acceptance

Billing Portal 2.1.0 is connected to actual IAM, Gateway and Billing APIs at
`http://localhost:8080`. Actual Appointments API validates the terminal appointment
state during draft creation. This supersedes the earlier interfaces-only limitation
in the initial publication report; protected branches and production are unchanged.

## Verified behavior

- Real IAM login and authenticated invoice, procedure-price and additional-rule reads.
- Real invoice draft creation and issuance, using explicitly synthetic stored source facts.
- A first payment of COP 5.00 on COP 10.01 returns 409 `INITIAL_PAYMENT_BELOW_MINIMUM`.
- Payments of COP 5.01 and then COP 5.00 succeed; the invoice becomes PAID with zero balance.
- Current invoice PDF is served by Billing API.
- Real logout revokes the session; Billing rejects its saved access token with 401.
- Chromium exercised login, issuance, both payments, three PDF downloads and logout
  through the composed interface, without intercepting API responses or inserting sessions.
- After recreating all eight backend services under Docker Compose, login, authenticated
  reads and session revocation still pass. Database storage is on an independent named volume.
- Local private-service credentials are renewed atomically every two minutes with a
  ten-minute lifetime. Staff credentials are issued by actual IAM login.

## Demo cleanup

At the user's request, the two synthetic invoices, four payments, source items,
encounter accounts, related events/idempotent responses and synthetic appointments
were removed from this isolated database. The administrator access and payment-method
configuration remain. Authenticated reads of invoices and both catalogs return
HTTP 200 with empty data and total zero. No test scenario was rerun after cleanup.

## Local operations and boundaries

The generated interface Compose file remains under `.publication/local/compose.json`.
The backend Compose file, credentials, signing material and rollback backup remain in
the ignored private local directory. None is committed or included in this report.

Use the local README and existing private Compose configuration to start/stop the
installation; do not rerun provisioning or financial scenario scripts to restart it.

This acceptance uses local identities and source facts, not production data or a
complete Clinical producer workflow. Patients and Appointments interfaces still use
their earlier demo releases, independently of this Billing database cleanup. Clinical
API, SMTP delivery, Worker delivery and production TLS/credential provisioning remain
outside this local installation. There is no claim of production readiness.

Coordinated publication: [Billing API #15](https://github.com/code-corhuila/dlc-billing-api/pull/15),
[Billing DB #8](https://github.com/code-corhuila/dlc-billing-db/pull/8) and
[Billing Portal #114](https://github.com/code-corhuila/dlc-billing-portal/pull/114).
