import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiDownload } = vi.hoisted(() => ({ apiDownload: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  apiDownload,
  apiRequest: vi.fn(),
}));
vi.mock("@/lib/api/endpoints", () => ({
  apiEndpoints: { cms: { reports: "cms/reports/" } },
}));

import { panelService } from "@/services/panel-service";

beforeEach(() => {
  apiDownload.mockResolvedValue({ blob: new Blob(["unit"]), filename: "panel-report.csv" });
});

describe("reports export transport contract", () => {
  it("requests the backend's supported CSV endpoint without DRF's unsupported format override", async () => {
    await panelService.exportReport();

    expect(apiDownload).toHaveBeenCalledWith("cms/reports/export/", {});
  });
});
