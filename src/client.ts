import { HttpClient } from "./http.js";
import { EventsResource } from "./resources/events.js";
import { ExportsResource } from "./resources/exports.js";
import { ActorsResource } from "./resources/actors.js";
import { EmbedResource } from "./resources/embed.js";

const DEFAULT_BASE_URL = "https://api.recalled.dev/v1";
const DEFAULT_TIMEOUT = 10_000;
const SDK_VERSION = "0.1.0";

export type RecalledOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export class Recalled {
  readonly events: EventsResource;
  readonly exports: ExportsResource;
  readonly actors: ActorsResource;
  readonly embed: EmbedResource;

  constructor(options: RecalledOptions) {
    if (!options.apiKey || typeof options.apiKey !== "string") {
      throw new Error("Recalled: apiKey is required");
    }

    const http = new HttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT,
      fetchImpl: options.fetch,
      userAgent: `recalled-js/${SDK_VERSION}`,
    });

    this.events = new EventsResource(http);
    this.exports = new ExportsResource(http);
    this.actors = new ActorsResource(http);
    this.embed = new EmbedResource(http);
  }
}
