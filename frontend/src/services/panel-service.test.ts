import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiDownload: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiDownload: mocks.apiDownload,
  apiRequest: mocks.apiRequest,
}));

import { panelService } from "@/services/panel-service";

describe("panelService content contract", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it("passes server filters directly instead of client-side pagination", async () => {
    mocks.apiRequest.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      summary: {},
      results: [],
    });

    await panelService.content({
      kind: "news",
      status: "in_review",
      author: "me",
      ordering: "-updated_at",
      page: 2,
      page_size: 20,
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "cms/content/?kind=news&status=in_review&author=me&ordering=-updated_at&page=2&page_size=20",
      {},
    );
  });

  it("sends the version in both the request body and If-Match header", async () => {
    mocks.apiRequest.mockResolvedValue({ id: 42, version: 8 });

    await panelService.updateContent(42, { title: "نسخه جدید" }, 7);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "cms/content/42/",
      {
        method: "PATCH",
        headers: { "If-Match": 'W/"content-42-v7"' },
        body: JSON.stringify({ title: "نسخه جدید", version: 7 }),
      },
    );

    await panelService.contentAction(42, "approve", { comment: "تأیید" }, 8);
    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      "cms/content/42/approve/",
      {
        method: "POST",
        headers: { "If-Match": 'W/"content-42-v8"' },
        body: JSON.stringify({ comment: "تأیید", version: 8 }),
      },
    );
  });

  it("uses the scoped compare endpoint without a write token", async () => {
    mocks.apiRequest.mockResolvedValue({ base: {}, target: {}, changes: {} });

    await panelService.contentRevisionComparison(42, 11);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      "cms/content/42/revisions/11/compare/",
      {},
    );
  });

  // FE-CMS-EDITOR-PREVIEW-404-001: CMSContentViewSet never had a "preview"
  // action, so this always 404'd for any already-saved, non-dirty content.
  // contentPreview() now reuses the plain, already-working detail endpoint
  // (the same one contentItem() calls) instead of a nonexistent action.
  it("fetches the server preview from the existing content detail endpoint, not a nonexistent preview action", async () => {
    mocks.apiRequest.mockResolvedValue({ id: 42 });

    await panelService.contentPreview(42);

    expect(mocks.apiRequest).toHaveBeenCalledWith("cms/content/42/", {});
  });
});
