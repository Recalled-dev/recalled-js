import type { HttpClient } from "../http.js";
import type {
  CreateEventInput,
  Event,
  ListEventsParams,
  ListResult,
  SearchEventsParams,
} from "../types.js";

export class EventsResource {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateEventInput): Promise<Event> {
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
