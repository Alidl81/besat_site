import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicSchoolUnit } from "@/types/public-content";
import { PublicUnitsDirectory } from "@/components/units/public-units-directory";

const units: PublicSchoolUnit[] = [
  {
    id: 1,
    title: "واحد ۱ و ۲ دخترانه با نام طولانی برای آزمون شکست خطوط",
    slug: "girls-long-name",
    kind: "elementary",
    gender: "girls",
    subtitle: "دبستان دخترانه",
    description: null,
    cover_image: null,
    icon: null,
    age_range: null,
    grade_range: null,
    address: "مشهد، خیابان نمونه",
    phone: null,
    phone_secondary: null,
    email: null,
    office_hours: null,
    map_url: null,
    latitude: null,
    longitude: null,
    accepts_registration: true,
  },
  {
    id: 2,
    title: "واحد پسرانه",
    slug: "boys-one",
    kind: "middle_school",
    gender: "boys",
    subtitle: null,
    description: null,
    cover_image: null,
    icon: null,
    age_range: null,
    grade_range: null,
    address: null,
    phone: null,
    phone_secondary: null,
    email: null,
    office_hours: null,
    map_url: null,
    latitude: null,
    longitude: null,
    accepts_registration: false,
  },
];

afterEach(cleanup);

describe("PublicUnitsDirectory", () => {
  it("uses compact links and filters instead of a duplicate dropdown", async () => {
    render(<PublicUnitsDirectory units={units} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /واحد ۱ و ۲/ })).toHaveAttribute(
      "href",
      "/units/girls-long-name",
    );
    expect(screen.getByText("واحد پسرانه")).toBeInTheDocument();

    screen.getByRole("button", { name: "دخترانه" }).click();
    await waitFor(() => {
      expect(screen.getByText(/واحد ۱ و ۲/)).toBeInTheDocument();
      expect(screen.queryByText("واحد پسرانه")).not.toBeInTheDocument();
    });

    screen.getByRole("button", { name: "پسرانه" }).click();
    await waitFor(() => {
      expect(screen.getByText("واحد پسرانه")).toBeInTheDocument();
      expect(screen.queryByText(/واحد ۱ و ۲/)).not.toBeInTheDocument();
    });
  });
});
