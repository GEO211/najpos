import type { PaymentMethod } from "@/types/database";
import { BEEPER_MAX, BEEPER_MIN } from "@/lib/beeper";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const LIMITS = {
  email: 254,
  password: 128,
  adminCode: 64,
  fullName: 100,
  productName: 120,
  categoryName: 80,
  searchQuery: 100,
  saleItems: 50,
  quantity: 9999,
  price: 999_999.99,
  amountPaid: 9_999_999.99,
  taxRate: 1,
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "gcash", "other"]);
const USER_ROLES = new Set(["owner", "cashier"] as const);

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

function invalid(label: string): ValidationResult<never> {
  return { ok: false, error: `Invalid ${label}.` };
}

function required(label: string): ValidationResult<never> {
  return { ok: false, error: `${label} is required.` };
}

function tooLong(label: string, max: number): ValidationResult<never> {
  return { ok: false, error: `${label} is too long (max ${max} characters).` };
}

function hasControlChars(value: string): boolean {
  return CONTROL_CHARS_RE.test(value);
}

export function getFormString(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1) return null;
  const value = values[0];
  if (typeof value !== "string") return null;
  return value;
}

function parseText(
  value: unknown,
  label: string,
  maxLen: number,
  { required: isRequired = true }: { required?: boolean } = {}
): ValidationResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return isRequired ? required(label) : { ok: true, value: null };
  }
  if (typeof value !== "string") return invalid(label);
  const trimmed = value.trim();
  if (!trimmed) return isRequired ? required(label) : { ok: true, value: null };
  if (trimmed.length > maxLen) return tooLong(label, maxLen);
  if (hasControlChars(trimmed)) return invalid(label);
  return { ok: true, value: trimmed };
}

export function parseEmail(value: unknown): ValidationResult<string> {
  const text = parseText(value, "Email", LIMITS.email);
  if (!text.ok) return text;
  const email = text.value!.toLowerCase();
  if (!EMAIL_RE.test(email)) return invalid("email address");
  return { ok: true, value: email };
}

export function parsePassword(
  value: unknown,
  minLen = 6
): ValidationResult<string> {
  if (typeof value !== "string") return invalid("password");
  if (value.length < minLen) {
    return {
      ok: false,
      error: `Password must be at least ${minLen} characters.`,
    };
  }
  if (value.length > LIMITS.password) return tooLong("Password", LIMITS.password);
  if (hasControlChars(value)) return invalid("password");
  return { ok: true, value: value };
}

export function parseAdminCode(value: unknown): ValidationResult<string> {
  return parseText(value, "Admin code", LIMITS.adminCode) as ValidationResult<string>;
}

export function parseFullName(
  value: unknown,
  { required: isRequired = true }: { required?: boolean } = {}
): ValidationResult<string> {
  const text = parseText(value, "Full name", LIMITS.fullName, {
    required: isRequired,
  });
  if (!text.ok) return text;
  if (!text.value) {
    return isRequired ? required("Full name") : { ok: true, value: "" };
  }
  return { ok: true, value: text.value };
}

export function parseUserRole(value: unknown): ValidationResult<"owner" | "cashier"> {
  const text = parseText(value, "Role", 20);
  if (!text.ok) return text;
  if (!USER_ROLES.has(text.value as "owner" | "cashier")) {
    return invalid("role");
  }
  return { ok: true, value: text.value as "owner" | "cashier" };
}

export function parseUuid(value: unknown, label = "ID"): ValidationResult<string> {
  if (typeof value !== "string") return invalid(label);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 36) return invalid(label);
  if (!UUID_RE.test(trimmed)) return invalid(label);
  return { ok: true, value: trimmed.toLowerCase() };
}

export function parseOptionalUuid(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  const parsed = parseUuid(value, "category");
  if (!parsed.ok) return parsed;
  return parsed;
}

export function parseProductName(value: unknown): ValidationResult<string> {
  return parseText(value, "Product name", LIMITS.productName) as ValidationResult<string>;
}

export function parseCategoryName(value: unknown): ValidationResult<string> {
  return parseText(value, "Category name", LIMITS.categoryName) as ValidationResult<string>;
}

