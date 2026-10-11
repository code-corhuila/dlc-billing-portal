# HU-BIL-002 independent composition release

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Specification: ADR-011 and frontend-composition.md C01-C03 at docs `638e4f2`.
Base: develop `2f1cb4f`. No API connections or new dependencies are introduced.

## Build and serve

Run `npm run build:portal`, then `npm run serve:portal`.
Default entry: `dist/portals/billing/0.1.0-demo/entry.js`.
Preview URL: `http://localhost:4204/portals/billing/0.1.0-demo/entry.js`.
`BILLING_RELEASE` overrides the release; `PORT` overrides the preview port.
The preview and standalone application use the same default port; run one at a time.

The Angular application builder compiles only the composition entry into an ES
module and bundles its framework. There are no import maps or shared runtimes.
The entry is inert on import and is renamed from main.js after compilation.
Builds reject any existing release directory, including local unpublished ones.
Use a new `BILLING_RELEASE` for each build and retain referenced releases.
Exclusive directory creation prevents a destination created during compilation
from being overwritten. A failed copy can leave an incomplete directory; do not
publish it. Deployment must also prevent replacing previously published assets.
In PowerShell, set `$env:BILLING_RELEASE = '0.1.1-demo'` before building a new version.
The Node static service is a local development preview, not a production server.
It accepts GET/HEAD, sends no-store and returns real 404 responses for missing files,
400 for malformed URL encoding and 500 for unexpected asset read failures.
Deep links belong to the shell; the asset service has no index.html fallback.

## Container handoff

`deploy/compose.yml` defines `billing-portal-demo`, HTTP port 80 internally and
host port 4204 by default (`BILLING_PORT`). Its network is `dlc-billing-portal_default`.
The final nginx image contains only versioned portal assets, not source or specs.
The build stage uses Node 22; this does not change dlc-front's Node 24 toolchain.
`docker compose -f deploy/compose.yml config` validates the configuration.
Image build, nginx runtime and container/network checks remain pending because
Docker Desktop was not running during this increment.

The separate dlc-front increment must update its registry descriptor to release
0.1.0-demo and entryUrl `/portals/billing/0.1.0-demo/entry.js`, add a same-origin
proxy for Billing to preview/nginx, and join the Billing network for Docker.
Proposed upstreams: local preview `http://localhost:4204`; Docker `http://billing-portal-demo`.
Keep existing visibility rules; `/procedures` still needs domain screen wiring.

## Revision-specific evidence

| Behavior | RED and expected failure | GREEN and result |
|---|---|---|
| Independent release and valid release names | `98fe7d0`: packaging script absent, 5 failures | `1a127c4`: 5 tests passed |
| Asset serving, HEAD, cache and confinement | `c28bd8a`: server module absent, 4 failures | `b83d9aa`: 4 tests passed |

Specs are colocated with scripts and executed by Vitest; no root tests folder is required.
The module audit evaluates the actual AOT bundle in an isolated ES-module realm,
rejecting bare/external imports and import-time DOM, request, history or timer work.
The realm includes browser-compatible performance; it does not simulate mounting.
The HTTP tests use actual sockets and temporary static fixtures.

Full `npm run test:coverage`: 85 tests passed in nine files; frontend source line
coverage is unchanged at 48.50%, with 100% for current domain utility lines.
Scripts have functional tests but are outside the existing src/**/*.ts metric.
The 80% overall target remains unmet. CI also builds the default portal release.
The existing build passed. Artifact tests built release 0.1.0-test successfully;
the subsequent user-run default-release build succeeded and produced
`/portals/billing/0.1.0-demo/entry.js` (terminal evidence supplied in the work thread).

Browser check: actual AOT module imported with an empty host, mounted Angular
without errors, updated to local 404, unmounted twice and remounted/aborted.
The host returned to zero children and the sibling fixture remained present.
This used synthetic context and a disposable harness, not dlc-front itself.
The adapter still renders its unavailable frame; dummy domain views, shell
registration, integrated browser acceptance and independent DoD review remain pending.

## Automated review follow-up

Base: develop `cdc8bf2`. No domain behavior or shell registration is changed.

| Finding | Decision and evidence |
|---|---|
| Release overwrite | Applied. RED `7de2f85` failed because an existing destination was accepted; GREEN `e57b46f` passed six packaging tests. Two rejected attempts preserve file bytes and directory contents. |
| PR title | Use `fix: enforce billing release safety` for this follow-up. The previous PR title is external metadata and was not changed here. |
| Immutable cache | Not applied: frontend-composition.md C02 explicitly requires no-store for registry and entry.js. Only content-hashed chunks may use immutable caching; this build emits an un-hashed entry. |
| Internal errors hidden as 404 | Applied. RED `b198269` had three failing cases; GREEN `ab3e8da` passed seven HTTP tests. Read failures EACCES/EIO are injected through the file-reader adapter; responses travel over actual HTTP sockets. These injections do not prove host permission handling in production. |
| Overall coverage | Existing gap retained and disclosed; source line coverage remains 48.50%, not a regression. A separate test increment is needed for the 80% target. |

Follow-up verification: 89 tests passed across nine files; source coverage remains
49.82% statements, 55.43% branches, 48.51% functions and 48.50% lines.
`npm run build` passed. `npm run build:portal` passed with a fresh release
`0.1.0-safety-eb96816c2af34c1fa819513b1102e9fe`.
The full suite also compiled and audited a fresh browser ESM artifact.
Docker execution, shell integration, CI verification and independent review remain pending.
