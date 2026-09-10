import { afterEach, describe, expect, it, vi } from "vitest";
import { cmsCreateTourSceneWithProgress } from "@/services/virtual-tour-cms-service";
import { ApiError } from "@/lib/api/client";

class MockXHR {
  static instances: MockXHR[] = [];
  method = "";
  url = "";
  withCredentials = false;
  responseType = "";
  timeout = 0;
  status = 0;
  response: unknown = null;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send() {
    /* left pending -- the test drives onload/onerror/ontimeout/onabort directly */
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockXHR.instances = [];
});

// REL-FE-TOUR-UPLOAD-TIMEOUT-001: this upload used raw XHR (needed for
// real upload-progress events, which fetch can't report) with no
// `.timeout`/`ontimeout`/`onabort` handling at all -- a stalled connection
// (goes silent mid-transfer rather than erroring outright, so neither
// `onload` nor `onerror` ever fires) left the returned promise permanently
// unresolved, which left the caller's submitting/progress UI state stuck
// forever with no way to recover short of a full page reload.
describe("cmsCreateTourSceneWithProgress upload timeout", () => {
  it("sets a real wall-clock timeout on the underlying XHR", () => {
    vi.stubGlobal("XMLHttpRequest", MockXHR);

    void cmsCreateTourSceneWithProgress({ title: "صحنه آزمایشی" }, () => {});

    const xhr = MockXHR.instances.at(-1);
    expect(xhr?.timeout).toBeGreaterThan(0);
  });

  it("rejects instead of hanging forever when the upload times out", async () => {
    vi.stubGlobal("XMLHttpRequest", MockXHR);

    const promise = cmsCreateTourSceneWithProgress({ title: "صحنه آزمایشی" }, () => {});
    const xhr = MockXHR.instances.at(-1);
    xhr?.ontimeout?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects instead of hanging forever when the upload is aborted", async () => {
    vi.stubGlobal("XMLHttpRequest", MockXHR);

    const promise = cmsCreateTourSceneWithProgress({ title: "صحنه آزمایشی" }, () => {});
    const xhr = MockXHR.instances.at(-1);
    xhr?.onabort?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });
});
