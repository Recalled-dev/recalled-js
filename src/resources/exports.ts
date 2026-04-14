import type { HttpClient } from "../http.js";
import type { ExportParams } from "../types.js";

export class ExportsResource {
  constructor(private readonly http: HttpClient) {}

  async fetch(params: ExportParams = {}): Promise<string> {
    return this.http.request<string>("/exports", {
      method: "GET",
      query: {
        format: params.format ?? "csv",
        organization: params.organization,
        actor_id: params.actorId,
        date_from:
          params.dateFrom instanceof Date
            ? params.dateFrom.toISOString()
            : params.dateFrom,
        date_to:
          params.dateTo instanceof Date
            ? params.dateTo.toISOString()
            : params.dateTo,
      },
    });
  }
}
