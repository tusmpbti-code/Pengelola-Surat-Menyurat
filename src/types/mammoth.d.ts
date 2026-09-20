declare module 'mammoth' {
  export interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
    includeDefaultStyleMap?: boolean;
    styleMap?: string | string[];
  }

  export interface Result {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export function convertToHtml(input: ConvertOptions): Promise<Result>;
  export function extractRawText(input: ConvertOptions): Promise<Result>;
}
