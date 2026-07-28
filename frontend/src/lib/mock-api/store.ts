import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { MockDatabase } from "@/lib/mock-api/types";

const databasePath =
  process.env.BESAT_MOCK_DB_PATH ??
  path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "mock-database.local.json",
  );
const seedPath = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "mock-database.seed.json",
);

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDatabase() {
  try {
    await fs.access(/*turbopackIgnore: true*/ databasePath);
  } catch {
    await fs.mkdir(
      /*turbopackIgnore: true*/ path.dirname(databasePath),
      { recursive: true },
    );
    await fs.copyFile(
      /*turbopackIgnore: true*/ seedPath,
      /*turbopackIgnore: true*/ databasePath,
    );
  }
}

export async function readMockDatabase(): Promise<MockDatabase> {
  await ensureDatabase();
  const raw = await fs.readFile(
    /*turbopackIgnore: true*/ databasePath,
    "utf8",
  );
  return JSON.parse(raw) as MockDatabase;
}

export function updateMockDatabase<T>(
  updater: (database: MockDatabase) => T | Promise<T>,
): Promise<T> {
  const operation = writeQueue.then(async () => {
    const database = await readMockDatabase();
    const result = await updater(database);
    const temporaryPath = `${databasePath}.${process.pid}.tmp`;

    await fs.writeFile(
      /*turbopackIgnore: true*/ temporaryPath,
      `${JSON.stringify(database, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(
      /*turbopackIgnore: true*/ temporaryPath,
      /*turbopackIgnore: true*/ databasePath,
    );
    return result;
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}
