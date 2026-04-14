import type { HttpClient } from "../http.js";
import type { DeleteActorParams, DeleteActorResult } from "../types.js";

export class ActorsResource {
  constructor(private readonly http: HttpClient) {}

  async delete(params: DeleteActorParams): Promise<DeleteActorResult> {
    const raw = await this.http.request<{
      actor_id: string;
      anonymized_events: number;
      erased_at: string;
    }>(`/actors/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
      query: params.organization ? { organization: params.organization } : undefined,
    });
    return {
      actorId: raw.actor_id,
      anonymizedEvents: raw.anonymized_events,
      erasedAt: raw.erased_at,
    };
  }
}
