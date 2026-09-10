import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepository } from "@/lib/data/repository";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRepository list()", () => {
  it("follows pagination and returns every page's results, not just the first", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("page=1")) {
        return Response.json({ results: [{ id: "1" }, { id: "2" }], next: "http://ignored/?page=2" });
      }
      if (url.includes("page=2")) {
        return Response.json({ results: [{ id: "3" }], next: null });
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const repository = createRepository<{ id: string; created_at: string; updated_at: string }>({
      collection: "widgets",
      endpoint: "widgets/",
    });

    const all = await repository.list();

    expect(all.map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a raw array response as-is for unpaginated endpoints", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ id: "1" }, { id: "2" }]));
    vi.stubGlobal("fetch", fetchMock);

    const repository = createRepository<{ id: string; created_at: string; updated_at: string }>({
      collection: "widgets",
      endpoint: "widgets/",
    });

    const all = await repository.list();

    expect(all.map((item) => item.id)).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
