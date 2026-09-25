declare module "@point-of-sale/receipt-printer-encoder" {
  interface ReceiptPrinterEncoderOptions {
    columns?: number;
    width?: number;
    language?: "esc-pos" | "star-prnt" | "star-line";
    feedBeforeCut?: number;
    imageMode?: string;
    newline?: string;
    codepageMapping?: string | Record<string, number>;
    codepageCandidates?: string[] | null;
    errors?: "relaxed" | "strict";
    debug?: boolean;
    embedded?: boolean;
    printerModel?: string;
  }

  interface RuleOptions {
    style?: "single" | "double";
    width?: number;
  }

  interface TableColumn {
    width: number;
    align?: "left" | "center" | "right";
    marginRight?: number;
  }

  export default class ReceiptPrinterEncoder {
    constructor(options?: ReceiptPrinterEncoderOptions);
    codepage(codepage: string): this;
    initialize(): this;
    align(value: "left" | "center" | "right"): this;
    bold(value?: boolean): this;
    size(width: number, height?: number): this;
    line(value: string): this;
    text(value: string): this;
    newline(count?: number): this;
    rule(options?: RuleOptions): this;
    table(columns: TableColumn[], rows: Array<Array<string | unknown>>): this;
    cut(mode?: "partial" | "full"): this;
    encode(format?: "commands" | "lines" | "array"): Uint8Array;
  }
}
