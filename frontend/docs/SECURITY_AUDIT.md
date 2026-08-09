# Security Audit Notes

## Fixed during this audit

- Browser requests use the same-origin `/api/backend/*` facade. The real backend base URL remains server-only in `BESAT_BACKEND_API_URL`.
- Access and refresh credentials are held in HttpOnly, SameSite=Lax cookies. Client code receives display/session metadata only and proactively clears legacy local-storage token keys.
- The facade strips inbound cookies, hop-by-hop headers, and upstream `Set-Cookie` headers. It injects credentials server-side, retries one request after a server-side refresh, and clears failed sessions.
- Mutating facade requests reject a mismatched `Origin`, reducing cross-site request risk for the cookie session.
- Parent registration history is now scoped by the authenticated `submitted_by` account, not by a mutable contact field such as phone number or email.
- CMS revisions, restore actions, publication transitions, and content editing retain backend permission enforcement. Hidden frontend actions are not relied on as authorization.
- Raw editor JSON is validated and rendered through an allowlisted backend renderer. The public renderer sanitizes the HTML at the frontend rendering boundary as a defense in depth measure.
- Media upload keeps production files on the backend media endpoint; the editor and gallery picker no longer save base64 file data as content. The isolated mock backend serves uploaded test bytes through a temporary BFF URL so its contract matches production URL behavior.

## Residual constraints

- The backend contract does not currently expose ETags, revision version numbers, or another explicit optimistic-concurrency token. Autosave coalesces and prevents stale client application, but a full cross-client conflict protocol needs a backend contract addition.
- WordPress synchronization fields are not implemented because `backend/mvp-bootstrap` exposes no WordPress integration contract.
- Remote deployment security headers, TLS termination, CORS deployment policy, storage lifecycle policy, and production secret rotation require the deployment environment and were not inferred locally.

## Secret handling

No credentials were added to source control or `NEXT_PUBLIC_*` variables. The optional 21st MCP key is referenced only by the environment variable name `API_KEY_21ST`; it is not reproduced in this project documentation.
