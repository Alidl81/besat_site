import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePanelRequest } from "@/hooks/use-panel-request";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe({ request }: { request: () => Promise<string> }) {
  const { data, error, reload } = usePanelRequest(request, []);
  return (
    <div>
      <button type="button" onClick={reload}>
        تلاش دوباره
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {data ? <p role="status">{data}</p> : null}
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// FE-PANEL-RETRY-DOUBLE-SUBMIT-001: reload() only ever incremented `version`
// state, with no synchronous guard against a second retry-button activation
// while the fetch a previous reload() triggered was still in flight (the
// QA harness deliberately holds the retry response so the two activations
// genuinely overlap) -- each click's `reload()` call ran to completion
// before the next, and both unconditionally bumped `version`, so both
// started a real network request.
describe("usePanelRequest retry single-flight guard", () => {
  it("collapses a second retry click into a no-op while the first retry request is still pending", async () => {
    const initial = createDeferred<string>();
    const request = vi.fn().mockReturnValueOnce(initial.promise);
    render(<Probe request={request} />);

    await act(async () => {
      initial.reject(new Error("خطای آزمایشی"));
      await initial.promise.catch(() => undefined);
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const retry = createDeferred<string>();
    request.mockReturnValueOnce(retry.promise);
    const button = screen.getByRole("button", { name: "تلاش دوباره" });

    // First click: starts the retry request and leaves it deliberately
    // pending (matching the QA harness holding the response).
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);

    // Second click while the first retry is still unresolved: must NOT
    // start a second network request.
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);

    await act(async () => {
      retry.resolve("بازیابی‌شده");
      await retry.promise;
    });

    expect(screen.getByRole("status")).toHaveTextContent("بازیابی‌شده");
  });

  it("allows a later retry click once the guarded request has settled", async () => {
    const initial = createDeferred<string>();
    const request = vi.fn().mockReturnValueOnce(initial.promise);
    render(<Probe request={request} />);

    await act(async () => {
      initial.reject(new Error("خطای آزمایشی"));
      await initial.promise.catch(() => undefined);
    });

    const firstRetry = createDeferred<string>();
    request.mockReturnValueOnce(firstRetry.promise);
    const button = screen.getByRole("button", { name: "تلاش دوباره" });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstRetry.reject(new Error("باز هم خطا"));
      await firstRetry.promise.catch(() => undefined);
    });

    const secondRetry = createDeferred<string>();
    request.mockReturnValueOnce(secondRetry.promise);
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(3);

    await act(async () => {
      secondRetry.resolve("بازیابی‌شده دوباره");
      await secondRetry.promise;
    });
    expect(screen.getByRole("status")).toHaveTextContent("بازیابی‌شده دوباره");
  });
});
