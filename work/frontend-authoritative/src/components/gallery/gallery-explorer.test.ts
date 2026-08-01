import { describe, expect, it } from "vitest";
import { buildGalleryQuery } from "@/components/gallery/gallery-explorer";

describe("buildGalleryQuery", () => {
  it("maps only backend-supported gallery filters", () => {
    expect(
      buildGalleryQuery(
        {
          search: "جشن",
          unitId: "7",
          album: "اردو",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-30",
          page: 2,
        },
        "جشن",
      ),
    ).toEqual({
      page: 2,
      page_size: 12,
      ordering: "-event_date",
      search: "جشن",
      unit_id: "7",
      album: "اردو",
      date_from: "2026-07-01",
      date_to: "2026-07-30",
    });
  });
});
