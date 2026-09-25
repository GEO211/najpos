"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  buildOrdersSearchParams,
  parseOrdersCategory,
  parseOrdersPeriod,
  type OrdersPeriod,
} from "@/lib/orders-filters";

const PERIOD_OPTIONS: { value: OrdersPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "past", label: "Past" },
];

function OrdersPeriodFiltersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activePeriod = parseOrdersPeriod({
    period: searchParams.get("period") ?? undefined,
  });
  const category = parseOrdersCategory({
    status: searchParams.get("status") ?? undefined,
  });

  function setPeriod(period: OrdersPeriod) {
    const params = buildOrdersSearchParams(period, category);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/owner/orders?${query}` : "/owner/orders");
    });
  }

  return (
    <div className="flex w-full max-w-md rounded-lg border border-border p-1 sm:w-auto">
      {PERIOD_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          disabled={isPending}
          onClick={() => setPeriod(value)}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors disabled:opacity-60 sm:min-w-[5.5rem]",
            activePeriod === value
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

export function OrdersPeriodFilters() {
  return (
    <Suspense fallback={null}>
      <OrdersPeriodFiltersContent />
    </Suspense>
  );
}
