# Besat legacy-site cutover plan

The new application is the single canonical site at `https://besat.org`.
This document plans the migration; it does not change DNS, certificates,
legacy servers, or redirects now.

## Known legacy inventory

| Legacy URL | Classification | Planned destination |
|---|---|---|
| `https://besat-r.com/` | legacy home | `https://besat.org/` |
| `https://besat-r.com/home.axd` | exact home equivalent | `https://besat.org/` |
| `https://besat-r.com/boys-school.axd` | boys unit directory | `https://besat.org/units` |
| `https://besat-r.com/boys-highschool.axd` | boys secondary directory | `https://besat.org/units` |
| `https://besat-r.com/girls-school.axd` | girls unit directory | `https://besat.org/units` |
| `https://besat-r.com/girls-highschool.axd` | girls secondary directory | `https://besat.org/units` |
| `https://besat-r.com/blog-archive.axd` | news/content archive | `https://besat.org/news` pending content mapping |
| Legacy registration/preregistration URLs | registration | `https://besat.org/registration` only after the owner approves the new registration state |
| Legacy image/form URLs | media asset | Preserve only while a verified migrated page references them; otherwise return `410 Gone` after evidence review |

The mock/reference dataset and old pages contain source URLs, but they are not
instructions to migrate every legacy record. Content owners must map each
valuable news/detail URL to a real new slug before redirecting it.

## Redirect rules

1. Use permanent `301` redirects only after the owner controls the legacy DNS
   and server. Keep `besat.org` as the canonical host.
2. Redirect exact equivalents to their exact new route.
3. Redirect known unit pages to the corresponding new unit slug when the URL
   identifies one unit; directory pages go to `/units`.
4. Redirect news/articles only after a one-to-one slug/content mapping is
   recorded. Do not send all articles to the homepage.
5. Redirect registration pages to `/registration` only while the current
   registration state and contact fallback are approved.
6. Send obsolete URLs with no useful replacement to a relevant landing page
   or `410 Gone`, based on search value and owner decision.
7. Remove legacy canonical/alternate metadata after the cutover; no new page
   may emit `besat-r.com` as its canonical origin.

## Cutover sequence

1. Inventory legacy access logs and search-console URLs; classify every
   high-value URL using the table above.
2. Verify the new database backup, contact data, unit mappings, media, users,
   registration state, and payment readiness.
3. Lower DNS TTL before the maintenance window, without changing the origin
   prematurely.
4. Provision the `besat.org` certificate and gateway; verify HTTP→HTTPS,
   `www`→apex redirect, HSTS, security headers, robots, sitemap, and canonical
   output.
5. Enable the redirects on the legacy server and sample every mapping from
   the inventory with `curl -I`.
6. Run the post-cutover checklist and monitor 4xx/5xx, login, contact,
   registration, media, and payment callback errors during the rollback window.
7. Retire old services only after the owner accepts the evidence and the
   backup/rollback window has closed.

Do not perform any of these external changes from this repository checkout.
