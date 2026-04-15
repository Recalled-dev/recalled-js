import { RecalledError } from "./errors.js";
import type { RecalledErrorCode } from "./types.js";

export type HttpOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type HttpClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

const DEFAULT_RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string | undefined;

  constructor(options: HttpClientOptions) {
    this.baseUrl = stripTrailingSlash(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent;
  }

  async request<T>(path: string, options: HttpOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers ?? {}),
    };

    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    if (this.userAgent) headers["User-Agent"] = this.userAgent;

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: options.method ?? "GET",
          headers,
          body,
          signal: options.signal ?? controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (isAbort(err)) {
          throw new RecalledError("Request timed out", {
            code: "TIMEOUT",
            status: 0,
            cause: err,
          });
        }
        if (shouldRetry(undefined, attempt)) {
          await backoff(attempt);
          continue;
        }
        throw new RecalledError("Network error", {
          code: "NETWORK_ERROR",
          status: 0,
          cause: err,
        });
      }
      clearTimeout(timer);

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        const json = (await res.json().catch(() => null)) as {
          data?: unknown;
          nextCursor?: string | null;
        } | null;
        if (json && "data" in json) {
          // Distinguish list responses (wrap as { data, nextCursor }) from
          // single-object responses (unwrap to `data` directly). A response
          // is a list when `data` is an array OR the envelope carries a
          // `nextCursor` field — list endpoints always set it, even on the
          // last page where it is `null`.
          if (Array.isArray(json.data) || "nextCursor" in json) {
            return { data: json.data, nextCursor: json.nextCursor ?? null } as T;
          }
          return json.data as T;
        }
        return (json ?? undefined) as T;
      }

      if (shouldRetry(res.status, attempt)) {
        await backoff(attempt);
        continue;
      }

      throw await toError(res);
    }
  }

  private buildUrl(path: string, query?: HttpOptions["query"]) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(this.baseUrl + normalized);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === "") continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

function stripTrailingSlash(s: string) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function isAbort(err: unknown) {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.message.includes("aborted"))
  );
}

function shouldRetry(status: number | undefined, attempt: number): boolean {
  if (attempt > MAX_RETRIES) return false;
  if (status === undefined) return true;
  return DEFAULT_RETRY_STATUSES.has(status);
}

function backoff(attempt: number): Promise<void> {
  const ms = Math.min(1000 * 2 ** (attempt - 1), 4000) + Math.floor(Math.random() * 100);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function toError(res: Response): Promise<RecalledError> {
  const requestId = res.headers.get("x-request-id") ?? undefined;
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {}
  const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  const code = (err?.code as RecalledErrorCode | undefined) ?? statusToCode(res.status);
  return new RecalledError(err?.message ?? `HTTP ${res.status}`, {
    code,
    status: res.status,
    details: err?.details,
    requestId,
  });
}

function statusToCode(status: number): RecalledErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL_ERROR";
  return "UNKNOWN_ERROR";
}
