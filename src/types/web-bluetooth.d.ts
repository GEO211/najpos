interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  addEventListener(
    type: "gattserverdisconnected",
    listener: (this: BluetoothDevice, event: Event) => void
  ): void;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  readonly uuid: string;
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<{
    name?: string;
    namePrefix?: string;
    services?: string[];
  }>;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  getDevices?(): Promise<BluetoothDevice[]>;
  addEventListener(type: "disconnect", listener: (event: Event & { device: BluetoothDevice }) => void): void;
}
