"use client";

// Next.js's own built-in default global-error fallback crashes during
// `next build`'s static generation with "Cannot read properties of null
// (reading 'useContext')" -- confirmed as a long-standing, still-open
// upstream bug (vercel/next.js#95741, #86178, #84994, #82366): global-error
// replaces the entire root layout, so it renders outside the root layout's
// provider tree, and Next's internal default fallback hits a context read
// in that state. Providing this trivial, dependency-free replacement (no
// imports from app code, no hooks beyond the one required by the
// convention) avoids the crash by never touching a context that isn't
// there. This file intentionally renders its own <html>/<body>, per the
// Next.js global-error convention -- it is NOT wrapped by app/layout.tsx.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f6f9fb", color: "#0a2848" }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900 }}>مشکلی در نمایش سایت پیش آمد</h1>
          <p style={{ marginTop: 12, maxWidth: 420, fontSize: "0.95rem", opacity: 0.75 }}>
            می‌توانید دوباره تلاش کنید یا صفحه را از نو بارگذاری کنید.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 20, height: 44, padding: "0 24px", borderRadius: 12, border: "none", background: "#e2ae5b", color: "#0b213c", fontWeight: 900, cursor: "pointer" }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
