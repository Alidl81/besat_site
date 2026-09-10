import { apiRequest } from "@/lib/api/client";
import type { WithoutSystemFields } from "@/lib/data/domain-types";

export function isApiMode(): true {
  return true;
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

const MAX_LIST_PAGES = 50;

export function createRepository<T extends BaseRecord>(
  config: RepositoryConfig<T>,
): Repository<T> {
  const endpoint = config.endpoint;
  const separator = endpoint.includes("?") ? "&" : "?";
  return {
    async list() {
      const all: T[] = [];
      for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
        const response = await apiRequest<T[] | { results: T[]; next: string | null }>(
          `${endpoint}${separator}page=${page}`,
        );
        if (Array.isArray(response)) return response;
        all.push(...response.results);
        if (!response.next) break;
      }
      return all;
    },
    async get(id) {
      return apiRequest<T>(`${endpoint}${encodeURIComponent(id)}/`, {
      });
    },
    async create(data) {
      return apiRequest<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return apiRequest<T>(`${endpoint}${encodeURIComponent(id)}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async remove(id) {
      await apiRequest<void>(`${endpoint}${encodeURIComponent(id)}/`, {
        method: "DELETE",
      });
    },
  };
}
