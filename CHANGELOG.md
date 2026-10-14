\# Changelog



All notable changes to this project are documented in this file.



The format follows the principles of Keep a Changelog and Semantic Versioning.



\## \[2.0.0] - 2026-10-13



\### Added



\- Billing portal release package for version `2.0.0`.

\- Procedure and pricing catalog management.

\- Support for creating dental procedures separately from their dated price versions.

\- Invoice listing and invoice detail views.

\- Payment registration workflow.

\- Billing composition entry point for integration with the transversal frontend.

\- Automated tests for Billing domain, presentation, catalog, payments, contracts, composition, and release tooling.

\- Docker-based delivery for the Billing portal.

\- Release artifact generation at `/portals/billing/2.0.0/entry.js`.



\### Changed



\- Improved procedure catalog versioning rules.

\- Separated procedure creation from dated price version creation.

\- Updated Billing release publication workflow.

\- Improved atomic publication of generated portal artifacts.

\- Improved Docker release configuration for the Billing `2.0.0` artifact.



\### Fixed



\- Fixed Billing release generation so Docker publishes version `2.0.0` instead of the demo release identifier.

\- Fixed release-directory permissions so Nginx can serve the published Billing artifact correctly.

\- Added regression coverage for Docker release configuration and release publication permissions.



\### Validation



\- Full automated test suite validated successfully.

\- 25 test files passed.

\- 187 tests passed.

\- Billing Docker image built successfully.

\- Billing release artifact verified through Nginx with HTTP `200 OK`.



\### Release



\- Version: `v2.0.0`

\- Target branch: `main`

\- Release flow: `develop -> qa -> main`

