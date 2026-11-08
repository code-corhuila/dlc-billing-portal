# Publication and local interface deployment ? 2026-11-07

The requested changes are published as reviewable pull requests. They are not merged into protected branches or promoted to production.

| Repository | Pull request | Target |
|---|---|---|
| Billing Portal | https://github.com/code-corhuila/dlc-billing-portal/pull/114 | develop |
| Billing API | https://github.com/code-corhuila/dlc-billing-api/pull/15 | develop |
| Documentation | https://github.com/code-corhuila/dlc-docs/pull/165 | main |
| Clinical Portal | https://github.com/code-corhuila/dlc-clinical-portal/pull/133 | develop |
| Shell | https://github.com/code-corhuila/dlc-front/pull/116 | develop |

## Local Docker deployment

At the owner's explicit request this deployment contains interfaces only. No business API, authentication provider, simulated authenticated session or database migration was activated. Previously stopped containers and the existing PostgreSQL instance were preserved.

- Compose project: `dlc-billing-audit-local`.
- Shell: http://localhost:8080
- Billing assets: http://localhost:4204/portals/billing/2.1.0/entry.js
- Clinical assets: http://localhost:4173/portals/clinical/0.1.0/entry.js
- Only loopback ports are exposed. Six interface containers share a separate local network.
- Billing 2.1.0, the updated real Clinical build, and the current shell image are used. Existing IAM/Patients/Appointments interface images provide the other entries; Patients and Appointments are their existing demo releases.
- The local deployment registry selects Clinical 0.1.0 and Appointments 0.1.0-demo to match those image files. This does not change the product registry's release policy for unrelated portals.
- HTTP checks passed for the shell, health route, registry and all five remote entries, plus Clinical CSS, with status 200 and no-store. Login and financial operations remain unavailable until the real backend/auth configuration is provided.

On this workstation, the retained generated configuration and HTTP evidence are under `.publication/local/` (intentionally untracked):

```powershell
docker compose -f .publication/local/compose.json ps
docker compose -f .publication/local/compose.json stop
docker compose -f .publication/local/compose.json up -d
```

## Publication checks

- Billing Portal: 626 tests passed, contract snapshots checked, standalone/composition builds and Docker/Nginx checks passed.
- Billing API: Maven tests passed on the isolated publication branch. Earlier verification ran 27 actual transaction tests without skips against disposable PostgreSQL.
- Clinical: after integrating origin/develop, 354 tests passed and typecheck/production builds passed. Lint, global formatting, scoped commit subjects, size and architecture gates pass locally. The task-owned branch history was compacted into one scoped feature commit, with the original publication saved in a local backup branch; the push used an exact remote-SHA lease.
- Shell: 212 tests passed, typecheck/build/Docker build/lint/global formatting pass. Coverage: lines 99.47%, branches 91.71%, functions 96.30%. Commit/size/architecture gates pass. One inherited Auth adapter received formatting only to satisfy the global check.
- The documentation validator mentioned by CONTRIBUTING.md is absent in the documentation checkout; a successful run is not claimed. The modified Billing contract parses and matches both portal projections; payment acceptance traceability is included.
- GitHub Actions reported immediate failures for interface PRs without allocating a runner or executing steps (runner_id=0, empty steps, no downloadable job logs). A green remote CI result and independent review are still required. No failing check or branch protection was disabled or bypassed.

The original working directories and unrelated local API/DB changes were preserved. Publication work used isolated worktrees under `.publication/`.

## Final follow-up

- Clinical coverage completed successfully on published source `4380ca9445112a15cafd48893b850ac60226a172`: 354 tests, 97.18% lines, 95.64% statements, 91.95% branches and 97% functions; the two remote packaging tests also passed.
- The shell incorporated a later develop update for the Patients release. Both appended evidence sections were preserved, both deployment registries retain Billing 2.1.0, 213 tests pass and global formatting passes. The local runtime registry continues selecting the already available interface images, independently of the product registry.
