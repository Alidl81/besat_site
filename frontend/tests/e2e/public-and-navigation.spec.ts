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

test("featured, important, and ordinary news never duplicate across sections", async ({
  page,
}) => {
  // Disjoint 3-way classification: featured -> home slider only, important
  // -> home "اخبار و رویدادها" only, ordinary (neither) -> /news only.
  await page.goto("/");
  const slider = page.locator('section[aria-roledescription="اسلایدر"]');
  await expect(slider).toContainText("خبر ویژه آزمون مرورگر");
  await expect(slider).not.toContainText("خبر مهم آزمون مرورگر");
  await expect(slider).not.toContainText("خبر منتخب واحد آزمون مرورگر");

  // The important-news section is lazily revealed on scroll (Reveal
  // mode="lazy"), so it isn't mounted until it's scrolled into view.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const importantSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "اخبار و رویدادها" }) });
  await expect(importantSection).toContainText("خبر مهم آزمون مرورگر");
  await expect(importantSection).not.toContainText("خبر ویژه آزمون مرورگر");
  await expect(importantSection).not.toContainText("خبر منتخب واحد آزمون مرورگر");

  await page.goto("/news");
  await expect(page.getByText("خبر منتخب واحد آزمون مرورگر")).toBeVisible();
  await expect(page.getByText("خبر ویژه آزمون مرورگر")).toHaveCount(0);
  await expect(page.getByText("خبر مهم آزمون مرورگر")).toHaveCount(0);

  const hrefs = await page.locator('a[href^="/news/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter(Boolean),
  );
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("home slider supports keyboard navigation with a live announcement", async ({
  page,
}) => {
  // Dot indicators (tested below) are the slider's touch/tap interaction;
  // swipe gestures are not implemented.
  await page.goto("/");
  const slider = page.locator('section[aria-roledescription="اسلایدر"]');
  const announcement = slider.locator('[aria-live="polite"]');
  await expect(slider).toBeVisible();
  await expect(announcement).toContainText("خبر ویژه آزمون مرورگر");
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(announcement).not.toContainText("خبر ویژه آزمون مرورگر");
  await page.keyboard.press("Home");
  await expect(announcement).toContainText("خبر ویژه آزمون مرورگر");
});

test("home slider dot indicators are tappable on mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "dot-indicator navigation is exercised on mobile viewports only here");
  await page.goto("/");
  const slider = page.locator('section[aria-roledescription="اسلایدر"]');
  const announcement = slider.locator('[aria-live="polite"]');
  const dots = slider.getByRole("button", { name: /نمایش اسلاید/ });
  const dotCount = await dots.count();
  test.skip(dotCount < 2, "only one slide is seeded, so there is nothing to switch between");
  await dots.nth(1).tap();
  await expect(announcement).not.toContainText("خبر ویژه آزمون مرورگر");
});

test("gallery search is debounced and synchronized to the URL", async ({ page }) => {
  await page.goto("/gallery");
  const search = page.getByRole("searchbox");
  await search.fill("جشن");
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("جشن");
  await expect(page.getByText(/نتیجه/).first()).toBeVisible();
});

test("contact form reports field errors without a network request", async ({ page }) => {
  let messageRequests = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/backend/messages/" &&
      request.method() === "POST"
    ) {
      messageRequests += 1;
    }
  });

  await page.goto("/contact");
  await page.getByRole("button", { name: "ارسال پیام" }).click();
  await expect(
    page.getByText("نام و نام خانوادگی را کامل وارد کنید.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("متن پیام باید حداقل ۱۰ کاراکتر باشد.", { exact: true }),
  ).toBeVisible();
  expect(messageRequests).toBe(0);
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
