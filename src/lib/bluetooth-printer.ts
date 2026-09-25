"use client";

const STORAGE_KEY = "HALIYA POS-bluetooth-printer";

const THERMAL_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

const PRINT_PROFILES = [
  {
    service: "000018f0-0000-1000-8000-00805f9b34fb",
    characteristic: "00002af1-0000-1000-8000-00805f9b34fb",
  },
  {
    service: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    characteristic: "49535343-8841-43f4-a8d4-ecbe34729bb3",
  },
  {
    service: "0000ae30-0000-1000-8000-00805f9b34fb",
    characteristic: "0000ae01-0000-1000-8000-00805f9b34fb",
  },
  {
    service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
    characteristic: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  },
  {
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    characteristic: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  },
];

export type BluetoothConnectErrorCode =
  | "NO_BLUETOOTH"
  | "CANCELLED"
  | "REQUEST_FAILED"
  | "GATT_FAILED"
  | "UNSUPPORTED_PRINTER"
  | "NOT_CONNECTED";

export class BluetoothConnectError extends Error {
  code: BluetoothConnectErrorCode;

  constructor(code: BluetoothConnectErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BluetoothConnectError";
  }
}

export interface SavedBluetoothPrinter {
  type: "bluetooth";
  id: string;
  name: string;
}

interface ActivePrintChannel {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
  chunkSize: number;
  writeWithResponse: boolean;
}

export interface BluetoothNavigator extends Navigator {
  bluetooth?: Bluetooth;
}

let activeChannel: ActivePrintChannel | null = null;
let connectedDevice: SavedBluetoothPrinter | null = null;

function getBluetooth(): Bluetooth {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth;
  if (!bluetooth) {
    throw new BluetoothConnectError(
      "NO_BLUETOOTH",
      "This browser cannot access Bluetooth printers."
    );
  }
  return bluetooth;
}

function saveConnectedDevice(device: BluetoothDevice): SavedBluetoothPrinter {
  connectedDevice = {
    type: "bluetooth",
    id: device.id,
    name: device.name || "PT-210",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connectedDevice));
  return connectedDevice;
}

function clearConnectedDevice() {
  activeChannel = null;
  connectedDevice = null;
}

async function requestPrinterDevice(): Promise<BluetoothDevice> {
  const bluetooth = getBluetooth();

  try {
    return await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: THERMAL_SERVICES,
    });
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotFoundError") {
        throw new BluetoothConnectError(
          "CANCELLED",
          "Printer selection was cancelled."
        );
      }

      if (error.name === "SecurityError") {
        throw new BluetoothConnectError(
          "REQUEST_FAILED",
          "Bluetooth permission was blocked. Allow Bluetooth for this browser."
        );
      }
    }

    throw new BluetoothConnectError(
      "REQUEST_FAILED",
      "Could not open the Bluetooth device list."
    );
  }
}

async function resolvePrintChannel(
  device: BluetoothDevice
): Promise<ActivePrintChannel> {
  if (!device.gatt) {
    throw new BluetoothConnectError(
      "GATT_FAILED",
      "This device does not support Bluetooth printing."
    );
  }

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  const serviceIds = new Set(services.map((service) => service.uuid.toLowerCase()));

  for (const profile of PRINT_PROFILES) {
    if (!serviceIds.has(profile.service)) continue;

    try {
      const service = await server.getPrimaryService(profile.service);
      const characteristic = await service.getCharacteristic(profile.characteristic);
      const writeWithResponse = characteristic.properties.write;

      return {
        device,
        characteristic,
        chunkSize: 100,
        writeWithResponse,
      };
    } catch {
      // try next known profile
    }
  }

  for (const service of services) {
    const characteristics = await service.getCharacteristics();

    for (const characteristic of characteristics) {
      if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
        continue;
      }

      return {
        device,
        characteristic,
        chunkSize: 100,
        writeWithResponse: characteristic.properties.write,
      };
    }
  }

  try {
    await server.disconnect();
  } catch {
    // ignore disconnect errors
  }

  throw new BluetoothConnectError(
    "UNSUPPORTED_PRINTER",
    "Connected, but this printer does not expose a supported print channel."
  );
}

function attachDisconnectHandler(device: BluetoothDevice) {
  device.addEventListener("gattserverdisconnected", () => {
    if (activeChannel?.device === device) {
      clearConnectedDevice();
    }
  });
}

async function openChannel(device: BluetoothDevice): Promise<SavedBluetoothPrinter> {
  activeChannel = await resolvePrintChannel(device);
  attachDisconnectHandler(device);
  return saveConnectedDevice(device);
}

export function supportsBluetoothPrinting(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function getSavedBluetoothPrinter(): SavedBluetoothPrinter | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedBluetoothPrinter;
    if (parsed?.id && parsed?.name) return parsed;
  } catch {
    // ignore invalid storage
  }

  return null;
}

export function getConnectedBluetoothPrinter(): SavedBluetoothPrinter | null {
  if (activeChannel && connectedDevice) return connectedDevice;
  return connectedDevice ?? getSavedBluetoothPrinter();
}

export function getBluetoothConnectErrorMessage(error: unknown): string {
  if (error instanceof BluetoothConnectError) {
    switch (error.code) {
      case "NO_BLUETOOTH":
        return "Safari cannot reach Bluetooth printers. Open this POS in Bluefy, then connect your PT-210.";
      case "CANCELLED":
        return "No printer selected. Tap Connect and choose your PT-210 from the list.";
      case "REQUEST_FAILED":
        return error.message;
      case "GATT_FAILED":
        return "Could not connect to the printer. Turn it on and disconnect it from other apps first.";
      case "UNSUPPORTED_PRINTER":
        return "This printer cannot be used from the browser on iPhone. Copy the receipt and print it in CaysnPrinter.";
      case "NOT_CONNECTED":
        return "Printer not connected. Tap Connect first.";
      default:
        return error.message;
    }
  }

  return "Could not connect. Turn on the PT-210, open Bluefy on iPhone, then try again.";
}

export async function connectBluetoothPrinter(): Promise<SavedBluetoothPrinter> {
  const device = await requestPrinterDevice();
  return openChannel(device);
}

export async function reconnectBluetoothPrinter(): Promise<boolean> {
  const saved = getSavedBluetoothPrinter();
  const bluetooth = (navigator as BluetoothNavigator).bluetooth;

  if (!saved || !bluetooth?.getDevices) return false;

  try {
    const devices = await bluetooth.getDevices();
    const device = devices.find((entry) => entry.id === saved.id);
    if (!device) return false;

    await openChannel(device);
    return true;
  } catch {
    clearConnectedDevice();
    return false;
  }
}

export async function printViaBluetooth(data: Uint8Array): Promise<void> {
  if (!activeChannel) {
    const saved = getSavedBluetoothPrinter();
    if (!saved) {
      throw new BluetoothConnectError("NOT_CONNECTED", "Printer not connected.");
    }

    const reconnected = await reconnectBluetoothPrinter();
    if (!reconnected || !activeChannel) {
      throw new BluetoothConnectError("NOT_CONNECTED", "Printer not connected.");
    }
  }

  const channel = activeChannel;
  if (!channel) {
    throw new BluetoothConnectError("NOT_CONNECTED", "Printer not connected.");
  }

  const { characteristic, chunkSize, writeWithResponse } = channel;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);

    if (writeWithResponse) {
      await characteristic.writeValueWithResponse(chunk);
    } else {
      await characteristic.writeValueWithoutResponse(chunk);
    }
  }
}