export function parsePrice(value: unknown, label = "Price"): ValidationResult<number> {
  if (typeof value !== "string" && typeof value !== "number") {
    return invalid(label.toLowerCase());
  }

  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return required(label);
  if (raw.length > 20) return tooLong(label, 20);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return invalid(label.toLowerCase());

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return invalid(label.toLowerCase());
  if (amount < 0 || amount > LIMITS.price) {
    return { ok: false, error: `${label} is out of range.` };
  }

  return { ok: true, value: amount };
}

export function parseBooleanFormValue(value: unknown): ValidationResult<boolean> {
  if (value === "true") return { ok: true, value: true };
  if (value === "false") return { ok: true, value: false };
  return invalid("status");
}

export function parsePaymentMethod(value: unknown): ValidationResult<PaymentMethod> {
  if (typeof value !== "string") return invalid("payment method");
  const trimmed = value.trim();
  if (!PAYMENT_METHODS.has(trimmed as PaymentMethod)) {
    return invalid("payment method");
  }
  return { ok: true, value: trimmed as PaymentMethod };
}

export function parseAmountPaid(value: unknown): ValidationResult<number> {
  const parsed = parsePrice(value, "Amount paid");
  if (!parsed.ok) return parsed;
  if (parsed.value > LIMITS.amountPaid) {
    return { ok: false, error: "Amount paid is out of range." };
  }
  return parsed;
}

export function parseTaxRate(value: unknown): ValidationResult<number> {
  if (typeof value !== "number") return invalid("tax rate");
  if (!Number.isFinite(value) || value < 0 || value > LIMITS.taxRate) {
    return { ok: false, error: "Invalid tax rate." };
  }
  return { ok: true, value: value };
}

export type SaleItemInput = {
  product_id: string;
  quantity: number;
  variant_id: string | null;
};

export function parseSaleItems(value: unknown): ValidationResult<SaleItemInput[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Invalid sale items." };
  }
  if (value.length === 0) {
    return { ok: false, error: "Cart is empty." };
  }
  if (value.length > LIMITS.saleItems) {
    return { ok: false, error: "Too many items in cart." };
  }

  const items: SaleItemInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Invalid sale item." };
    }

    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).some(
        (key) => !["product_id", "quantity", "variant_id"].includes(key)
      )
    ) {
      return { ok: false, error: "Invalid sale item." };
    }

    const productId = parseUuid(record.product_id, "product");
    if (!productId.ok) return { ok: false, error: "Invalid product in cart." };

    let variantId: string | null = null;
    if (record.variant_id !== undefined && record.variant_id !== null) {
      const parsedVariant = parseUuid(record.variant_id, "variant");
      if (!parsedVariant.ok) {
        return { ok: false, error: "Invalid product variant in cart." };
      }
      variantId = parsedVariant.value;
    }

    if (
      typeof record.quantity !== "number" ||
      !Number.isInteger(record.quantity) ||
      record.quantity < 1 ||
      record.quantity > LIMITS.quantity
    ) {
      return { ok: false, error: "Invalid item quantity." };
    }

    items.push({
      product_id: productId.value,
      quantity: record.quantity,
      variant_id: variantId,
    });
  }

  return { ok: true, value: items };
}

export function parseBeeperNumber(value: unknown): ValidationResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: "Beeper number is required." };
  }
  if (value < BEEPER_MIN || value > BEEPER_MAX) {
    return {
      ok: false,
      error: `Beeper number must be between ${BEEPER_MIN} and ${BEEPER_MAX}.`,
    };
  }
  return { ok: true, value };
}

export function parseOptionalBeeperNumber(
  value: unknown
): ValidationResult<number | null> {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  return parseBeeperNumber(value);
}

export function sanitizeSearchInput(
  value: string,
  maxLen: number = LIMITS.searchQuery
): string {
  return value.replace(CONTROL_CHARS_RE, "").slice(0, maxLen);
}

export function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", fraction = ""] = cleaned.split(".");
  const safeWhole = whole.slice(0, 12);
  if (!cleaned.includes(".")) return safeWhole;
  return `${safeWhole}.${fraction.slice(0, 2)}`;
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(LIMITS.quantity, Math.max(1, Math.floor(value)));
}

export function rejectMalformedForm(formData: FormData): string | null {
  for (const [, value] of formData.entries()) {
    if (typeof value !== "string") {
      return "Invalid form submission.";
    }
  }
  return null;
}
