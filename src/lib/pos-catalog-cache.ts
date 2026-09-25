import type { Category, Product } from "@/types/database";

export type PosCacheMode = "live" | "temp";

const STORAGE_KEY = "HALIYA POS-pos-catalog-temp";
const CACHE_VERSION = 1;

type PosCatalogCachePayload = {
  version: number;
  cachedAt: number;
  products: Product[];
  categories: Category[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCatalog(payload: PosCatalogCachePayload): boolean {
  return (
    Array.isArray(payload.products) &&
    Array.isArray(payload.categories) &&
    payload.products.length > 0
  );
}

export function readPosCatalogCache(): PosCatalogCachePayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const payload = parsed as PosCatalogCachePayload;
    if (payload.version !== CACHE_VERSION || !isValidCatalog(payload)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return payload;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writePosCatalogCache(
  products: Product[],
  categories: Category[]
): void {
  if (typeof window === "undefined" || products.length === 0) return;

  const payload: PosCatalogCachePayload = {
    version: CACHE_VERSION,
    cachedAt: Date.now(),
    products,
    categories,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function clearPosCatalogCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
