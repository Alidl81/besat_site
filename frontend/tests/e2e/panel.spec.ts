import { expect, test } from "@playwright/test";

test("panel drawer is modal on mobile and desktop sidebar does not overflow", async ({
  page,
  isMobile,
}) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری").fill("e2e-admin");
  await page.getByLabel("رمز عبور").fill("E2eOnlyPassword!");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin$/);

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
