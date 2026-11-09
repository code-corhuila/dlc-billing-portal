# Changelog

All notable changes to this project are documented in this file.

The format follows the principles of Keep a Changelog and Semantic Versioning.

## [2.1.0] - Unreleased

### Added

- "Pendientes de precio" (Admin and Secretary/Assistant) lists encounters still waiting for a price through `GET /api/v1/encounter-accounts/pending-prices`, with the missing codes and the date the price must be valid from (ADR-015 decision 6).

- Draft invoice creation from patient-filtered, paginated UNBILLED items, with server-owned totals and idempotent retries.
- HTTP price versioning, remote pagination for invoices/prices/rules, and composed navigation to rules/draft creation.
- Operation/schema contract snapshot, explicit CI contract check, and audit remediation evidence.

### Fixed

- The draft invoice and "Pendientes de precio" render results that arrive after a request in the zoneless portal (`markForCheck`); before, they stayed on "Consultando...".

- The draft invoice finds the patient by name or document through the Patients search (`GET /api/v1/patients`, active only) instead of asking for the raw patient UUID; selecting a patient loads the pending charges.
- Paged reads (invoices, prices, rules, payments) and billable-item lookup send page, limit and patientId as the compositor `query` (C06) instead of inside the path, so "Actualizar", pagination and "Consultar cargos" reach the API.
- Clear protected data/drafts and reject stale results after identity or permission changes.
- Preserve price-creation retry keys and close confirmed forms even when catalog reload fails.
- Align the first-payment minimum at 50% rounded upward to a cent across Portal, Billing API and documentation; retain older payment history.
- Align package/build/Docker and the local shell descriptor to candidate Billing 2.1.0.
- Replace obsolete scaffold documentation and unavailable-detail/payment messaging.

### Validation

- 626 Portal tests in 67 files passed; line coverage 92.69%, statements 90.75%, branches 86.43%, functions 93.05%.
- Clinical: 344 tests passed and production build passed, including contextual navigation from recorded extras to Billing (source identifiers only).
- Billing API offline Maven suite passed; 27 actual JDBC transaction tests passed without skips against disposable PostgreSQL.
- Shell registry/proxy checks: 13 tests passed. No deployment or production acceptance is claimed.
- Standalone/composition builds and Docker candidate built; disposable Nginx smoke checks passed for GET/HEAD, no-store, JavaScript MIME and missing assets. Artifact/image hashes are recorded in docs/release-2.1.0-evidence.json.

## [2.0.0] - 2026-10-13

### Added

- Billing portal release package for version `2.0.0`.
- Procedure and pricing catalog management.
- Support for creating dental procedures separately from their dated price versions.
- Invoice listing and invoice detail views.
- Payment registration workflow.
- Billing composition entry point for integration with the transversal frontend.
- Automated tests for Billing domain, presentation, catalog, payments, contracts, composition, and release tooling.
- Docker-based delivery for the Billing portal.
- Release artifact generation at `/portals/billing/2.0.0/entry.js`.

### Changed

- Improved procedure catalog versioning rules.
- Separated procedure creation from dated price version creation.
- Updated Billing release publication workflow.
- Improved atomic publication of generated portal artifacts.
- Improved Docker release configuration for the Billing `2.0.0` artifact.

### Fixed

- Fixed Billing release generation so Docker publishes version `2.0.0` instead of the demo release identifier.
- Fixed release-directory permissions so Nginx can serve the published Billing artifact correctly.
- Added regression coverage for Docker release configuration and release publication permissions.

### Validation

- Full automated test suite validated successfully.
- 25 test files passed.
- 187 tests passed.
- Billing Docker image built successfully.
- Billing release artifact verified through Nginx with HTTP `200 OK`.

### Release

- Version: `v2.0.0`
- Target branch: `main`
- Release flow: `develop -> qa -> main`
