"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesPeriod } from "@/lib/sales-filters";

const PERIOD_OPTIONS: { value: SalesPeriod; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
];

export function SalesHistoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedDate = searchParams.get("date") ?? "";
  const selectedPeriod = searchParams.get("period");

  const activePeriod: SalesPeriod | null = selectedDate
    ? null
    : selectedPeriod === "today" || selectedPeriod === "yesterday"
      ? selectedPeriod
      : "all";

  function applyFilter(next: URLSearchParams) {
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `/owner/sales?${query}` : "/owner/sales");
    });
  }

  function setPeriod(period: SalesPeriod) {
    applyFilter(new URLSearchParams(period === "all" ? undefined : { period }));
  }

  function setDate(date: string) {
    if (!date) {
      applyFilter(new URLSearchParams());
      return;
    }
    applyFilter(new URLSearchParams({ date }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            disabled={isPending}
            onClick={() => setPeriod(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
              activePeriod === value
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="relative flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
        <CalendarDays className="h-4 w-4 text-neutral-400" />
        <span className="text-sm text-neutral-500">Date</span>
        <input
          type="date"
          value={selectedDate}
          disabled={isPending}
          onChange={(event) => setDate(event.target.value)}
          className={cn(
            "border-0 bg-transparent p-0 text-sm text-neutral-900 outline-none",
            selectedDate && "font-medium"
          )}
        />
      </label>
    </div>
  );
}
