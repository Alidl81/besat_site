import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));

vi.mock("next/navigation", () => ({ permanentRedirect: redirectMock }));

import UnitDetailPage from "@/app/units/[slug]/page";
import UnitNewsPage from "@/app/units/[slug]/news/page";
import UnitGalleryPage from "@/app/units/[slug]/gallery/page";

describe("legacy public unit routes", () => {
  it("permanently redirects the old overview route to the hub query state", async () => {
    await UnitDetailPage({ params: Promise.resolve({ slug: "unit%2Fseven" }) });
    expect(redirectMock).toHaveBeenLastCalledWith("/units?unit=unit%2Fseven");
  });

  it("preserves content-tab intent for old news and gallery routes", async () => {
    await UnitNewsPage({ params: Promise.resolve({ slug: "unit-7" }) });
    await UnitGalleryPage({ params: Promise.resolve({ slug: "unit-7" }) });
    expect(redirectMock).toHaveBeenNthCalledWith(1, "/units?unit=unit-7&tab=news");
    expect(redirectMock).toHaveBeenNthCalledWith(2, "/units?unit=unit-7&tab=gallery");
  });
});
