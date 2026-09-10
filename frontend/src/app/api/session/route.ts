import { requestBackend } from "@/lib/server/backend-client";
import { isCrossOriginMutation } from "@/lib/server/cross-origin-guard";
import {
  appendSessionCookies,
  clearSessionCookies,
  readCookie,
  sessionCookieNames,
} from "@/lib/server/session-cookies";
import { isNonEmptyToken } from "@/lib/server/token-validation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
};

function errorResponse(message: string, status: number) {
  return Response.json({ detail: message }, { status });
}

// SEC-FE-AUTH-LOGIN-CSRF-001: this route issues (POST) and clears (DELETE)
// the session cookie directly, but never checked Origin before doing
// either -- a cross-origin page could submit a same-site-cookie-carrying
// login or logout request here (text/plain is a CORS-simple content type,
// so this doesn't even need a preflight). See
// lib/server/cross-origin-guard.ts for the full rationale.
function rejectCrossOrigin(request: Request) {
  if (!isCrossOriginMutation(request)) return null;
  return errorResponse('درخواست از مبدأ نامعتبر پذیرفته نشد.', 403);
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

  let payload: LoginPayload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('اطلاعات ورود معتبر نیست.', 400);
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!username || !password) {
    return errorResponse('نام کاربری و رمز عبور الزامی است.', 400);
  }

  try {
    const upstream = await requestBackend({
      requestUrl: request.url,
      path: ['auth', 'login'],
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      inboundHost: request.headers.get('host'),
    });
    const body = await responseJson(upstream);

    if (!upstream.ok) {
      return Response.json(body ?? { detail: 'ورود به حساب انجام نشد.' }, {
        status: upstream.status,
      });
    }

    const result = body as {
      access?: unknown;
      refresh?: unknown;
      user?: unknown;
      redirect_path?: unknown;
    };
    // AUTH-FE-SESSION-EMPTY-TOKENS-001: a mere typeof check accepts an
    // empty or whitespace-only string just as readily as a real token --
    // see lib/server/token-validation.ts for the full rationale (shared
    // with the BFF refresh path and customer-registration).
    if (
      !isNonEmptyToken(result.access) ||
      !isNonEmptyToken(result.refresh) ||
      !result.user
    ) {
      return errorResponse('پاسخ ورود بک‌اند کامل نیست.', 502);
    }

    const headers = new Headers({ 'cache-control': 'no-store' });
    appendSessionCookies(headers, { access: result.access, refresh: result.refresh });
    return Response.json(
      {
        user: result.user,
        redirect_path:
          typeof result.redirect_path === 'string'
            ? result.redirect_path
            : '/dashboard/admin',
      },
      { headers },
    );
  } catch {
    return errorResponse('ارتباط با سرویس ورود برقرار نشد.', 502);
  }
}

export async function GET(request: Request) {
  const access = readCookie(request.headers.get('cookie'), sessionCookieNames.access);
  if (!access) return errorResponse('نشست فعالی وجود ندارد.', 401);

  try {
    const upstream = await requestBackend({
      requestUrl: request.url,
      path: ['me'],
      method: 'GET',
      headers: { accept: 'application/json' },
      accessToken: access,
      requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      inboundHost: request.headers.get('host'),
    });
    const body = await responseJson(upstream);
    return Response.json(body ?? { detail: 'دریافت نشست انجام نشد.' }, {
      status: upstream.status,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return errorResponse('ارتباط با سرویس حساب کاربری برقرار نشد.', 502);
  }
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  const access = readCookie(request.headers.get('cookie'), sessionCookieNames.access);
  const refresh = readCookie(request.headers.get('cookie'), sessionCookieNames.refresh);

  if (refresh) {
    try {
      await requestBackend({
        requestUrl: request.url,
        path: ['auth', 'logout'],
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ refresh }),
        accessToken: access,
        requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
        inboundHost: request.headers.get('host'),
      });
    } catch {
      // Local cookie removal must still complete when the upstream is unavailable.
    }
  }

  const headers = new Headers({ 'cache-control': 'no-store' });
  clearSessionCookies(headers);
  return new Response(null, { status: 204, headers });
}
