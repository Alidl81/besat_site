import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const fixturePath = fileURLToPath(new URL("./fixtures/about-cms-response.json", import.meta.url));
const cmsFixture = JSON.parse(await readFile(fixturePath, "utf8"));
let mode = "fallback";

const legacy = {
  title: "Fallback AboutPage API",
  description: "محتوای fallback از API فعلی AboutPage",
  image: null,
  meta_description: "Fallback metadata",
};

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3100");

  if (url.pathname === "/__health") return json(response, 200, { status: "ok" });
  if (url.pathname === "/__control") {
    mode = url.searchParams.get("mode") === "cms" ? "cms" : "fallback";
    return json(response, 200, { mode });
  }
  if (url.pathname === "/api/headless-cms/fa-ir/pages/about/") {
    return mode === "cms"
      ? json(response, 200, cmsFixture)
      : json(response, 503, { detail: "CMS test outage" });
  }
  if (url.pathname === "/api/about/") return json(response, 200, legacy);

  return json(response, 404, { detail: "Not found" });
}).listen(3100, "127.0.0.1");
