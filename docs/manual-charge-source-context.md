# Manual source navigation context

The existing composition-v1 route query now initializes the manual form at
`/app/billing/manual-charges/new` with exactly one canonical UUID value for each
of patientId, appointmentId, procedureId and sourceRecordId. These are source
hints, never authorization. The real Billing API checks source identity, current
care, Dentist relationship, session eligibility and the closure gate.

Price, concept, justification and actor are never accepted from the query or
prefilled from the catalog. Invalid, duplicate or unexpected query fields keep
the form unavailable. A changed source clears protected draft fields and retry
intent; an equivalent source update preserves the existing intent. The compositor
updateRoute path applies the same rules as initial mounting.

RED: four failed tests proved missing initialization/update/reset. GREEN: all
599 Portal tests passed, contract projection check passed, and an immutable local
artifact was built at `/portals/billing/2.0.2-local-20261107/entry.js`. No contract
file was changed and no artifact was published. Browser owner acceptance follows
separately with the actual manual API and Appointments assignment service.
