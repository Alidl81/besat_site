import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = process.env.BESAT_MOCK_DB_PATH;
if (!target) throw new Error("BESAT_MOCK_DB_PATH is required");

await copyFile(
  path.join(process.cwd(), "data", "mock-database.seed.json"),
  target,
);
const database = JSON.parse(await readFile(target, "utf8"));
const now = new Date().toISOString();
database.accounts = [
  {
    id: "e2e-admin",
    username: "e2e-admin",
    password: "E2eOnlyPassword!",
    full_name: "مدیر آزمون مرورگر",
    email: "e2e-admin@example.invalid",
    phone: null,
    role: "general_manager",
    role_display: "مدیر مجموعه",
    redirect_path: "/dashboard/admin",
    unit_ids: [],
    is_active: true,
    avatar_url: null,
    created_at: now,
    updated_at: now,
  },
];
database.users = [];
database.students = [];
database.parent_children = [];
database.parent_registrations = [];
database.registration_requests = [];
database.contact_messages = [];
database.internal_messages = [];
database.content = [
  ...database.content,
  {
    id: "e2e-news-featured",
    title: "خبر ویژه آزمون مرورگر",
    slug: "e2e-news-featured",
    summary: "رکورد موقت و ایزوله برای بررسی اسلایدر خبر ویژه.",
    body_html: "<p>محتوای آزمون مرورگر</p>",
    kind: "news",
    status: "published",
    is_featured: true,
    is_important: false,
    priority: 20,
    scope: "complex",
    unit_id: null,
    cover_image: "/images/official/hero/besat-main.jpg",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: "e2e-news-important",
    title: "خبر مهم آزمون مرورگر",
    slug: "e2e-news-important",
    summary: "رکورد موقت و ایزوله برای بررسی بخش خبرهای مهم.",
    body_html: "<p>محتوای آزمون مرورگر</p>",
    kind: "news",
    status: "published",
    is_featured: false,
    is_important: true,
    priority: 10,
    scope: "complex",
    unit_id: null,
    cover_image: "/images/official/hero/besat-hs-banner-03.jpg",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: "e2e-news-unit",
    title: "خبر منتخب واحد آزمون مرورگر",
    slug: "e2e-news-unit",
    summary: "رکورد موقت و ایزوله برای بررسی خبر منتخب واحد آموزشی.",
    body_html: "<p>محتوای آزمون مرورگر</p>",
    kind: "news",
    status: "published",
    is_featured: false,
    is_important: false,
    priority: 5,
    scope: "unit",
    unit_id: "unit-07",
    cover_image: "/images/official/units/unit-07.jpg",
    published_at: now,
    created_at: now,
    updated_at: now,
  },
];
await writeFile(target, `${JSON.stringify(database, null, 2)}\n`, "utf8");
