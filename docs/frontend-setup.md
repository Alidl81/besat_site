# Frontend Setup

## Stack

```txt
Next.js
TypeScript
Tailwind CSS
ESLint
App Router
src directory
Local Development
cd frontend
npm run dev

Local URL:

http://localhost:3000
Environment

Create:

frontend/.env.local

Content:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
Content Rule

No fake content is allowed in the production website.
Temporary placeholders are allowed only during UI development and must be clearly marked.
