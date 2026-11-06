/**
 * HTTP Client with retries, timeout, and exponential backoff
 */

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

export async function bzFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 8000, retries = 2, backoffMs = 500, ...fetchOptions } = options;

  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        return response;
      }

      // If server error, retry
      if (response.status >= 500 && attempt < retries) {
        attempt++;
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retries) {
        attempt++;
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt - 1)));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}
