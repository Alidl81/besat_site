import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const databaseFiles = [
  path.join(process.cwd(), "data", "mock-database.seed.json"),
  path.join(process.cwd(), "data", "mock-database.local.json"),
];

const privateOrSyntheticCollections = [
  "accounts",
  "users",
  "content_revisions",
  "registration_requests",
  "contact_messages",
  "students",
  "classes",
  "staff",
  "events",
  "internal_messages",
  "parent_children",
  "parent_registrations",
];

for (const databaseFile of databaseFiles) {
  const database = JSON.parse(await readFile(databaseFile, "utf8"));

  for (const collection of privateOrSyntheticCollections) {
    database[collection] = [];
  }

  database.content = database.content
    .filter(
      (record) =>
        record.kind !== "news" &&
        !/demo|test|آزمایشی/i.test(
          `${record.id ?? ""} ${record.slug ?? ""} ${record.title ?? ""}`,
        ),
    )
    .map((record) => ({
      ...record,
      author_id: null,
      author_role: null,
    }));
  database.content_categories = database.content_categories.filter(
    (record) =>
      !/demo|test|آزمایشی/i.test(
        `${record.id ?? ""} ${record.slug ?? ""} ${record.title ?? ""}`,
      ),
  );
  database._meta = {
    ...database._meta,
    notice:
      "این پایگاه محلی فقط شامل محتوای عمومی تاییدشده است. داده خصوصی و حساب کاربری در آن توزیع نمی‌شود.",
  };

  await writeFile(
    databaseFile,
    `${JSON.stringify(database, null, 2)}\n`,
    "utf8",
  );
}
