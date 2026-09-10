import { requestBackend } from "@/lib/server/backend-client";
import { isCrossOriginMutation } from "@/lib/server/cross-origin-guard";
import { appendSessionCookies } from "@/lib/server/session-cookies";
import { isNonEmptyToken } from "@/lib/server/token-validation";

// Mirrors /api/session's POST handler exactly (same cookie-issuing
// mechanism, same response shape) but calls auth/register instead of
// auth/login -- this is the additive customer signup path, it does not
// touch the login route or the staff-invitation flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterPayload = {
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  password_confirm?: unknown;
};

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ detail: message, ...extra }, { status });
}

// SEC-FE-AUTH-LOGIN-CSRF-001: this route issues the session cookie
// directly on a successful signup, but never checked Origin first -- see
// lib/server/cross-origin-guard.ts for the full rationale (shared with
// /api/session's identical guard).
function rejectCrossOrigin(request: Request) {
  if (!isCrossOriginMutation(request)) return null;
  return errorResponse("درخواست از مبدأ نامعتبر پذیرفته نشد.", 403);
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  let payload: RegisterPayload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("اطلاعات ثبت‌نام معتبر نیست.", 400);
  }

  const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const passwordConfirm = typeof payload.password_confirm === "string" ? payload.password_confirm : "";

  if (!fullName || !email || !password || !passwordConfirm) {
    return errorResponse("تکمیل تمام فیلدهای الزامی ضروری است.", 400);
  }

  try {
    const upstream = await requestBackend({
      requestUrl: request.url,
      path: ["auth", "register"],
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone: phone || undefined,
        password,
        password_confirm: passwordConfirm,
      }),
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
      inboundHost: request.headers.get("host"),
    });
    const body = await responseJson(upstream);

    if (!upstream.ok) {
      return Response.json(body ?? { detail: "ثبت‌نام انجام نشد." }, { status: upstream.status });
    }

    const result = body as { access?: unknown; refresh?: unknown; user?: unknown; redirect_path?: unknown };
    // AUTH-FE-SESSION-EMPTY-TOKENS-001: a mere typeof check accepts an
    // empty or whitespace-only string just as readily as a real token --
    // see lib/server/token-validation.ts for the full rationale (shared
    // with the BFF refresh path and /api/session).
    if (!isNonEmptyToken(result.access) || !isNonEmptyToken(result.refresh) || !result.user) {
      return errorResponse("پاسخ ثبت‌نام بک‌اند کامل نیست.", 502);
    }

    const headers = new Headers({ "cache-control": "no-store" });
    appendSessionCookies(headers, { access: result.access, refresh: result.refresh });
    return Response.json(
      {
        user: result.user,
        redirect_path: typeof result.redirect_path === "string" ? result.redirect_path : "/dashboard/parents",
      },
      { headers },
    );
  } catch {
    return errorResponse("ارتباط با سرویس ثبت‌نام برقرار نشد.", 502);
  }
}
