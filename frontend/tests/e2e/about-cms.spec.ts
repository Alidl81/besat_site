import { expect, test, type APIRequestContext } from "@playwright/test";

async function setApiMode(request: APIRequestContext, mode: "cms" | "fallback") {
  const response = await request.get(`http://127.0.0.1:3100/__control?mode=${mode}`);
  expect(response.ok()).toBeTruthy();
}

test("renders the existing AboutPage API when django CMS returns an error", async ({ page, request }) => {
  await setApiMode(request, "fallback");
  await page.goto("/about");

  await expect(page.getByRole("heading", { name: "Fallback AboutPage API", level: 1 })).toBeVisible();
  await expect(page.getByText("محتوای fallback از API فعلی AboutPage")).toBeVisible();
  await expect(page.getByText("سال سابقه درخشان")).toBeVisible();
});

test("renders all requested django CMS About plugins", async ({ page, request }) => {
  await setApiMode(request, "cms");
  await page.goto("/about");

  await expect(page.getByRole("heading", { name: "Hero از django CMS", level: 1 })).toBeVisible();
  await expect(page.getByText("متن غنی امن از CMS")).toBeVisible();
  await expect(page.getByText("آغاز فعالیت")).toBeVisible();
  await expect(page.getByText("بنیان‌گذار نمونه تست")).toBeVisible();
  await expect(page.getByText("صداقت")).toBeVisible();
  await expect(page.getByText("رشد علمی")).toBeVisible();
  await expect(page.getByAltText("تصویر تست گالری")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ویدئوی معرفی", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fallback AboutPage API" })).toHaveCount(0);
});
