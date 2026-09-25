"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { printReceipt, type ReceiptData } from "@/lib/print-receipt";
import {
  BluetoothConnectError,
  connectBluetoothPrinter,
  getBluetoothConnectErrorMessage,
  getConnectedBluetoothPrinter,
  getSavedBluetoothPrinter,
  printViaBluetooth,
  reconnectBluetoothPrinter,
  supportsBluetoothPrinting,
} from "@/lib/bluetooth-printer";
import {
  formatReceiptAmount,
  formatReceiptDate,
  formatReceiptSummaryLine,
  getReceiptSummary,
  RECEIPT_ACKNOWLEDGE_LABEL,
  padReceiptLine,
  RECEIPT_DEVELOPER_LABEL,
  RECEIPT_DEVELOPER_URL,
  sanitizeReceiptText,
} from "@/lib/receipt-format";
import {
  buildReceiptPlainText,
  buildThermalReceiptBytes,
  getThermalPrintBackend,
  isIosDevice,
  printThermalReceiptRawBt,
  setPrinterType,
  type PrinterType,
} from "@/lib/thermal-receipt";
import { formatPaymentMethod } from "@/lib/utils";
import { Bluetooth, Copy, Printer, Share2, X } from "lucide-react";

interface ReceiptPrintDialogProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

const BLUEFY_APP_STORE_URL = "https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055";

