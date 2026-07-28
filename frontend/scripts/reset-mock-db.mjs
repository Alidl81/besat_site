import { copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

await copyFile(
  path.join(root, "data", "mock-database.seed.json"),
  path.join(root, "data", "mock-database.local.json"),
);

console.log("Mock database reset.");
