import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OrderStatus, ProductVariant, Product, Category } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function formatPaymentMethod(method: string): string {
  if (method === "gcash") return "GCash";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function generateSku(name: string, categoryName?: string | null): string {
  const prefix = categoryName
    ? categoryName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X")
    : "KWG";
  const slug = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${slug}-${suffix}`;
}

export function isBeverageCategory(categoryName?: string | null): boolean {
  if (!categoryName) return false;
  const normalized = categoryName.toLowerCase();
  return (
    normalized === "beverages" ||
    normalized === "coffee series" ||
    normalized === "matcha series" ||
    normalized === "non coffee"
  );
}

export function getActiveVariants(product: {
  product_variants?: ProductVariant[];
}): ProductVariant[] {
  return (product.product_variants ?? [])
    .filter((variant) => variant.is_active)
    .sort((a, b) => a.size_label.localeCompare(b.size_label));
}

export function formatProductPrice(product: {
  price: number;
  product_variants?: ProductVariant[];
}): string {
  const variants = getActiveVariants(product);
  if (variants.length === 0) return formatCurrency(Number(product.price));

  if (variants.length === 1) return formatCurrency(Number(variants[0].price));

  const prices = variants.map((variant) => Number(variant.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

export function cartItemKey(item: {
  product: { id: string };
  variant?: { id: string } | null;
}): string {
  return `${item.product.id}-${item.variant?.id ?? "base"}`;
}

export const ADD_ONS_CATEGORY_NAME = "Add-ons";

export function getAddOnProducts(
  products: Product[],
  categories: Category[]
): Product[] {
  const addOnCategory = categories.find(
    (c) => c.name.toLowerCase() === ADD_ONS_CATEGORY_NAME.toLowerCase()
  );
  if (!addOnCategory) return [];
  return products.filter(
    (p) => p.is_active && p.category_id === addOnCategory.id
  );
}

export function isAddOnProduct(
  product: Product,
  categories: Category[]
): boolean {
  const addOnCategory = categories.find(
    (c) => c.name.toLowerCase() === ADD_ONS_CATEGORY_NAME.toLowerCase()
  );
  return Boolean(addOnCategory && product.category_id === addOnCategory.id);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatTransactionId(saleNumber: number): string {
  return `KWG-${String(saleNumber).padStart(6, "0")}`;
}

export function formatOrderStatus(status: OrderStatus): string {
  if (status === "done") return "Done";
  if (status === "void") return "Void";
  return "Pending";
}

