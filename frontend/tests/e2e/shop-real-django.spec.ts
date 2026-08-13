import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BOOK_TITLE = "کتاب آزمون مرورگر";
const COURSE_TITLE = "دوره آزمون مرورگر";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.invalid`;
}

async function registerAndLandOnCheckout(page: import("@playwright/test").Page, emailPrefix: string) {
  await page.goto("/shop/register");
  await page.locator('input[name="full_name"]').fill("کاربر آزمون خرید");
  await page.locator('input[name="email"]').fill(uniqueEmail(emailPrefix));
  await page.locator('input[name="password"]').fill("E2eShop-Pass!234");
  await page.locator('input[name="password_confirm"]').fill("E2eShop-Pass!234");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/shop\/checkout$/, { timeout: 20_000 });
}

test("shop routes have no serious axe findings and no horizontal overflow", async ({ page }) => {
  for (const route of ["/shop", "/shop/register"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    expect(
      results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")),
      `${route} serious accessibility violations`,
    ).toEqual([]);
  }
});

test("buying a physical book: browse, register, checkout, mock-pay, see a real paid status", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByText(BOOK_TITLE)).toBeVisible();
  await page.getByText(BOOK_TITLE).click();
  await expect(page).toHaveURL(/\/shop\/shop-e2e-book$/);

  await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
  await expect(page.getByText("کالا به سبد خرید اضافه شد.")).toBeVisible();

  await registerAndLandOnCheckout(page, "book-buyer");

  // Physical product requires an address -- the form shows automatically
  // since this fresh account has none saved yet.
  await page.getByLabel("نام گیرنده").fill("گیرنده آزمون");
  await page.getByLabel("شماره تماس").fill("09120000001");
  await page.getByLabel("استان").fill("تهران");
  await page.getByLabel("شهر").fill("تهران");
  await page.getByLabel("آدرس", { exact: true }).fill("خیابان آزمون، پلاک ۱");
  await page.getByRole("button", { name: "ذخیره آدرس" }).click();

  await expect(page.getByText("جمع کل")).toBeVisible();
  await page.getByRole("button", { name: "پرداخت و ثبت سفارش" }).click();

  await expect(page).toHaveURL(/\/shop\/payment\/mock\//, { timeout: 20_000 });
  await expect(page.getByText("این یک درگاه پرداخت آزمایشی است")).toBeVisible();
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();

  // The confirmation must reflect a status the backend actually
  // persisted, not merely that the browser bounced back from the
  // "gateway" -- assert against the real order-status API response.
  await expect(page).toHaveURL(/\/shop\/orders\//, { timeout: 20_000 });
  const orderNumber = page.url().split("/shop/orders/")[1];
  const orderResponse = await page.request.get(`/api/backend/shop/orders/${orderNumber}/`);
  expect(orderResponse.ok()).toBe(true);
  const order = await orderResponse.json();
  expect(["paid", "processing", "completed"]).toContain(order.status);
});

test("buying an online course: no address step, entitlement appears only after payment", async ({ page }) => {
  await page.goto("/shop");
  await page.getByText(COURSE_TITLE).click();
  await expect(page).toHaveURL(/\/shop\/shop-e2e-course$/);
  await page.getByRole("button", { name: "ثبت‌نام دوره" }).click();

  await registerAndLandOnCheckout(page, "course-buyer");

  // No shipping/address section for a course-only cart.
  await expect(page.getByText("آدرس ارسال")).toHaveCount(0);

  await page.getByRole("button", { name: "پرداخت و ثبت سفارش" }).click();
  await expect(page).toHaveURL(/\/shop\/payment\/mock\//, { timeout: 20_000 });
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
  await expect(page).toHaveURL(/\/shop\/orders\//, { timeout: 20_000 });

  await page.goto("/dashboard/parents/shop/courses");
  await expect(page.getByText(COURSE_TITLE)).toBeVisible();
  await expect(page.getByRole("link", { name: "ورود به کلاس" })).toBeVisible();
});

test("general manager sees the paid order in the admin panel", async ({ page }) => {
  const password = process.env.BESAT_E2E_ADMIN_PASSWORD;
  if (!password) throw new Error("BESAT_E2E_ADMIN_PASSWORD was not supplied to Playwright.");

  await page.goto("/login");
  await page.locator('input[name="username"]').fill("phase2-e2e-admin");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 20_000 });

  await page.goto("/dashboard/admin/shop/orders");
  await expect(page.getByText("سفارش‌ها").first()).toBeVisible();
  const rows = page.locator(".panel-table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
});
