export type AreaRequests = {
  isSent(merchantId: string, area: string): boolean;
  submit(options: {
    merchantId: string; area: string; address?: string;
    getHeaders: () => Promise<Record<string, string> | null>;
    fetcher?: typeof fetch; requestId?: () => string;
  }): Promise<void>;
};
export function createAreaRequests(): AreaRequests;
