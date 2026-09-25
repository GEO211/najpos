declare module "@/lib/vendor/webbluetooth-receipt-printer.esm.js" {
  export interface BluetoothPrinterDevice {
    type: "bluetooth";
    name: string;
    id: string;
    language?: string;
    codepageMapping?: string;
  }

  export default class WebBluetoothReceiptPrinter {
    connect(): Promise<void>;
    reconnect(device: Pick<BluetoothPrinterDevice, "id">): Promise<void>;
    disconnect(): Promise<void>;
    print(data: Uint8Array | Uint8Array[]): Promise<void>;
    addEventListener(
      event: "connected" | "disconnected" | "data",
      callback: (device?: BluetoothPrinterDevice) => void
    ): void;
  }
}

declare module "@point-of-sale/webbluetooth-receipt-printer" {
  export interface BluetoothPrinterDevice {
    type: "bluetooth";
    name: string;
    id: string;
    language?: string;
    codepageMapping?: string;
  }

  export default class WebBluetoothReceiptPrinter {
    connect(): Promise<void>;
    reconnect(device: Pick<BluetoothPrinterDevice, "id">): Promise<void>;
    disconnect(): Promise<void>;
    print(data: Uint8Array | Uint8Array[]): Promise<void>;
    addEventListener(
      event: "connected" | "disconnected" | "data",
      callback: (device?: BluetoothPrinterDevice) => void
    ): void;
  }
}
