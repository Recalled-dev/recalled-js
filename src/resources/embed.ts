import type { HttpClient } from "../http.js";
import type { CreateEmbedTokenParams, CreateEmbedTokenResult } from "../types.js";

export class EmbedResource {
  constructor(private readonly http: HttpClient) {}

  async createToken(
    params: CreateEmbedTokenParams = {},
  ): Promise<CreateEmbedTokenResult> {
    const raw = await this.http.request<{
      token: string;
      expiresAt: string;
      scopes: string[];
    }>("/embed/token", {
      method: "POST",
      body: {
        organization: params.organization,
        ttl_seconds: params.ttlSeconds,
        scopes: params.scopes,
      },
    });
    return {
      token: raw.token,
      expiresAt: raw.expiresAt,
      scopes: raw.scopes,
    };
  }
}
