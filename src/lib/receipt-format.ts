import type { ReceiptData } from "@/lib/print-receipt";
import { formatPaymentMethod } from "@/lib/utils";

/** Printable width for 58mm thermal paper (PT-210) */
export const RECEIPT_WIDTH = 32;
const AMOUNT_WIDTH = 10;

export const RECEIPT_DEVELOPER_NAME = "GeoDevelopment";
export const RECEIPT_DEVELOPER_URL = "https://geodev21.vercel.app/";
export const RECEIPT_DEVELOPER_LABEL = `Developed by ${RECEIPT_DEVELOPER_NAME}`;

export const RECEIPT_ACKNOWLEDGE_LABEL = "ACKNOWLEDGE RECEIPT";

/** Blank lines fed before the receipt body and before the paper cut */
export const RECEIPT_TOP_FEED_LINES = 4;
export const RECEIPT_BOTTOM_FEED_LINES = 6;

export function formatReceiptDate(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatReceiptAmount(amount: number): string {
  return `P${amount.toFixed(2)}`;
}

export function sanitizeReceiptText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, "");
}

export function truncateReceiptText(text: string, maxLength: number): string {
  const sanitized = sanitizeReceiptText(text);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, Math.max(0, maxLength - 3)) + "...";
}

export function padReceiptLine(
  left: string,
  right: string,
  width: number = RECEIPT_WIDTH
): string {
  const amount = right.padStart(AMOUNT_WIDTH).slice(-AMOUNT_WIDTH);
  const maxLeft = width - amount.length - 1;
  const leftText = left.length > maxLeft ? left.slice(0, maxLeft) : left;
  const gap = width - leftText.length - amount.length;
  return leftText + " ".repeat(Math.max(1, gap)) + amount;
}

export function receiptRule(width: number = RECEIPT_WIDTH): string {
  return "-".repeat(width);
}

export function receiptStrongRule(width: number = RECEIPT_WIDTH): string {
  return "=".repeat(width);
}

export function formatReceiptSummaryLine(lineCount: number, quantityTotal: number): string {
  return sanitizeReceiptText(`${lineCount} lines, ${quantityTotal} qty`);
}

export function getReceiptSummary(data: ReceiptData) {
  const lineCount = data.items.length;
  const quantityTotal = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return { lineCount, quantityTotal };
}

export function buildReceiptPlainText(data: ReceiptData): string {
  const lines: string[] = [];
  const { lineCount, quantityTotal } = getReceiptSummary(data);

  lines.push(...Array.from({ length: RECEIPT_TOP_FEED_LINES }, () => ""));
  lines.push(receiptStrongRule());
  lines.push(centerReceiptText("HALIYA POS"));
  lines.push(centerReceiptText(formatReceiptDate(data.date)));

  if (data.beeperNumber != null) {
    lines.push("");
    lines.push(centerReceiptText(`BEEPER #${data.beeperNumber}`));
  }

  if (data.transactionId) {
    lines.push(centerReceiptText(`Txn ${data.transactionId}`));
  }

  lines.push(centerReceiptText(formatReceiptSummaryLine(lineCount, quantityTotal)));
  lines.push(receiptStrongRule());

  for (const item of data.items) {
    lines.push(truncateReceiptText(item.name, RECEIPT_WIDTH));
    lines.push(
      padReceiptLine(
        `  ${item.quantity} x ${formatReceiptAmount(item.unitPrice)}`,
        formatReceiptAmount(item.lineTotal)
      )
    );
  }

  lines.push(receiptRule());
  lines.push(padReceiptLine("Payment", sanitizeReceiptText(formatPaymentMethod(data.paymentMethod))));
  lines.push(padReceiptLine("Amount paid", formatReceiptAmount(data.amountPaid)));
  lines.push(padReceiptLine("TOTAL", formatReceiptAmount(data.total)));

  if (data.change > 0) {
    lines.push(padReceiptLine("Change", formatReceiptAmount(data.change)));
  }

  lines.push(receiptStrongRule());
  lines.push(centerReceiptText(RECEIPT_ACKNOWLEDGE_LABEL));
  lines.push(centerReceiptText("Thank you!"));
  lines.push("");
  lines.push(centerReceiptText(RECEIPT_DEVELOPER_LABEL));
  lines.push(centerReceiptText(sanitizeReceiptText(RECEIPT_DEVELOPER_URL)));
  lines.push(...Array.from({ length: RECEIPT_BOTTOM_FEED_LINES }, () => ""));

  return lines.join("\n");
}

function centerReceiptText(text: string, width: number = RECEIPT_WIDTH): string {
  const sanitized = sanitizeReceiptText(text);
  if (sanitized.length >= width) return sanitized.slice(0, width);
  const padding = Math.floor((width - sanitized.length) / 2);
  return " ".repeat(padding) + sanitized;
}

export { centerReceiptText };
