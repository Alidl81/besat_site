import { afterEach, describe, expect, it } from "vitest";
import {
  ANONYMOUS_THROTTLE_COOKIE,
  getOrCreateAnonymousThrottleIdentity,
} from "@/lib/server/anonymous-throttle";

const originalSecret = process.env.BESAT_ANON_THROTTLE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.BESAT_ANON_THROTTLE_SECRET;
  else process.env.BESAT_ANON_THROTTLE_SECRET = originalSecret;
});

describe("anonymous BFF throttle identity", () => {
  it("issues a signed stable identity and reuses its cookie", () => {
    process.env.BESAT_ANON_THROTTLE_SECRET = "test-throttle-secret";

    const first = getOrCreateAnonymousThrottleIdentity(null);
    expect(first).toMatchObject({ isNew: true });
    expect(first?.headerValue).toMatch(/^[0-9a-f-]+\.[0-9a-f]{64}$/i);

    const second = getOrCreateAnonymousThrottleIdentity(
      `${ANONYMOUS_THROTTLE_COOKIE}=${first?.cookieValue}`,
    );
    expect(second).toEqual({
      headerValue: first?.headerValue,
      cookieValue: first?.cookieValue,
      isNew: false,
    });
  });

  it("replaces malformed or non-identity cookies instead of signing them", () => {
    process.env.BESAT_ANON_THROTTLE_SECRET = "test-throttle-secret";

    const result = getOrCreateAnonymousThrottleIdentity(
      `${ANONYMOUS_THROTTLE_COOKIE}=not-a-uuid; other=value`,
    );
    expect(result?.isNew).toBe(true);
    expect(result?.cookieValue).not.toBe("not-a-uuid");
    expect(result?.headerValue).toContain(`${result?.cookieValue}.`);
  });

  it("fails closed when the shared signing secret is not configured", () => {
    delete process.env.BESAT_ANON_THROTTLE_SECRET;
    expect(getOrCreateAnonymousThrottleIdentity(null)).toBeNull();
  });
});
