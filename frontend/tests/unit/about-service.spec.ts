import { expect, test } from "@playwright/test";
import fixture from "../e2e/fixtures/about-cms-response.json";
import {
  parseDjangoCmsAboutResponse,
  resolveAboutPage,
  type AboutInfo,
} from "../../src/services/about-service";

const legacyPage: AboutInfo = {
  title: "Fallback AboutPage",
  description: "Legacy API content",
  image: null,
  meta_description: "Legacy metadata",
};

test("parses the django CMS contract and all eight plugin types", () => {
  const page = parseDjangoCmsAboutResponse(fixture);

  expect(page.path).toBe("about");
  expect(page.plugins).toHaveLength(8);
  expect(page.plugins.map((plugin) => plugin.plugin_type)).toEqual([
    "AboutHeroPlugin",
    "AboutRichTextPlugin",
    "AboutHistoryPlugin",
    "AboutFoundersPlugin",
    "AboutValuesPlugin",
    "AboutGoalsPlugin",
    "AboutGalleryPlugin",
    "AboutVideoPlugin",
  ]);
});

test("uses django CMS when the flag is enabled and the payload is valid", async () => {
  let legacyCalls = 0;
  const result = await resolveAboutPage({
    useCms: true,
    fetchCms: async () => fixture,
    fetchLegacy: async () => {
      legacyCalls += 1;
      return legacyPage;
    },
  });

  expect(result.source).toBe("django-cms");
  expect(legacyCalls).toBe(0);
});

test("falls back to the existing AboutPage API when django CMS fails", async () => {
  const result = await resolveAboutPage({
    useCms: true,
    fetchCms: async () => {
      throw new Error("CMS unavailable");
    },
    fetchLegacy: async () => legacyPage,
  });

  expect(result.source).toBe("legacy");
  if (result.source === "legacy") {
    expect(result.page.title).toBe("Fallback AboutPage");
    expect(result.cmsError).toContain("CMS unavailable");
  }
});

test("falls back when django CMS returns an empty or incompatible contract", async () => {
  const result = await resolveAboutPage({
    useCms: true,
    fetchCms: async () => ({ title: "Broken", placeholders: [] }),
    fetchLegacy: async () => legacyPage,
  });

  expect(result.source).toBe("legacy");
});

test("falls back when the content placeholder is missing", async () => {
  const result = await resolveAboutPage({
    useCms: true,
    fetchCms: async () => ({
      ...fixture,
      placeholders: [{ slot: "sidebar", content: fixture.placeholders[0].content }],
    }),
    fetchLegacy: async () => legacyPage,
  });

  expect(result.source).toBe("legacy");
});

test("falls back when a recognized plugin has a malformed contract", async () => {
  const result = await resolveAboutPage({
    useCms: true,
    fetchCms: async () => ({
      ...fixture,
      placeholders: [
        { slot: "content", content: [{ plugin_type: "AboutHistoryPlugin" }] },
      ],
    }),
    fetchLegacy: async () => legacyPage,
  });

  expect(result.source).toBe("legacy");
});

test("does not call django CMS when the feature flag is disabled", async () => {
  let cmsCalls = 0;
  const result = await resolveAboutPage({
    useCms: false,
    fetchCms: async () => {
      cmsCalls += 1;
      return fixture;
    },
    fetchLegacy: async () => legacyPage,
  });

  expect(result.source).toBe("legacy");
  expect(cmsCalls).toBe(0);
});
