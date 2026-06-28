// ذخیره‌گاه محلی عمومی روی localStorage برای تست بدون بک‌اند.
// هر collection با یک کلید مشخص ذخیره می‌شود.

const STORAGE_PREFIX = "besat_db_";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(collection: string): string {
  return `${STORAGE_PREFIX}${collection}`;
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function readCollection<T>(collection: string, seed: T[] = []): T[] {
  if (!canUseStorage()) return seed;
  try {
    const raw = window.localStorage.getItem(storageKey(collection));
    if (raw === null) {
      // اولین بار: seed را می‌نویسیم
      if (seed.length > 0) {
        window.localStorage.setItem(storageKey(collection), JSON.stringify(seed));
      }
      return seed;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return seed;
  }
}

export function writeCollection<T>(collection: string, items: T[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey(collection), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("besat-db-changed", { detail: { collection } }));
  } catch {
    // در صورت پر بودن storage، بی‌صدا رد می‌شویم
  }
}

export function clearCollection(collection: string): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(storageKey(collection));
  window.dispatchEvent(new CustomEvent("besat-db-changed", { detail: { collection } }));
}
