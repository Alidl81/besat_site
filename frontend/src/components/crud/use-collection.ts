"use client";

import { useCallback, useEffect, useState } from "react";
import type { Repository } from "@/lib/data/repository";
import type { WithoutSystemFields } from "@/lib/data/domain-types";

type BaseRecord = { id: string; created_at: string; updated_at: string };

type UseCollectionResult<T extends BaseRecord> = {
  items: T[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  create: (data: WithoutSystemFields<T>) => Promise<void>;
  update: (id: string, data: Partial<WithoutSystemFields<T>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * هوک عمومی برای مدیریت یک collection از repository.
 * فیلتر اختیاری برای محدودسازی نقش‌محور (مثلاً فقط واحد خود کاربر).
 */
export function useCollection<T extends BaseRecord>(
  repository: Repository<T>,
  filter?: (item: T) => boolean,
): UseCollectionResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await repository.list();
      setItems(filter ? data.filter(filter) : data);
    } catch {
      setError("خطا در بارگذاری اطلاعات.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (data: WithoutSystemFields<T>) => {
      await repository.create(data);
      await reload();
    },
    [repository, reload],
  );

  const update = useCallback(
    async (id: string, data: Partial<WithoutSystemFields<T>>) => {
      await repository.update(id, data);
      await reload();
    },
    [repository, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id);
      await reload();
    },
    [repository, reload],
  );

  return { items, loading, error, reload, create, update, remove };
}
