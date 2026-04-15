import type { HttpClient } from "../http.js";
import { EventQueue, type ResilienceOptions } from "../queue.js";
import type {
  CreateEventInput,
  Event,
  ListEventsParams,
  ListResult,
  SearchEventsParams,
} from "../types.js";

export class EventsResource {
  private readonly queue: EventQueue | null;

  constructor(
    private readonly http: HttpClient,
    resilience: ResilienceOptions | false = {},
  ) {
    this.queue =
      resilience === false
        ? null
        : new EventQueue((input) => this.sendDirect(input), resilience);
  }

  /**
   * Send an event and wait for the server confirmation. Throws on any
   * error, including transient ones. Use this when the caller wants a
   * strict, synchronous delivery guarantee — e.g. inside a request path
   * where you want to 500 if the audit log cannot be written.
   */
  async create(input: CreateEventInput): Promise<Event> {
    return this.sendDirect(input);
  }

  /**
   * Queue an event for delivery and return immediately. If the API is
   * unreachable, the event is held in an in-memory buffer and retried
   * automatically with exponential backoff for up to 24 hours (or
   * whatever `resilience.maxAgeMs` is set to).
   *
   * This method never throws. Delivery outcomes are observed through
   * the `onDelivered` / `onError` / `onDrop` callbacks passed to the
   * `Recalled` constructor.
   *
   * Use this when you do not want audit logging to break your request
   * path on a transient outage — which is almost always what you want.
   */
  emit(input: CreateEventInput): void {
    if (!this.queue) {
      // Resilience disabled: fire-and-forget without buffering.
      this.sendDirect(input).catch(() => {
        // Intentionally swallowed — caller opted out of resilience.
      });
      return;
    }
    this.queue.enqueue(input);
  }

  /**
   * Wait for every currently-queued event to be delivered (or dropped
   * after exhausting retries). Resolves early if the timeout elapses
   * before the queue drains. Safe to call repeatedly.
   *
   * Call this before exiting a short-lived process (CLI, Lambda, cron
   * job) to avoid losing buffered events on shutdown.
   */
  async flush(timeoutMs?: number): Promise<void> {
    if (!this.queue) return;
    return this.queue.flush(timeoutMs);
  }

  /** Current number of events waiting to be delivered. */
  queueSize(): number {
    return this.queue?.size() ?? 0;
  }

  private async sendDirect(input: CreateEventInput): Promise<Event> {
    return this.http.request<Event>("/events", {
      method: "POST",
      body: {
        action: input.action,
        organization: input.organization,
        actor: input.actor,
        targets: input.targets,
        metadata: input.metadata,
        occurred_at:
          input.occurredAt instanceof Date
            ? input.occurredAt.toISOString()
            : input.occurredAt,
      },
    });
  }

  async list(params: ListEventsParams = {}): Promise<ListResult<Event>> {
    return this.http.request<ListResult<Event>>("/events", {
      method: "GET",
      query: {
        limit: params.limit,
        cursor: params.cursor,
        organization: params.organization,
        actor_id: params.actorId,
        action: params.action,
        date_from: toIso(params.dateFrom),
        date_to: toIso(params.dateTo),
      },
    });
  }

  async search(params: SearchEventsParams): Promise<ListResult<Event>> {
    return this.http.request<ListResult<Event>>("/events/search", {
      method: "GET",
      query: {
        q: params.q,
        limit: params.limit,
        cursor: params.cursor,
      },
    });
  }

  async retrieve(id: string): Promise<Event> {
    return this.http.request<Event>(`/events/${encodeURIComponent(id)}`);
  }
}

function toIso(value: string | Date | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}
