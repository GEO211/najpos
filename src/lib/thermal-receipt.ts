"use client";

import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import type { ReceiptData } from "@/lib/print-receipt";
import {
  RECEIPT_WIDTH,
  buildReceiptPlainText,
  formatReceiptAmount,
  formatReceiptDate,
  formatReceiptSummaryLine,
  getReceiptSummary,
  padReceiptLine,
  RECEIPT_ACKNOWLEDGE_LABEL,
  RECEIPT_DEVELOPER_LABEL,
  RECEIPT_DEVELOPER_URL,
  RECEIPT_BOTTOM_FEED_LINES,
  RECEIPT_TOP_FEED_LINES,
  receiptRule,
  receiptStrongRule,
  sanitizeReceiptText,
  truncateReceiptText,
} from "@/lib/receipt-format";
import { formatPaymentMethod } from "@/lib/utils";

export const THERMAL_COLUMNS = RECEIPT_WIDTH;
const RAWBT_PACKAGE = "ru.a402d.rawbtprinter";
export const PRINTER_TYPE_STORAGE_KEY = "HALIYA POS-printer-type";

export type PrinterType = "thermal" | "browser";
export type ThermalPrintBackend = "rawbt" | "bluetooth";

export { buildReceiptPlainText };

export function isAndroidDevice(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isIosDevice(): boolean {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function getThermalPrintBackend(): ThermalPrintBackend {
  return isAndroidDevice() ? "rawbt" : "bluetooth";
}

export function getPrinterType(): PrinterType {
  if (typeof window === "undefined") return "browser";

  const stored = localStorage.getItem(PRINTER_TYPE_STORAGE_KEY);
  if (stored === "thermal" || stored === "browser") return stored;

  return "thermal";
}

export function setPrinterType(type: PrinterType): void {
  localStorage.setItem(PRINTER_TYPE_STORAGE_KEY, type);
}

function printDivider(
  encoder: ReceiptPrinterEncoder,
  strong = false
): ReceiptPrinterEncoder {
  encoder.align("left");
  encoder.line(strong ? receiptStrongRule() : receiptRule());
  return encoder;
}

export function buildThermalReceiptBytes(data: ReceiptData): Uint8Array {
  const { lineCount, quantityTotal } = getReceiptSummary(data);

  const encoder = new ReceiptPrinterEncoder({
    language: "esc-pos",
    columns: THERMAL_COLUMNS,
    feedBeforeCut: RECEIPT_BOTTOM_FEED_LINES,
    codepageMapping: "epson",
  });

  encoder.initialize();
  encoder.codepage("cp437");
  encoder.newline(RECEIPT_TOP_FEED_LINES);

  printDivider(encoder, true);
  encoder.align("center");
  encoder.bold(true);
  encoder.line("HALIYA POS");
  encoder.bold(false);
  encoder.line(sanitizeReceiptText(formatReceiptDate(data.date)));

  if (data.beeperNumber != null) {
    encoder.newline();
    encoder.bold(true);
    encoder.line(`BEEPER #${data.beeperNumber}`);
    encoder.bold(false);
  }

  if (data.transactionId) {
    encoder.line(sanitizeReceiptText(`Txn ${data.transactionId}`));
  }

  encoder.line(formatReceiptSummaryLine(lineCount, quantityTotal));
  printDivider(encoder, true);

  encoder.align("left");
  for (const item of data.items) {
    encoder.line(truncateReceiptText(item.name, THERMAL_COLUMNS));
    encoder.line(
      padReceiptLine(
        `  ${item.quantity} x ${formatReceiptAmount(item.unitPrice)}`,
        formatReceiptAmount(item.lineTotal)
      )
    );
  }

  encoder.newline();
  printDivider(encoder, false);
  encoder.line(
    padReceiptLine("Payment", sanitizeReceiptText(formatPaymentMethod(data.paymentMethod)))
  );
  encoder.line(padReceiptLine("Amount paid", formatReceiptAmount(data.amountPaid)));
  encoder.newline();
  encoder.bold(true);
  encoder.line(padReceiptLine("TOTAL", formatReceiptAmount(data.total)));
  encoder.bold(false);

  if (data.change > 0) {
    encoder.line(padReceiptLine("Change", formatReceiptAmount(data.change)));
  }

  encoder.newline();
  printDivider(encoder, true);
  encoder.align("center");
  encoder.bold(true);
  encoder.line(RECEIPT_ACKNOWLEDGE_LABEL);
  encoder.bold(false);
  encoder.newline();
  encoder.line("Thank you!");
  encoder.newline();
  encoder.line(RECEIPT_DEVELOPER_LABEL);
  encoder.line(sanitizeReceiptText(RECEIPT_DEVELOPER_URL));
  encoder.cut();

  return encoder.encode();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function printThermalReceiptRawBt(data: ReceiptData): boolean {
  try {
    const bytes = buildThermalReceiptBytes(data);
    const base64 = bytesToBase64(bytes);
    window.location.href = `intent:base64,${base64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`;
    return true;
  } catch {
    return false;
  }
}

export function previewThermalReceiptText(data: ReceiptData): string {
  return buildReceiptPlainText(data);
}
