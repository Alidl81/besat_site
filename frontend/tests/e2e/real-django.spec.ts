import { expect, test } from "@playwright/test";

function resultsOf(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { results?: unknown }).results)
  ) {
    return (payload as { results: Array<Record<string, unknown>> }).results;
  }

  return [];
}

test("production Next BFF uses seeded Django data without a mock fallback", async ({
  page,
}) => {
  const unitsResponse = await page.request.get("/api/backend/units/");
  expect(unitsResponse.status()).toBe(200);
  const units = resultsOf(await unitsResponse.json());
  expect(units.length).toBeGreaterThan(0);

  const seededUnit = units.find(
    (unit) => typeof unit.slug === "string" && unit.slug.includes("phase2-demo"),
  );
  expect(seededUnit).toBeDefined();

  await page.goto("/contact", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('select[name="related_unit"]')).toContainText(
    String(seededUnit?.title ?? ""),
  );
});

test("real Django contact submission is accepted through the production BFF", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "networkidle" });

  await page.locator('input[name="full_name"]').fill("کاربر آزمون فاز دو");
  await page.locator('input[name="phone"]').fill("09120000000");
  await page.locator('input[name="subject"]').fill("پیام آزمون یکپارچه");
  await page
    .locator('textarea[name="message"]')
    .fill("این پیام توسط مسیر آزمایشی یکپارچه جنگو ثبت شده است.");

  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/backend/messages/" &&
      response.request().method() === "POST",
  );
  await page.locator('button[type="submit"]').click();

  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByRole("heading", { name: "پیام ثبت شد" })).toBeVisible();
});

test("seeded general manager can authenticate through the production BFF", async ({
  page,
}) => {
  const password = process.env.BESAT_E2E_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("BESAT_E2E_ADMIN_PASSWORD was not supplied to Playwright.");
  }

  await page.goto("/login");
  await page.locator('input[name="username"]').fill("phase2-e2e-admin");
  await page.locator('input[name="password"]').fill(password);

  const dashboardResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        "/api/backend/dashboard/general-manager/" &&
      response.request().method() === "GET",
  );
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 20_000 });
  expect((await dashboardResponse).status()).toBe(200);
});
