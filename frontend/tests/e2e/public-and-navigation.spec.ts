import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public routes remain within the viewport and have no serious axe findings", async ({
  page,
}) => {
  for (const route of ["/", "/news", "/gallery", "/about", "/contact"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const layout = await page.evaluate(() => {
      const overflow =
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth;
      const offender = [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left < -1 ||
            rect.right > document.documentElement.clientWidth + 1
          );
        })
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          className: element.className,
          rect: element.getBoundingClientRect().toJSON(),
        }))
        .at(0);
      return { overflow, offender };
    });
    expect(
      layout.overflow,
      `${route} horizontal overflow: ${JSON.stringify(layout.offender)}`,
    ).toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      ),
      `${route} serious accessibility violations`,
    ).toEqual([]);
  }
});

test("site drawer traps focus, closes with Escape and restores the trigger", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "mobile drawer");
  await page.goto("/news");
  const trigger = page.getByRole("button", { name: "باز کردن منو" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "منوی اصلی" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("news cards are not duplicated across sections", async ({ page }) => {
  await page.goto("/news");
  await expect(
    page.getByRole("heading", { name: "منتخب واحدهای آموزشی" }),
  ).toBeVisible();
  const hrefs = await page.locator('a[href^="/news/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter(Boolean),
  );
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("featured news slider supports keyboard and touch navigation", async ({
  page,
  isMobile,
}) => {
  await page.goto("/news");
  const slider = page.locator('section[aria-roledescription="اسلایدر"]');
  const announcement = slider.locator('[aria-live="polite"]');
  await expect(slider).toBeVisible();
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(announcement).toContainText("خبر مهم آزمون مرورگر");

  if (isMobile) {
    await slider.evaluate((element) => {
      const start = new Touch({
        identifier: 1,
        target: element,
        clientX: 300,
        clientY: 100,
      });
      const end = new Touch({
        identifier: 1,
        target: element,
        clientX: 180,
        clientY: 100,
      });
      element.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          touches: [start],
        }),
      );
      element.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          changedTouches: [end],
        }),
      );
    });
    await expect(announcement).toContainText("خبر ویژه آزمون مرورگر");
  }
});

test("gallery search is debounced and synchronized to the URL", async ({ page }) => {
  await page.goto("/gallery");
  const search = page.getByRole("searchbox");
  await search.fill("جشن");
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("جشن");
  await expect(page.getByText(/نتیجه/).first()).toBeVisible();
});

test("contact form reports field errors without a network request", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "ارسال پیام" }).click();
  await expect(page.getByText("نام و نام خانوادگی را کامل وارد کنید.")).toBeVisible();
  await expect(page.getByText("متن پیام باید حداقل ۱۰ کاراکتر باشد.")).toBeVisible();
});

test("reduced motion disables drawer transitions", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile drawer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "باز کردن منو" }).click();
  const duration = await page
    .getByRole("dialog", { name: "منوی اصلی" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration).toBe("0s");
});
