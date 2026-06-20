# Frontend Structure

## Current Stack

```txt
Next.js
TypeScript
Tailwind CSS
App Router
RTL Persian UI
Folder Structure
frontend/src/
  app/
    layout.tsx
    page.tsx
    globals.css

  components/
    layout/
      site-header.tsx
      site-footer.tsx

    shared/
      app-link.tsx
      container.tsx
      section-header.tsx

    home/
      hero-section.tsx
      verified-sections-preview.tsx
      content-rules-section.tsx

  lib/
  types/
Content Accuracy Rule

No fake production content is allowed.

Temporary UI text is allowed only when it clearly explains that verified backend content will replace it.
