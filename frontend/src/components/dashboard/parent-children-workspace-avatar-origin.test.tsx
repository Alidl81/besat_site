/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- test double for an avatar media sink. */
import type { ImgHTMLAttributes } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentChildrenWorkspace } from "@/components/dashboard/parent-children-workspace";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard/parents/children",
  useSearchParams: () => new URLSearchParams(""),
}));

const { requestImpl, parentChild } = vi.hoisted(() => ({
  requestImpl: vi.fn(),
  parentChild: vi.fn(),
}));

vi.mock("@/hooks/use-panel-request", () => ({
  usePanelRequest: (loader: () => unknown, deps: unknown[]) => requestImpl(loader, deps),
}));

vi.mock("@/services/panel-service", () => ({
  panelService: { parentChildren: vi.fn(), parentChild },
}));

const child = {
  id: 1,
  full_name: "فرزند آزمون",
  grade_title: "پایه دهم",
  is_active: true,
  avatar_url: "http://localhost:3000/media/avatars/child.jpg",
};

const detail = {
  ...child,
  major: null,
  unit_title: null,
  average: null,
  class_rank: null,
  grade_rank: null,
  teachers: [
    { id: 9, full_name: "معلم آزمون", subject: "ریاضی", avatar_url: "http://localhost:3000/media/avatars/teacher.jpg" },
  ],
  attendance: null,
  latest_grades: [],
  quick_links: [],
  counselor_message: null,
  exams: [],
};

beforeEach(() => {
  // FE-PANEL-PARENT-CHILDREN-DETAIL-RETRY-DEAD-001: the detail fetch now
  // goes through usePanelRequest too (previously a separate hand-rolled
  // effect calling panelService.parentChild directly) -- the mock must
  // distinguish which loader is being called, since both the children-list
  // and detail requests now share this one mocked hook.
  requestImpl.mockImplementation((loader: () => unknown) => {
    const isDetail = loader.toString().includes("parentChild(");
    return isDetail
      ? { loading: false, error: null, data: detail, reload: vi.fn() }
      : { loading: false, error: null, data: [child], reload: vi.fn() };
  });
  parentChild.mockResolvedValue(detail);
});

const originalLocation = window.location;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

// FE-DASH-AVATAR-MEDIA-ORIGIN-001: child/detail/teacher avatar_url fields
// are backend-served media URLs, the same possibly-wrong-host issue
// already fixed for every other media sink -- next/image's optimizer
// 404s on a host outside next.config.ts's images.remotePatterns.
describe("ParentChildrenWorkspace avatar media-origin normalization", () => {
  it("normalizes the child card, detail, and teacher avatars to this app's own origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://besat.example.com");
    // effectiveSiteUrl() (safe-url.ts) prefers window.location.origin over
    // NEXT_PUBLIC_SITE_URL whenever a window exists -- jsdom always
    // provides one, so this test's simulated "viewing from
    // besat.example.com" needs it stubbed to match.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, origin: "https://besat.example.com" },
    });

    const { container } = render(<ParentChildrenWorkspace />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // These avatars are decorative (alt="") so they carry an implicit
    // "presentation" role, not "img" -- querying the DOM directly instead
    // of by ARIA role.
    const images = Array.from(container.querySelectorAll("img"));
    const srcs = images.map((img) => img.src);

    expect(srcs).toContain("https://besat.example.com/media/avatars/child.jpg");
    expect(srcs).toContain("https://besat.example.com/media/avatars/teacher.jpg");
    expect(srcs.every((src) => !src.includes("localhost:3000"))).toBe(true);
  });
});
