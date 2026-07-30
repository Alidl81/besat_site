# Backend API contract

This file is retained as a compatibility link for older project references.
The audited, authoritative contract is:

- [`FRONTEND_BACKEND_ENDPOINT_MAP.md`](./FRONTEND_BACKEND_ENDPOINT_MAP.md)

That map was verified against branch `backend/mvp-bootstrap` at
`ea5860fec717e0cc37d4fc1d16a4938adef1a917` and the scoped backend changes in
this delivery. It records exact trailing-slash paths, methods, roles, scoping,
filters, payloads, response forms, uploads, workflow transitions, and confirmed
backend gaps.

Do not add aspirational endpoints to this document or the frontend. In
particular, the current backend has no dedicated autosave, revision/restore,
WordPress sync, parent-child, or optimistic-concurrency contract.
