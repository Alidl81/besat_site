import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const port = 3011;
const baseUrl = `http://127.0.0.1:${port}`;
const databasePath = path.join(os.tmpdir(), `besat-api-smoke-${process.pid}.json`);
const environment = {
  ...process.env,
  BESAT_BACKEND_API_URL: "mock://local",
  BESAT_MOCK_DB_PATH: databasePath,
};

const prepared = spawnSync(
  process.execPath,
  ["tests/e2e/prepare-db.mjs"],
  {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  },
);
if (prepared.status !== 0) {
  throw new Error("Could not prepare the isolated mock database.");
}

const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(port),
  ],
  {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/backend/mock/status/`);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(`Next.js did not start.\n${output}`);
}

async function apiRequest(route, options = {}) {
  const response = await fetch(`${baseUrl}/api/backend/${route}`, options);
  const text = response.status === 204 ? "" : await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${route}: ${response.status} ${text}`,
    );
  }
  return body;
}

let accessToken = "";
let refreshToken = "";
let createdId = null;

try {
  await waitForServer();

  const session = await apiRequest("auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "e2e-admin",
      password: "E2eOnlyPassword!",
    }),
  });
  accessToken = session.access;
  refreshToken = session.refresh;

  const refreshed = await apiRequest("auth/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  accessToken = refreshed.access;

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const currentUser = await apiRequest("me/", { headers: authHeaders });
  if (currentUser.role !== "general_manager") {
    throw new Error("Current-user role contract failed.");
  }

  const created = await apiRequest("cms/content/", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      kind: "news",
      title: "Temporary isolated API smoke record",
      summary: "Created only in the operating-system temporary database.",
      body_html: "<h2>Contract smoke</h2><p>Temporary content.</p>",
      body_json: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Contract smoke" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Temporary content." }],
          },
        ],
      },
      cover_image_url: "/images/official/hero/besat-main.jpg",
      scope: "school",
      is_featured: false,
    }),
  });
  createdId = created.id;
  if (!createdId || !created.cover_image_url) {
    throw new Error("Content creation or cover-image contract failed.");
  }

  const updated = await apiRequest(`cms/content/${createdId}/`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ summary: "Updated by isolated API smoke." }),
  });
  if (updated.summary !== "Updated by isolated API smoke.") {
    throw new Error("Content update contract failed.");
  }

  for (const [action, expectedStatus] of [
    ["submit-review", "waiting_review"],
    ["approve", "approved"],
    ["publish", "published"],
  ]) {
    const transitioned = await apiRequest(
      `cms/content/${createdId}/${action}/`,
      {
        method: "POST",
        headers: authHeaders,
        body: "{}",
      },
    );
    if (transitioned.status !== expectedStatus) {
      throw new Error(`${action} transition contract failed.`);
    }
  }

  const upload = new FormData();
  upload.append(
    "file",
    new Blob(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      { type: "image/png" },
    ),
    "contract-smoke.png",
  );
  const media = await apiRequest("cms/media/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: upload,
  });
  if (!media.url) throw new Error("Multipart media-upload contract failed.");

  console.log("Temporary-backend API smoke passed.");
} finally {
  if (createdId !== null && accessToken) {
    try {
      await apiRequest(`cms/content/${createdId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      console.error("Could not remove the temporary smoke record:", error);
    }
  }

  if (refreshToken) {
    try {
      await apiRequest("auth/logout/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch (error) {
      console.error("Could not complete the logout smoke:", error);
    }
  }

  server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  await rm(databasePath, { force: true });
}
