import { describe, expect, it } from "vitest";
import { validateContactMessage } from "@/components/contact/contact-form";

describe("validateContactMessage", () => {
  it("requires a response channel and useful message", () => {
    const errors = validateContactMessage({
      full_name: "ا",
      message_type: "general",
      message: "کوتاه",
    });

    expect(errors).toMatchObject({
      full_name: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
      message: expect.any(String),
    });
    expect(errors).not.toHaveProperty("related_unit");
  });

  it("accepts a valid email-only submission without a unit selector", () => {
    expect(
      validateContactMessage({
        full_name: "علی رضایی",
        email: "ali@example.com",
        message_type: "suggestion",
        message: "این یک پیشنهاد کامل برای مدرسه است.",
      }),
    ).toEqual({});
  });
});