export function ReceiptPrintDialog({ receipt, onClose }: ReceiptPrintDialogProps) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printerType, setPrinterTypeState] = useState<PrinterType>("thermal");
  const [bluetoothReady, setBluetoothReady] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const thermalBackend = getThermalPrintBackend();
  const bluetoothSupported = supportsBluetoothPrinting();
  const onIphone = isIosDevice();

  useEffect(() => {
    setPrinterTypeState("thermal");
    setPrintError(null);
    setCopied(false);

    const saved = getSavedBluetoothPrinter();
    setPrinterName(saved?.name ?? null);

    if (thermalBackend !== "bluetooth") {
      setBluetoothReady(false);
      return;
    }

    let cancelled = false;

    async function prepareBluetooth() {
      if (!bluetoothSupported) {
        if (!cancelled) setBluetoothReady(false);
        return;
      }

      const connected = getConnectedBluetoothPrinter();
      if (connected) {
        if (!cancelled) {
          setPrinterName(connected.name);
          setBluetoothReady(true);
        }
        return;
      }

      const reconnected = await reconnectBluetoothPrinter();
      if (!cancelled) {
        const device = getConnectedBluetoothPrinter();
        setPrinterName(device?.name ?? saved?.name ?? null);
        setBluetoothReady(reconnected);
      }
    }

    void prepareBluetooth();

    return () => {
      cancelled = true;
    };
  }, [receipt, thermalBackend, bluetoothSupported]);

  if (!receipt) return null;

  const { lineCount, quantityTotal } = getReceiptSummary(receipt);

  function handlePrinterTypeChange(type: PrinterType) {
    setPrinterType(type);
    setPrinterTypeState(type);
    setPrintError(null);
  }

  async function handleConnectPrinter() {
    setPrinting(true);
    setPrintError(null);

    try {
      const device = await connectBluetoothPrinter();
      setPrinterName(device.name);
      setBluetoothReady(true);
    } catch (error) {
      setPrintError(getBluetoothConnectErrorMessage(error));
      setBluetoothReady(false);
    } finally {
      setPrinting(false);
    }
  }

  async function handlePrint() {
    if (!receipt) return;

    setPrinting(true);
    setPrintError(null);

    try {
      if (printerType === "browser") {
        const printed = printReceipt(receipt);
        if (!printed) {
          setPrintError("Could not open the print dialog.");
          return;
        }
        onClose();
        return;
      }

      if (thermalBackend === "rawbt") {
        const printed = printThermalReceiptRawBt(receipt);
        if (!printed) {
          setPrintError("Could not send to RawBT.");
          return;
        }
        onClose();
        return;
      }

      if (!bluetoothSupported) {
        setPrintError("Safari cannot reach Bluetooth printers. Open this POS in Bluefy, then connect your PT-210.");
        return;
      }

      if (!bluetoothReady) {
        await handleConnectPrinter();
        if (!getConnectedBluetoothPrinter()) return;
      }

      await printViaBluetooth(buildThermalReceiptBytes(receipt));
      onClose();
    } catch (error) {
      setPrintError(getBluetoothConnectErrorMessage(error));
      setBluetoothReady(false);
    } finally {
      setPrinting(false);
    }
  }

  async function handleShareReceipt() {
    if (!receipt) return;

    const text = buildReceiptPlainText(receipt);

    if (navigator.share) {
      try {
        await navigator.share({ title: "Receipt", text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await handleCopyReceipt(text);
  }

  async function handleCopyReceipt(text?: string) {
    if (!receipt) return;

    const receiptText = text ?? buildReceiptPlainText(receipt);
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setPrintError("Could not copy the receipt.");
    }
  }

  const showIosSafariHint = onIphone && printerType === "thermal" && !bluetoothSupported;
  const showAndroidRawBtHint = thermalBackend === "rawbt" && printerType === "thermal";
  const showBluetoothHint = thermalBackend === "bluetooth" && printerType === "thermal" && bluetoothSupported;

  return (
    <div className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-sm:animate-slide-up-in sm:animate-scale-in flex max-h-[90dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-lg sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Receipt</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Printer
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePrinterTypeChange("thermal")}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                printerType === "thermal"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} />
                PT-210
              </span>
              <span
                className={`mt-0.5 block ${printerType === "thermal" ? "text-neutral-300" : "text-neutral-500"}`}
              >
                58mm thermal
              </span>
            </button>
            <button
              type="button"
              onClick={() => handlePrinterTypeChange("browser")}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                printerType === "browser"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
                Browser
              </span>
              <span
                className={`mt-0.5 block ${printerType === "browser" ? "text-neutral-300" : "text-neutral-500"}`}
              >
                System print
              </span>
            </button>
          </div>

          {showIosSafariHint && (
            <div className="mt-2 space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
              <p>
                iPhone Safari cannot print directly to the PT-210. Install{" "}
                <a
                  href={BLUEFY_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                >
                  Bluefy
                </a>
                , open this POS there, pair the PT-210 once, then tap Print.
              </p>
              <p className="text-amber-800">
                Or use Share / Copy below and paste into the CaysnPrinter app.
              </p>
            </div>
          )}

          {showBluetoothHint && (
            <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] leading-relaxed text-neutral-600">
              {bluetoothReady && printerName ? (
                <p>
                  Connected to <strong className="text-neutral-900">{printerName}</strong>
                </p>
              ) : (
                <p>Turn on the PT-210, then tap Connect before your first print.</p>
              )}
            </div>
          )}

          {showAndroidRawBtHint && (
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              Pair the PT-210 in Android Bluetooth settings, install{" "}
              <strong className="font-medium text-neutral-700">RawBT</strong>, connect the
              printer there once, then tap Print.
            </p>
          )}
        </div>

        <div className="overflow-auto px-4 py-4">
          <div className="mx-auto max-w-[16rem] py-6 font-mono text-[11px] leading-relaxed text-neutral-900">
            <div className="border-y-2 border-neutral-900 py-3 text-center">
              <p className="text-sm font-bold tracking-[0.2em]">HALIYA COFFEE SHOP</p>
              <p className="mt-2 text-[10px] text-neutral-500">
                {formatReceiptDate(receipt.date)}
              </p>
              {receipt.beeperNumber != null && (
                <p className="mt-2 text-base font-bold tracking-wide text-neutral-900">
                  BEEPER #{receipt.beeperNumber}
                </p>
              )}
              {receipt.transactionId && (
                <p className="mt-1 text-[10px] text-neutral-500">
                  Txn {receipt.transactionId}
                </p>
              )}
              <p className="mt-2 text-[10px] text-neutral-500">
                {formatReceiptSummaryLine(lineCount, quantityTotal)}
              </p>
            </div>

            <div className="py-3">
              {receipt.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="mb-2 last:mb-0">
                  <p className="font-bold">{item.name}</p>
                  <p className="whitespace-pre text-neutral-600">
                    {padReceiptLine(
                      `  ${item.quantity} x ${formatReceiptAmount(item.unitPrice)}`,
                      formatReceiptAmount(item.lineTotal)
                    )}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-neutral-400 pt-3">
              <p className="whitespace-pre text-neutral-600">
                {padReceiptLine(
                  "Payment",
                  sanitizeReceiptText(formatPaymentMethod(receipt.paymentMethod))
                )}
              </p>
              <p className="whitespace-pre text-neutral-600">
                {padReceiptLine("Amount paid", formatReceiptAmount(receipt.amountPaid))}
              </p>
              <p className="mt-1 whitespace-pre text-sm font-bold">
                {padReceiptLine("TOTAL", formatReceiptAmount(receipt.total))}
              </p>
              {receipt.change > 0 && (
                <p className="whitespace-pre text-neutral-600">
                  {padReceiptLine("Change", formatReceiptAmount(receipt.change))}
                </p>
              )}
            </div>

            <div className="mt-3 border-y-2 border-neutral-900 py-3 text-center">
              <p className="text-[11px] font-bold tracking-wide text-neutral-900">
                {RECEIPT_ACKNOWLEDGE_LABEL}
              </p>
              <p className="mt-2 text-neutral-500">Thank you!</p>
            </div>

            <div className="pt-3 pb-6 text-center text-[9px] leading-relaxed text-neutral-400">
              <p>{RECEIPT_DEVELOPER_LABEL}</p>
              <a
                href={RECEIPT_DEVELOPER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-neutral-500 underline"
              >
                {RECEIPT_DEVELOPER_URL}
              </a>
            </div>
          </div>
        </div>

        {printError && (
          <p className="px-4 pb-2 text-center text-xs text-red-600">{printError}</p>
        )}

        <div className="space-y-2 border-t border-neutral-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {showIosSafariHint && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => void handleShareReceipt()}>
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                Share
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => void handleCopyReceipt()}>
                <Copy className="h-4 w-4" strokeWidth={1.5} />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Close
            </Button>

            {printerType === "thermal" &&
              thermalBackend === "bluetooth" &&
              bluetoothSupported &&
              !bluetoothReady && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void handleConnectPrinter()}
                  disabled={printing}
                >
                  <Bluetooth className="h-4 w-4" strokeWidth={1.5} />
                  Connect
                </Button>
              )}

            {(printerType === "browser" ||
              (printerType === "thermal" && thermalBackend === "rawbt") ||
              (printerType === "thermal" &&
                thermalBackend === "bluetooth" &&
                bluetoothSupported)) && (
              <Button className="flex-1" onClick={() => void handlePrint()} disabled={printing}>
                <Printer className="h-4 w-4" strokeWidth={1.5} />
                {printing
                  ? "Printing..."
                  : printerType === "thermal"
                    ? "Print PT-210"
                    : "Print"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
