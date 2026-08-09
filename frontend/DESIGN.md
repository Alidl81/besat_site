# Besat Design System

This document records the existing Besat visual language extracted from the
authoritative frontend and retained by this delivery. It is a maintenance
reference, not a replacement design direction.

## Foundations

- Direction: RTL by default. Use logical CSS properties when a layout can move
  between RTL and LTR contexts.
- Primary typeface: `Estedad`, with `Vazirmatn`, Segoe UI, Tahoma and Arial as
  fallbacks. Preserve Persian-friendly line height and avoid negative letter
  spacing.
- Brand navy: `#0a2848`; soft navy: `#e8eef3`.
- Brand amber: `#c98c3d`; soft amber: `#fbf3e7`.
- Surface: `#ffffff`; page background: `#fbfaf7`; border: `#e5e7eb`.
- Text: `#0f172a`; muted text: `#64748b`.

## Layout And Density

- Public pages retain the source site’s spacious editorial rhythm and existing
  animations. Do not add decorative cards or gradients to unrelated pages.
- Panels are denser operational interfaces: compact sidebar rows, tables with
  useful columns, clear empty/error/loading states, and 44px minimum targets
  for touchable controls.
- Use the established panel radius and shadows. Do not nest cards merely for
  decoration.
- Normal desktop panel navigation must fit without an inner scrollbar; only
  genuinely short viewports may scroll the navigation container.

## Components

- Use bundled Tabler Iconify icons for dashboard/editor interface controls.
  Icon-only controls require a clear accessible name and tooltip.
- Forms use visible labels, inline field errors, a general error summary where
  appropriate, and disabled/loading states for pending mutations.
- Dialogs and drawers use a real scrim, Escape close, focus containment,
  trigger-focus restoration and scroll locking.
- Tables and lists use explicit status labels in addition to colour, responsive
  card treatment when necessary, and no page-wide horizontal overflow.

## Motion

- Base transitions: 280ms with the existing `cubic-bezier(.2,.8,.2,1)` curve.
- Drawer/menu movement uses transform and opacity over roughly 200-300ms.
- Respect `prefers-reduced-motion`; motion must not gate a task or change
  layout height/width.
- Preserve the public-site keyframes already defined in `src/app/globals.css`.

## Accessibility

- Meet 4.5:1 contrast for normal text where colour is functional.
- Keep visible keyboard focus, semantic headings, meaningful alt text and
  screen-reader announcements for mutation outcomes.
- Sanitize externally supplied CMS HTML at the render boundary while retaining
  the explicit gallery data attributes required by the editor renderer.
