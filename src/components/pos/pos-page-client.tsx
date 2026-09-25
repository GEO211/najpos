"use client";

import { useCallback, useEffect, useState } from "react";
import { getPosCatalog } from "@/app/actions";
import { PosTerminal } from "@/components/pos/pos-terminal";
import {
  readPosCatalogCache,
  writePosCatalogCache,
  type PosCacheMode,
} from "@/lib/pos-catalog-cache";
import type { Category, Product } from "@/types/database";
import { Loader2, WifiOff } from "lucide-react";

export function PosPageClient({ beeperEnabled = false }: { beeperEnabled?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cacheMode, setCacheMode] = useState<PosCacheMode>("temp");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const refreshCatalog = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setRefreshing(true);
    }

    try {
      const result = await getPosCatalog();

      if ("error" in result) {
        setFetchError(result.error);
        return;
      }

      setProducts(result.products);
      setCategories(result.categories);
      writePosCatalogCache(result.products, result.categories);
      setCacheMode("live");
      setFetchError(null);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readPosCatalogCache();
    if (cached) {
      setProducts(cached.products);
      setCategories(cached.categories);
      setCacheMode("temp");
      setLoading(false);
    }

    void refreshCatalog({ silent: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    function handleFocus() {
      if (navigator.onLine) {
        void refreshCatalog({ silent: true });
      }
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshCatalog]);

  if (loading && products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white text-neutral-500">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" strokeWidth={1.5} />
        <p className="text-sm">Loading menu...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <WifiOff className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
        <p className="text-sm font-medium text-neutral-900">Menu unavailable</p>
        <p className="max-w-sm text-sm text-neutral-500">
          {fetchError ??
            "No active products in the database. Add products or run npm run menu:seed."}
        </p>
        <button
          type="button"
          onClick={() => void refreshCatalog()}
          className="mt-2 rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <PosTerminal
      products={products}
      categories={categories}
      cacheMode={cacheMode}
      isRefreshing={refreshing}
      isOnline={isOnline}
      beeperEnabled={beeperEnabled}
    />
    </div>
  );
}
