import { afterEach, describe, expect, it, vi } from "vitest";
import { performCustomerRegistration } from "@/lib/auth/registration-service";
import { destroySession, performLogin } from "@/lib/auth/login-service";

// REL-FE-AUTH-TRANSPORT-TIMEOUT-001: performLogin()/destroySession()
// (login-service.ts) and performCustomerRegistration() (registration-
// service.ts) called raw fetch() with no AbortSignal at all, so a
// stalled BFF/upstream held these auth requests open indefinitely (or
// until the platform's own uncontrolled connection-level default)
// instead of settling deterministically -- the exact defect
// REL-FE-BACKEND-TIMEOUT-001 already fixed for apiRequest() and
// REL-FE-CART-TIMEOUT-001 already fixed for the cart transport. All
// three now apply resolveRequestSignal()'s shared 8s default deadline,
// the same helper those two fixes established specifically so a raw
// fetch() transport elsewhere in the app wouldn't have to duplicate the
// policy. Adapted from Codex's probe
// .agents/qa/frontend/auth-transport-deadline.test.ts, whose own
// assertions documented the pre-fix absence of a signal
// (not.toHaveProperty("signal")) -- inverted here to assert the fix's
// forward-looking behavior (an actual AbortSignal is present).
describe("auth transport deadline contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login applies the shared request deadline", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ detail: "busy" }), { status: 503 }));

    await performLogin("qa-user", "qa-password");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it("customer registration applies the shared request deadline", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ detail: "busy" }), { status: 503 }));

    await performCustomerRegistration({
      full_name: "QA Student",
      email: "qa@example.test",
      phone: "09000000000",
      password: "qa-password",
      password_confirm: "qa-password",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it("logout applies the shared request deadline too", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await destroySession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE" }),
    );
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });
});
