import { readBesatSession } from "@/lib/auth/auth-session";
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

function authToken() {
  return readBesatSession()?.accessToken;
}

export function createRepository<T extends BaseRecord>(
  config: RepositoryConfig<T>,
): Repository<T> {
  const endpoint = config.endpoint;
  return {
    async list() {
      const response = await apiRequest<T[] | { results: T[] }>(endpoint, {
        token: authToken(),
      });
      return Array.isArray(response) ? response : response.results;
    },
    async get(id) {
      return apiRequest<T>(`${endpoint}${encodeURIComponent(id)}/`, {
        token: authToken(),
      });
    },
    async create(data) {
      return apiRequest<T>(endpoint, {
        method: "POST",
        token: authToken(),
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return apiRequest<T>(`${endpoint}${encodeURIComponent(id)}/`, {
        method: "PATCH",
        token: authToken(),
        body: JSON.stringify(data),
      });
    },
    async remove(id) {
      await apiRequest<void>(`${endpoint}${encodeURIComponent(id)}/`, {
        method: "DELETE",
        token: authToken(),
      });
    },
  };
}
