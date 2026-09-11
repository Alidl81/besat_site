import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { readCookie } from "@/lib/server/session-cookies";

export const ANONYMOUS_THROTTLE_COOKIE = "besat_anon_id";

function secret() {
  return process.env.BESAT_ANON_THROTTLE_SECRET?.trim() || null;
}

function validIdentity(value: string | null) {
  return value && /^[0-9a-f-]{16,128}$/i.test(value) ? value : null;
}

export function getOrCreateAnonymousThrottleIdentity(cookieHeader: string | null) {
  const signingSecret = secret();
  if (!signingSecret) return null;

  const identity = validIdentity(readCookie(cookieHeader, ANONYMOUS_THROTTLE_COOKIE)) ?? randomUUID();
  const signature = createHmac("sha256", signingSecret).update(identity).digest("hex");
  return {
    headerValue: `${identity}.${signature}`,
    cookieValue: identity,
    isNew: !validIdentity(readCookie(cookieHeader, ANONYMOUS_THROTTLE_COOKIE)),
  };
}

