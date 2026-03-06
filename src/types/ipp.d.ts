declare module "ipp" {
  interface PrinterOptions {
    version?: string;
    uri?: string;
    charset?: string;
    language?: string;
  }

  interface IppMessage {
    "operation-attributes-tag"?: Record<string, unknown>;
    "job-attributes-tag"?: Record<string, unknown>;
    data?: Buffer;
  }

  interface IppResponse {
    version?: string;
    statusCode?: string;
    id?: number;
    "operation-attributes-tag"?: Record<string, unknown>;
    "job-attributes-tag"?: Record<string, unknown>;
  }

  class Printer {
    constructor(url: string, opts?: PrinterOptions);
    execute(
      operation: string,
      message: IppMessage,
      callback: (err: Error | null, res: IppResponse) => void,
    ): void;
  }

  export = Printer;
}
