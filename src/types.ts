export type Actor = {
  type?: string;
  id?: string;
  name?: string;
  email?: string;
};

export type EventTarget = {
  type: string;
  id: string;
  name?: string;
};

export type Metadata = Record<string, unknown>;

export type CreateEventInput = {
  action: string;
  organization?: string;
  actor?: Actor;
  targets?: EventTarget[];
  metadata?: Metadata;
  occurredAt?: string | Date;
};

export type Event = {
  id: string;
  projectId: string;
  organization: string | null;
  action: string;
  actor: {
    type: string | null;
    id: string | null;
    name: string | null;
    email: string | null;
  };
  targets: EventTarget[] | null;
  metadata: Metadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  hash: string;
  prevHash: string | null;
  occurredAt: string;
};

export type ListEventsParams = {
  limit?: number;
  cursor?: string;
  organization?: string;
  actorId?: string;
  action?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

export type SearchEventsParams = {
  q: string;
  limit?: number;
  cursor?: string;
};

export type ListResult<T> = {
  data: T[];
  nextCursor: string | null;
};

export type ExportParams = {
  format?: "csv" | "json";
  organization?: string;
  actorId?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

export type DeleteActorParams = {
  id: string;
  organization?: string;
};

export type DeleteActorResult = {
  actorId: string;
  anonymizedEvents: number;
  erasedAt: string;
};

export type CreateEmbedTokenParams = {
  /**
   * Optional tenant filter. When set, the embed feed only shows events tagged
   * with this organization id. Leave undefined for the default admin view —
   * every event in the project, across every tenant.
   */
  organization?: string;
  /** Token lifetime in seconds. Server picks a sensible default when omitted. */
  ttlSeconds?: number;
  /** Reserved for forward compatibility. */
  scopes?: string[];
};

export type CreateEmbedTokenResult = {
  token: string;
  expiresAt: string;
  scopes: string[];
};

export type RecalledErrorCode =
  | "INVALID_API_KEY"
  | "REVOKED_API_KEY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PLAN_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";
