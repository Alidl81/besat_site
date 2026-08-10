# ADR: Repair the custom Django CMS instead of migrating to Wagtail or django-CMS

- **Status**: Accepted
- **Date**: 2026-08-10
- **Deciders**: Phase 2 implementation (this repository's news/announcement editorial system)

## Context

The Besat site's editorial system — creating, reviewing, scheduling, and
publishing News and Announcements — is a hand-built Django + DRF layer
(`apps/content`, `apps/news`, `apps/announcements`) paired with a TipTap-based
block editor in the Next.js frontend (`editorial-workspace.tsx`,
`rich-editor.tsx`). It is not built on an existing Python CMS framework. This
ADR records the decision on whether to keep building on that custom layer or
migrate to an established Django CMS package, evaluated against Wagtail and
django-CMS — the two realistic options for a Django-native shop — with
WordPress/PHP ruled out up front (see below).

At the time of this decision, the custom layer already implements, correctly
scoped to this project's actual domain model:

- A non-negotiable 3-role permission model (`general_manager`, `unit_media`,
  `parent`) with per-unit content scoping (`get_accessible_unit_ids`,
  `_ensure_write_access` / `_ensure_delete_access`), where `unit_media` may
  author and submit its own unit's content but not delete, approve, or
  publish it.
- A real workflow (`draft` → `waiting_review` → `approved` → `published` /
  `rejected` → `archived`, plus `trash`), enforced server-side, not just a
  frontend state machine.
- Revisions with autosave coalescing and restore
  (`apps.content.models.ContentRevision`, `_record_revision`,
  `restore_revision`).
- A tailored block set (heading, paragraph, image, gallery, quote, table,
  divider, code, callout, inline media, secure video embed) as TipTap nodes,
  each round-tripping through insert → edit → save → reload → preview →
  publish → public render, with an interactive gallery block (add/reorder/
  remove/alt-text/captions) and portal-based accessible modals.
- A Yoast-style on-page SEO panel (`apps/core/models.SEOFieldsModel`,
  `frontend/src/components/cms/seo-panel.tsx`) with a real analysis engine,
  wired into revisions and public metadata generation.
- Optimistic concurrency (`version`/`updated_at`, 409-on-conflict) and
  field-level, Persian-language error reporting throughout.

This is a working system, not a prototype — the open question is whether an
established CMS package would reduce the remaining and future work, or add
more than it removes.

## Options considered

### A. WordPress (or any PHP CMS) — rejected without further evaluation

This project's backend is Django/DRF end to end: JWT + httpOnly-cookie
session auth, a Next.js BFF proxy, the permission/throttling/security work
in `apps/core` and `config/settings`, and every other app in this codebase.
Adopting WordPress would mean replacing the entire backend runtime, not just
the editorial layer, and abandoning all of the above. It was explicitly
ruled out by this project's own architecture direction and is not
reconsidered here.

### B. Migrate to Wagtail

Wagtail is the most mature headless-friendly Django CMS, with its own
StreamField block editor, built-in revisions/workflow, and an official REST
API (`wagtail.api.v2`) that could sit behind the existing Next.js BFF.

**What it would give us for free:** community-maintained StreamField
tooling, built-in image renditions, a documented upgrade path, and a larger
pool of prior art to draw on.

**What it does not give us, because it doesn't know about this project's
domain:** Wagtail's permission and workflow model is built around a
hierarchical page tree and generic "moderators can publish" roles — the
unit-scoped, 3-role, delete-vs-write distinction this project needs would
still have to be built by hand on top of it, the same work already done
here. Its StreamField blocks are a different block model than the TipTap
nodes already built (gallery with persistent IDs, secure embed allowlisting,
callouts) — every one of those would need re-implementing as StreamField
blocks, and every existing News/Announcement row would need a real data
migration from `content_json`/`body_json` into Wagtail's `StreamValue`
format. The SEO panel just built here already covers the same ground as
Wagtail's Promote tab, tailored to this project's fields.

**Net assessment:** migrating gains a page-tree and plugin ecosystem this
project doesn't need (there is no arbitrary page hierarchy — content is
News or Announcements, scoped to a school or a unit) at the cost of
re-implementing the permission model, the block editor, and a real data
migration, none of which are optional or skippable.

### C. Migrate to django-CMS

django-CMS offers a placeholder/plugin architecture and built-in
versioning, also Django-native.

**What it would give us:** a plugin system for structured content and
multi-language support (not a current requirement — this site is
Persian-only).

**What it does not give us:** django-CMS's placeholder/plugin model is
template- and page-tree-coupled by default; keeping a clean, fully decoupled
Next.js frontend behind it is less established than Wagtail's official API
support. Its plugin authoring model is a different mental model from TipTap
node authoring, so the same block-by-block reimplementation and data
migration cost as option B applies, without even the "official headless API"
advantage. Community/plugin momentum has also generally trailed Wagtail's in
recent years, which matters for how much of the "free maintenance" upside
actually materializes over this project's lifetime.

**Net assessment:** strictly more migration cost than Wagtail for less
headless-specific tooling. Not competitive with option B, let alone option D.

### D. Repair and complete the current custom stack (chosen)

Continue building on `apps/content` / `apps/news` / `apps/announcements` +
the TipTap editor, fixing concrete gaps (the EditorJS-shape vs native
TipTap-doc-shape split between `/api/cms/news/`'s `content_json` and
`/api/cms/content/`'s `body_json`/`editor_json` is the clearest one on
record) rather than replacing the layer.

## Decision

**Repair and complete the current custom Django CMS.** Do not migrate to
Wagtail or django-CMS.

The deciding factor is not "custom code is better than a framework" in the
abstract — it's that this project's hardest CMS problem was never generic
content editing, it was the unit-scoped 3-role permission and workflow
model, and that problem is already correctly solved here, in code that has
been tested against exactly this project's requirements. Neither Wagtail
nor django-CMS models that domain out of the box; adopting either would mean
solving it a second time on unfamiliar ground while simultaneously
re-implementing an already-working block editor and migrating live content
data, for ecosystem benefits (page trees, plugin marketplaces,
multi-language) this single-purpose editorial system does not need.

## Consequences

- The remaining CMS work is incremental repair, not a rewrite: resolving
  the `content_json`/`body_json` shape split, and whatever else surfaces
  during the Definition-of-Done pass — not a migration project.
- This project takes on full maintenance responsibility for the editorial
  layer's Django/DRF code, without an upstream CMS community fixing bugs in
  it. In practice the surface area that isn't already covered by
  well-maintained upstream dependencies (Django, DRF, TipTap) is
  comparatively small: revision storage, the workflow state machine, and
  the block set — all of which are now implemented and tested.
- If a future requirement genuinely needs a general-purpose page tree (e.g.
  arbitrary editor-managed static pages beyond News/Announcements/About),
  that is a narrower, separate decision than "replace the whole CMS" and
  should be re-evaluated on its own terms against the same three options.
- This decision does not need revisiting unless the project's actual
  requirements change (e.g. multi-language becomes a real requirement, or
  the content model grows well beyond News/Announcements into a genuine
  page tree) — incremental data-model growth within the current 3-role/
  unit-scoped model does not on its own justify reopening it.
