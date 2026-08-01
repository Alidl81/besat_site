import { expect, test } from "@playwright/test";

test("panel drawer is modal on mobile and desktop sidebar does not overflow", async ({
  page,
  isMobile,
}) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill("e2e-admin");
  await page.getByLabel("رمز عبور").fill("E2eOnlyPassword!");
  const contextResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/backend/dashboard/context/" &&
      response.request().method() === "GET",
  );
  const dashboardResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        "/api/backend/dashboard/general-manager/" &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 20_000 });
  const [contextResponse, dashboardResponse] = await Promise.all([
    contextResponsePromise,
    dashboardResponsePromise,
  ]);
  expect(contextResponse.status()).toBe(200);
  expect(contextResponse.headers().location).toBeUndefined();
  expect(dashboardResponse.status()).toBe(200);
  expect(dashboardResponse.headers().location).toBeUndefined();
  await expect(page.getByRole("heading", { name: "داشبورد مدیریت" })).toBeVisible();

  if (isMobile) {
    const trigger = page.getByRole("button", { name: "باز کردن منو" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "منوی پنل" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    return;
  }

  const menu = page.getByRole("navigation", { name: "منوی پنل" });
  await expect(menu).toBeVisible();
  const dimensions = await menu.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
});
