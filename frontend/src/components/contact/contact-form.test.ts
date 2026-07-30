import { describe, expect, it } from "vitest";
import { validateContactMessage } from "@/components/contact/contact-form";
import type { PublicSchoolUnit } from "@/types/public-content";

const unit: PublicSchoolUnit = {
  id: 1,
  title: "واحد یک",
  slug: "unit-one",
  kind: "elementary",
  gender: "mixed",
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
  accepts_registration: true,
};

describe("validateContactMessage", () => {
  it("requires a response channel, useful message and valid unit", () => {
    const errors = validateContactMessage(
      {
        full_name: "ا",
        related_unit: 99,
        message_type: "general",
        message: "کوتاه",
      },
      [unit],
    );
    expect(errors).toMatchObject({
      full_name: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
      related_unit: expect.any(String),
      message: expect.any(String),
    });
  });

  it("accepts a valid email-only submission", () => {
    expect(
      validateContactMessage(
        {
          full_name: "علی رضایی",
          email: "ali@example.com",
          related_unit: 1,
          message_type: "suggestion",
          message: "این یک پیشنهاد کامل برای مدرسه است.",
        },
        [unit],
      ),
    ).toEqual({});
  });
});
