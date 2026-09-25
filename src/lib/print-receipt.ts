import {
  formatReceiptAmount,
  formatReceiptDate,
  formatReceiptSummaryLine,
  getReceiptSummary,
  RECEIPT_ACKNOWLEDGE_LABEL,
  RECEIPT_BOTTOM_FEED_LINES,
  RECEIPT_DEVELOPER_LABEL,
  RECEIPT_DEVELOPER_URL,
  RECEIPT_TOP_FEED_LINES,
  sanitizeReceiptText,
} from "@/lib/receipt-format";
import { formatPaymentMethod } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptData {
  items: ReceiptItem[];
  paymentMethod: PaymentMethod;
  amountPaid: number;
  total: number;
  change: number;
  date: Date;
  transactionId?: string;
  beeperNumber?: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReceiptHtml(data: ReceiptData): string {
  const { lineCount, quantityTotal } = getReceiptSummary(data);

  const itemRows = data.items
    .map(
      (item) => `
        <tr class="item-row">
          <td colspan="2" class="item-name">${escapeHtml(item.name)}</td>
        </tr>
        <tr class="item-row">
          <td class="item-detail">${item.quantity} x ${escapeHtml(formatReceiptAmount(item.unitPrice))}</td>
          <td class="item-total">${escapeHtml(formatReceiptAmount(item.lineTotal))}</td>
        </tr>`
    )
    .join("");

  const transactionId = data.transactionId
    ? `<div class="meta">Txn ${escapeHtml(data.transactionId)}</div>`
    : "";
  const beeper =
    data.beeperNumber != null
      ? `<div class="beeper">BEEPER #${data.beeperNumber}</div>`
      : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HALIYA POS Receipt</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        line-height: 1.35;
        color: #111;
        width: 58mm;
        max-width: 100%;
        margin: 0 auto;
        padding: ${RECEIPT_TOP_FEED_LINES * 2.5}mm 3mm ${RECEIPT_BOTTOM_FEED_LINES * 2.5}mm;
      }
      .center { text-align: center; }
      .right { text-align: right; white-space: nowrap; }
      .meta { color: #444; font-size: 10px; margin-top: 2px; }
      .summary { color: #444; font-size: 10px; margin-top: 4px; }
      .brand {
        font-size: 16px;
        font-weight: bold;
        letter-spacing: 0.08em;
        line-height: 1.2;
      }
      .beeper {
        margin-top: 8px;
        font-size: 18px;
        font-weight: bold;
        letter-spacing: 0.04em;
      }
      .divider,
      .divider-strong {
        border: 0;
        border-top: 1px dashed #888;
        margin: 8px 0;
      }
      .divider-strong {
        border-top-style: solid;
        border-top-width: 2px;
      }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1px 0; vertical-align: top; }
      .item-row .item-name {
        font-weight: bold;
        padding-top: 6px;
      }
      .item-row .item-detail {
        color: #444;
        padding-left: 8px;
      }
      .item-row .item-total {
        text-align: right;
        color: #444;
        padding-right: 0;
      }
      .totals td {
        padding: 2px 0;
      }
      .totals .label {
        color: #444;
      }
      .total-row td {
        font-weight: bold;
        font-size: 13px;
        padding-top: 6px;
      }
      .footer {
        margin-top: 8px;
        color: #444;
        font-size: 11px;
      }
      .acknowledge {
        margin-top: 10px;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
        letter-spacing: 0.04em;
      }
      .developer {
        margin-top: 10px;
        color: #666;
        font-size: 9px;
        line-height: 1.4;
      }
      .developer a {
        color: #444;
        text-decoration: none;
      }
      @media print {
        body { width: 58mm; }
      }
    </style>
  </head>
  <body>
    <div class="center">
      <div class="brand">HALIYA<br />POS</div>
      <div class="meta">${escapeHtml(formatReceiptDate(data.date))}</div>
      ${beeper}
      ${transactionId}
      <div class="summary">${escapeHtml(formatReceiptSummaryLine(lineCount, quantityTotal))}</div>
    </div>
    <hr class="divider-strong" />
    <table>${itemRows}</table>
    <hr class="divider" />
    <table class="totals">
      <tr>
        <td class="label">Payment</td>
        <td class="right">${escapeHtml(sanitizeReceiptText(formatPaymentMethod(data.paymentMethod)))}</td>
      </tr>
      <tr>
        <td class="label">Amount paid</td>
        <td class="right">${escapeHtml(formatReceiptAmount(data.amountPaid))}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="right">${escapeHtml(formatReceiptAmount(data.total))}</td>
      </tr>
      ${
        data.change > 0
          ? `<tr><td class="label">Change</td><td class="right">${escapeHtml(formatReceiptAmount(data.change))}</td></tr>`
          : ""
      }
    </table>
    <hr class="divider-strong" />
    <div class="acknowledge">${escapeHtml(RECEIPT_ACKNOWLEDGE_LABEL)}</div>
    <div class="center footer">Thank you!</div>
    <div class="center developer">
      ${escapeHtml(RECEIPT_DEVELOPER_LABEL)}<br />
      <a href="${escapeHtml(RECEIPT_DEVELOPER_URL)}">${escapeHtml(RECEIPT_DEVELOPER_URL)}</a>
    </div>
  </body>
</html>`;
}

export function printReceipt(data: ReceiptData): boolean {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Receipt print");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "0",
    height: "0",
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  });

  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = printWindow?.document;

  if (!printWindow || !printDocument) {
    iframe.remove();
    return false;
  }

  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  try {
    printWindow.focus();
    printWindow.print();
    cleanup();
    return true;
  } catch {
    iframe.remove();
    return false;
  }
}
