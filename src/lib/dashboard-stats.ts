export interface WeeklyPoint {
  label: string;
  revenue: number;
  sales: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
}

export function getWeekStart(): Date {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return start;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildWeeklySeries(
  sales: { total: number; created_at: string }[]
): WeeklyPoint[] {
  const days: (WeeklyPoint & { dateKey: string })[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    days.push({
      label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
      dateKey: localDateKey(date),
      revenue: 0,
      sales: 0,
    });
  }

  for (const sale of sales) {
    const key = localDateKey(new Date(sale.created_at));
    const day = days.find((entry) => entry.dateKey === key);
    if (!day) continue;
    day.revenue += Number(sale.total);
    day.sales += 1;
  }

  return days.map(({ label, revenue, sales }) => ({
    label,
    revenue,
    sales,
  }));
}

export function buildTopProducts(
  saleItems: { product_name: string; quantity: number }[],
  limit = 5
): TopProduct[] {
  const totals = new Map<string, number>();

  for (const item of saleItems) {
    totals.set(
      item.product_name,
      (totals.get(item.product_name) ?? 0) + item.quantity
    );
  }

  return [...totals.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
