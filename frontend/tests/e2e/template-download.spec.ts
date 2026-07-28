import { expect, test } from "@playwright/test";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe("CSV template download", () => {
  test("requires dashboard authentication", async ({ page }) => {
    await page.goto("/dashboard/unit-manager/students");

    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Funit-manager%2Fstudents$/);
  });

  test.skip(!username || !password, "Set E2E_USERNAME and E2E_PASSWORD for the Docker browser check.");

  test("downloads a non-empty UTF-8 template without an API request", async ({ page }) => {
    let apiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).port === "8000") apiRequests.push(request.url());
    });

    await page.goto("/login?next=%2Fdashboard%2Funit-manager%2Fstudents");
    await page.locator('input[name="username"]').fill(username!);
    await page.locator('input[name="password"]').fill(password!);
    await page.getByRole("button", { name: "ورود" }).click();
    await page.waitForURL("**/dashboard/unit-manager/students");

    await page.getByRole("button", { name: "نمایش ورود Excel" }).click();
    apiRequests = [];
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "دانلود فایل نمونه" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("template.csv");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const content = Buffer.concat(chunks);

    expect(content.length).toBeGreaterThan(3);
    expect(content.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(content.toString("utf8")).toContain("نام و نام خانوادگی");
    expect(apiRequests).toEqual([]);
  });
});
