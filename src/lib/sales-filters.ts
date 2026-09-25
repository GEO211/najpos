export type SalesPeriod = "all" | "today" | "yesterday";

export type SalesFilter = {
  period: SalesPeriod;
  date?: string;
};

function getLocalDayRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function parseSalesFilter(searchParams: {
  period?: string;
  date?: string;
}): SalesFilter {
  const rawDate = searchParams.date;
  if (typeof rawDate === "string" && rawDate.length <= 10) {
    const date = rawDate.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDate : undefined;
    if (date) return { period: "all", date };
  }

  const rawPeriod = searchParams.period;
  if (
    typeof rawPeriod === "string" &&
    rawPeriod.length <= 20 &&
    (rawPeriod === "today" || rawPeriod === "yesterday")
  ) {
    return { period: rawPeriod };
  }

  return { period: "all" };
}

export function getSalesDateRange(filter: SalesFilter): {
  start: string;
  end: string;
} | null {
  if (filter.date) {
    const [year, month, day] = filter.date.split("-").map(Number);
    return getLocalDayRange(new Date(year, month - 1, day));
  }

  if (filter.period === "today") {
    return getLocalDayRange(new Date());
  }

  if (filter.period === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDayRange(yesterday);
  }

  return null;
}

export function getSalesFilterLabel(filter: SalesFilter): string | null {
  if (filter.date) {
    const [year, month, day] = filter.date.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(year, month - 1, day)
    );
  }

  if (filter.period === "today") return "Today";
  if (filter.period === "yesterday") return "Yesterday";
  return null;
}
