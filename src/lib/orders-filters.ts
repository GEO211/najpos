export type OrdersPeriod = "today" | "yesterday" | "past";
export type OrdersStatusCategory = "all" | "pending" | "done";

function getLocalDayRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function parseOrdersPeriod(searchParams: {
  period?: string;
  status?: string;
}): OrdersPeriod {
  const raw = searchParams.period;
  if (raw === "yesterday") return "yesterday";
  if (raw === "past") return "past";
  return "today";
}

export function parseOrdersCategory(searchParams: {
  status?: string;
}): OrdersStatusCategory {
  const raw = searchParams.status;
  if (raw === "all") return "all";
  if (raw === "done") return "done";
  return "pending";
}

export function buildOrdersSearchParams(
  period: OrdersPeriod,
  category: OrdersStatusCategory
): URLSearchParams {
  const params = new URLSearchParams();
  if (period !== "today") params.set("period", period);
  if (category !== "pending") params.set("status", category);
  return params;
}

export function getOrdersCategoryLabel(category: OrdersStatusCategory): string {
  if (category === "pending") return "Pending";
  if (category === "done") return "Done";
  return "All";
}

export function getOrdersPeriodLabel(period: OrdersPeriod): string {
  if (period === "yesterday") return "Yesterday";
  if (period === "past") return "Past";
  return "Today";
}

export type OrdersDateFilter =
  | { type: "range"; start: string; end: string }
  | { type: "before"; before: string };

export function getOrdersDateFilter(period: OrdersPeriod): OrdersDateFilter {
  const today = getLocalDayRange(new Date());

  if (period === "today") {
    return { type: "range", start: today.start, end: today.end };
  }

  if (period === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const range = getLocalDayRange(yesterday);
    return { type: "range", start: range.start, end: range.end };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { start: before } = getLocalDayRange(yesterday);
  return { type: "before", before };
}

export const PAST_ORDERS_LIMIT = 100;
