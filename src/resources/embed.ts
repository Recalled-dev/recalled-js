// Embed tokens — short-lived, browser-safe credentials that feed the
// `<RecalledFeed />` React component.
//
// The component is an **internal admin widget**: you drop it inside the
// admin console / support tool / back-office your own team uses to operate
// your product, so your support, ops and compliance people can browse the
// audit trail without leaving their workflow. It is NOT a customer-facing
// component — the end users of your SaaS never see Recalled.
//
// Mint the token on YOUR server (where the API key lives) and pass only
// the token to the browser. By default the token grants read access to the
// WHOLE project (every event across every tenant), which is what you want
// for an admin view. Passing `organization` narrows it to a single tenant
// if you need a per-customer drill-down inside the same widget.

import type { HttpClient } from "../http.js";
import type { CreateEmbedTokenParams, CreateEmbedTokenResult } from "../types.js";

export class EmbedResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Mint a short-lived embed token for the admin feed widget.
   *
   * @param params.organization - Optional. If set, the token + widget only
   *   see events tagged with this tenant id. Leave undefined for an
   *   admin-wide view of every event in the project.
   * @param params.ttlSeconds - Token lifetime in seconds. Defaults server-side.
   * @param params.scopes - Reserved for forward compatibility.
   */
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
