export {};

declare global {
  interface Window {
    api: {
      request: (payload: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
      }) => Promise<{
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
        duration: number;
        size: number;
      }>;
    };
  }
}
