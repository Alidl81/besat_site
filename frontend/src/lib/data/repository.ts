// Repository عمومی با قابلیت سوئیچ بین localStorage (تست) و API واقعی (بک).
//
// نحوه سوئیچ به بک‌اند واقعی:
//   NEXT_PUBLIC_DATA_SOURCE=api  →  از apiRequest استفاده می‌شود
//   در غیر این صورت (پیش‌فرض)     →  از localStorage استفاده می‌شود
//
// وقتی بک آماده شد، فقط کافی است endpoint هر repository را تنظیم و
// متغیر محیطی را به api تغییر دهید. امضای متدها یکسان می‌ماند.

import { apiRequest } from "@/lib/api/client";
import {
  generateId,
  nowIso,
  readCollection,
  writeCollection,
} from "@/lib/data/local-store";
import { readBesatSession } from "@/lib/auth/auth-session";
import type { WithoutSystemFields } from "@/lib/data/domain-types";

export function isApiMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
}

type BaseRecord = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type Repository<T extends BaseRecord> = {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: WithoutSystemFields<T>) => Promise<T>;
  update: (id: string, data: Partial<WithoutSystemFields<T>>) => Promise<T>;
  remove: (id: string) => Promise<void>;
};

type RepositoryConfig<T extends BaseRecord> = {
  collection: string;
  endpoint: string;
  seed?: T[];
};

function authToken(): string | undefined {
  const session = readBesatSession();
  return session?.accessToken;
}

export function createRepository<T extends BaseRecord>(
  config: RepositoryConfig<T>,
): Repository<T> {
  const { collection, endpoint, seed = [] } = config;

  // ---- پیاده‌سازی localStorage ----
  const local: Repository<T> = {
    async list() {
      return readCollection<T>(collection, seed);
    },
    async get(id) {
      const items = readCollection<T>(collection, seed);
      return items.find((item) => item.id === id) ?? null;
    },
    async create(data) {
      const items = readCollection<T>(collection, seed);
      const record = {
        ...(data as object),
        id: generateId(),
        created_at: nowIso(),
        updated_at: nowIso(),
      } as T;
      writeCollection<T>(collection, [record, ...items]);
      return record;
    },
    async update(id, data) {
      const items = readCollection<T>(collection, seed);
      let updated: T | null = null;
      const next = items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...data, updated_at: nowIso() } as T;
        return updated;
      });
      writeCollection<T>(collection, next);
      if (!updated) throw new Error("رکورد یافت نشد.");
      return updated;
    },
    async remove(id) {
      const items = readCollection<T>(collection, seed);
      writeCollection<T>(
        collection,
        items.filter((item) => item.id !== id),
      );
    },
  };

  // ---- پیاده‌سازی API واقعی (آماده بک) ----
  const remote: Repository<T> = {
    async list() {
      const res = await apiRequest<T[] | { results: T[] }>(endpoint, {
        token: authToken(),
      });
      return Array.isArray(res) ? res : res.results;
    },
    async get(id) {
      return apiRequest<T>(`${endpoint}${id}/`, { token: authToken() });
    },
    async create(data) {
      return apiRequest<T>(endpoint, {
        method: "POST",
        token: authToken(),
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return apiRequest<T>(`${endpoint}${id}/`, {
        method: "PATCH",
        token: authToken(),
        body: JSON.stringify(data),
      });
    },
    async remove(id) {
      await apiRequest<void>(`${endpoint}${id}/`, {
        method: "DELETE",
        token: authToken(),
      });
    },
  };

  return isApiMode() ? remote : local;
}
