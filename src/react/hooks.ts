import { useCallback, useEffect, useRef, useState } from "react";
import type { Event } from "../types.js";

const DEFAULT_BASE_URL = "https://api.recalled.dev/v1";

export type UseEventsOptions = {
  embedToken: string;
  baseUrl?: string;
  pageSize?: number;
  search?: string;
  refreshIntervalMs?: number;
  onError?: (error: Error) => void;
  onLoad?: (events: Event[]) => void;
};

export type UseEventsResult = {
  events: Event[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
};

export function useEmbedEvents(options: UseEventsOptions): UseEventsResult {
  const {
    embedToken,
    baseUrl = DEFAULT_BASE_URL,
    pageSize = 20,
    search,
    refreshIntervalMs = 0,
    onError,
    onLoad,
  } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const reloadTick = useRef(0);

  const fetchPage = useCallback(
    async (append: boolean, currentCursor: string | null) => {
      if (!embedToken) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${stripSlash(baseUrl)}/embed/events`);
        url.searchParams.set("token", embedToken);
        url.searchParams.set("limit", String(pageSize));
        if (currentCursor) url.searchParams.set("cursor", currentCursor);
        if (search) url.searchParams.set("q", search);

        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          data: Event[];
          nextCursor: string | null;
        };
        setEvents((prev) => (append ? [...prev, ...json.data] : json.data));
        setCursor(json.nextCursor);
        setHasMore(Boolean(json.nextCursor));
        onLoad?.(json.data);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [embedToken, baseUrl, pageSize, search],
  );

  useEffect(() => {
    fetchPage(false, null);
  }, [fetchPage, reloadTick.current]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs <= 0) return;
    const id = setInterval(() => {
      fetchPage(false, null);
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [fetchPage, refreshIntervalMs]);

  const loadMore = useCallback(() => {
    if (!cursor || loading) return;
    fetchPage(true, cursor);
  }, [cursor, loading, fetchPage]);

  const reload = useCallback(() => {
    reloadTick.current += 1;
    fetchPage(false, null);
  }, [fetchPage]);

  return { events, loading, error, hasMore, loadMore, reload };
}

function stripSlash(s: string) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
