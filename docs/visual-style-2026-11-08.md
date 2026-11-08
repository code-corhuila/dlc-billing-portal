# Billing visual alignment

Presentation-only update based on the supplied DI LUCCA PDF (catalog page 7,
billing page 13, payment page 14 and invoice detail page 18). The compositor's
existing Inter font and `--dlc-*` color tokens remain the source of shared styling.

The composed Billing screens now share teal actions, active navigation, consistent
headings, white cards, fine borders, status badges, form controls and responsive
dialogs. All shared selectors are prefixed with `dlc-billing-root.dlc-billing` so
they do not style the compositor or another remote. Existing component class bodies,
HTTP calls, permissions, validation, calculations and submission handlers are unchanged.
The metadata reflection test resolves external CSS before inspecting the component.

Validation: 626 tests passed, both contract projections passed, standalone and composed
builds passed, and the Docker image built successfully with Node 22. Chromium checked
the empty invoice list, draft form, catalog and rules at 1440px and 390px, plus both
creation dialogs. The checked pages have no horizontal overflow or title/header overlap.
The local installation remains free of synthetic financial data; no financial form
was submitted during visual verification. Populated invoices were not reintroduced
solely to obtain screenshots.

The local candidate is served at `/portals/billing/2.1.0-style-20261108/entry.js`.
Runtime configuration and before/after screenshots remain under the ignored
`.publication/local/` directory. The source PDF, credentials and private artifacts
are not committed. This aligns supported screens with the reference's visual system;
it does not add mockup-only fields, financial summaries, taxes or workflows.
