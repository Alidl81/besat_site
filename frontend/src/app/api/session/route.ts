import { requestBackend } from "@/lib/server/backend-client";
import {
  appendSessionCookies,
  clearSessionCookies,
  readCookie,
  sessionCookieNames,
} from "@/lib/server/session-cookies";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
};

function errorResponse(message: string, status: number) {
  return Response.json({ detail: message }, { status });
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
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
    if (
      typeof result.access !== 'string' ||
      typeof result.refresh !== 'string' ||
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
      });
    } catch {
      // Local cookie removal must still complete when the upstream is unavailable.
    }
  }

  const headers = new Headers({ 'cache-control': 'no-store' });
  clearSessionCookies(headers);
  return new Response(null, { status: 204, headers });
}
