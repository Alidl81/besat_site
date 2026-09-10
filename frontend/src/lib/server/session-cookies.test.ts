import { describe, expect, it } from "vitest";
import {
  appendSessionCookies,
  clearSessionCookies,
  readCookie,
  sessionCookieNames,
} from "@/lib/server/session-cookies";

function setCookieValues(headers: Headers) {
  return headers.getSetCookie ? headers.getSetCookie() : [...headers.values()];
}

describe("session cookies", () => {
  it("sets access, refresh, and a readable has-session marker on login", () => {
    const headers = new Headers();
    appendSessionCookies(headers, { access: "a", refresh: "r" });
    const values = setCookieValues(headers);

    expect(values).toHaveLength(3);
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.access}=`) && v.includes("HttpOnly"))).toBe(true);
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.refresh}=`) && v.includes("HttpOnly"))).toBe(true);
    // The marker must NOT be HttpOnly -- client-side code reads it via
    // document.cookie to decide whether to call /me at all.
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.hasSession}=1`) && !v.includes("HttpOnly"))).toBe(true);
  });

  it("clears all three cookies on logout", () => {
    const headers = new Headers();
    clearSessionCookies(headers);
    const values = setCookieValues(headers);

    expect(values).toHaveLength(3);
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.access}=;`))).toBe(true);
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.refresh}=;`))).toBe(true);
    expect(values.some((v) => v.startsWith(`${sessionCookieNames.hasSession}=;`))).toBe(true);
  });

  it("readCookie round-trips a value set by appendSessionCookies", () => {
    const headers = new Headers();
    appendSessionCookies(headers, { access: "access-token", refresh: "refresh-token" });
    const cookieHeader = setCookieValues(headers)
      .map((v) => v.split(";")[0])
      .join("; ");

    expect(readCookie(cookieHeader, sessionCookieNames.access)).toBe("access-token");
    expect(readCookie(cookieHeader, sessionCookieNames.refresh)).toBe("refresh-token");
    expect(readCookie(cookieHeader, sessionCookieNames.hasSession)).toBe("1");
  });
});
