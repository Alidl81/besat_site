import "server-only";

import type {
  MockAccount,
  MockDatabase,
  MockId,
  MockRecord,
} from "@/lib/mock-api/types";

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function apiError(
  detail: string,
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
) {
  return jsonResponse({ detail, code, ...extra }, status);
}

export async function requestPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.text();
    return body.trim()
      ? (JSON.parse(body) as Record<string, unknown>)
      : {};
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const entries = await request.formData();
    return Object.fromEntries(entries.entries());
  }

  return {};
}

export function accountFromRequest(
  request: Request,
  database: MockDatabase,
): MockAccount | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer mock-access:")) return null;
  const accountId = authorization.slice("Bearer mock-access:".length);
  return (
    database.accounts.find(
      (account) => String(account.id) === accountId && account.is_active,
    ) ?? null
  );
}

export function requireAccount(
  request: Request,
  database: MockDatabase,
): MockAccount | Response {
  return (
    accountFromRequest(request, database) ??
    apiError(
      "برای استفاده از endpointهای پنل وارد حساب شوید.",
      401,
      "not_authenticated",
    )
  );
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function includesSearch(record: MockRecord, search: string) {
  return JSON.stringify(record).toLocaleLowerCase("fa").includes(search);
}

function same(value: unknown, expected: string) {
  return String(value ?? "") === expected;
}

export function filterRecords(records: MockRecord[], url: URL) {
  let filtered = [...records];
  const search = url.searchParams.get("search")?.trim().toLocaleLowerCase("fa");

  if (search) {
    filtered = filtered.filter((record) => includesSearch(record, search));
  }

  const directFilters: Array<[string, string[]]> = [
    ["status", ["status"]],
    ["scope", ["scope"]],
    ["kind", ["kind"]],
    ["type", ["kind", "type"]],
    ["unit", ["unit_id", "requested_unit_id"]],
    ["unit_id", ["unit_id", "requested_unit_id"]],
    ["grade", ["grade_id", "requested_grade_id", "grade_title"]],
    ["profile_status", ["profile_status"]],
    ["education_status", ["education_status"]],
    ["featured", ["is_featured"]],
    ["important", ["is_important"]],
    ["album", ["album"]],
    ["category", ["category_id", "category_slug"]],
  ];

  for (const [queryName, fields] of directFilters) {
    const expected = url.searchParams.get(queryName);
    if (!expected) continue;
    filtered = filtered.filter((record) =>
      fields.some((field) => same(record[field], expected)),
    );
  }

  const dateFrom = url.searchParams.get("date_from");
  if (dateFrom) {
    filtered = filtered.filter(
      (record) => String(record.event_date ?? "") >= dateFrom,
    );
  }

  const dateTo = url.searchParams.get("date_to");
  if (dateTo) {
    filtered = filtered.filter(
      (record) => String(record.event_date ?? "") <= dateTo,
    );
  }

  const ordering = url.searchParams.get("ordering");
  if (ordering) {
    const descending = ordering.startsWith("-");
    const field = descending ? ordering.slice(1) : ordering;
    filtered.sort((left, right) => {
      const result = String(left[field] ?? "").localeCompare(
        String(right[field] ?? ""),
        "fa",
      );
      return descending ? -result : result;
    });
  }

  return filtered;
}

export function paginatedResponse(
  records: MockRecord[],
  url: URL,
  transform: (record: MockRecord) => unknown = (record) => record,
) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("page_size") ?? 20) || 20),
  );
  const start = (page - 1) * pageSize;
  const results = records.slice(start, start + pageSize).map(transform);

  return {
    count: records.length,
    next: start + pageSize < records.length ? String(page + 1) : null,
    previous: page > 1 ? String(page - 1) : null,
    results,
  };
}

export function namedRecord(
  records: MockRecord[],
  id: unknown,
): { id: MockId; title: string } | null {
  if (id === null || id === undefined || id === "") return null;
  const record = records.find((item) => same(item.id, String(id)));
  return record
    ? { id: record.id, title: String(record.title ?? record.full_name ?? "") }
    : null;
}

export function createRecord(
  collection: string,
  payload: Record<string, unknown>,
): MockRecord {
  const timestamp = new Date().toISOString();
  return {
    ...payload,
    id: `${collection}-${crypto.randomUUID()}`,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function csvResponse(records: MockRecord[], filename: string) {
  const keys = Array.from(
    new Set(records.flatMap((record) => Object.keys(record))),
  ).filter((key) => !["body_json", "body_html"].includes(key));
  const escape = (value: unknown) => {
    const text =
      value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [
    keys.map(escape).join(","),
    ...records.map((record) => keys.map((key) => escape(record[key])).join(",")),
  ].join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
