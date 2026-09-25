"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  buildOrdersSearchParams,
  parseOrdersCategory,
  parseOrdersPeriod,
  type OrdersStatusCategory,
} from "@/lib/orders-filters";

const STATUS_OPTIONS: { value: OrdersStatusCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
];

function OrdersStatusFiltersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const period = parseOrdersPeriod({
    period: searchParams.get("period") ?? undefined,
  });
  const activeCategory = parseOrdersCategory({
    status: searchParams.get("status") ?? undefined,
  });

  function setCategory(category: OrdersStatusCategory) {
    const params = buildOrdersSearchParams(period, category);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/owner/orders?${query}` : "/owner/orders");
    });
  }

  return (
    <div className="flex w-full max-w-sm rounded-lg border border-border p-1">
      {STATUS_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          disabled={isPending}
          onClick={() => setCategory(value)}
          className={cn(
            "flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors disabled:opacity-60",
            activeCategory === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function OrdersStatusFilters() {
  return (
    <Suspense fallback={null}>
      <OrdersStatusFiltersContent />
    </Suspense>
  );
}
