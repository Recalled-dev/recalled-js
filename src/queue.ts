// In-memory event queue with exponential backoff. The queue is the
// client-side half of the Scale plan SLA — if the ingestion API is
// unreachable, events are buffered here and retried transparently,
// so a short API outage does not surface as an exception in the
// caller's code.
//
// Persistence (disk / localStorage) is intentionally not implemented
// yet. When the host process restarts, the queue is lost. This is a
// conscious trade-off for the first iteration; persistence will be
// added in a later version.

import { isRecalledError } from "./errors.js";
import type { CreateEventInput, Event } from "./types.js";

export type QueueDropReason = "ttl_expired" | "fatal_error" | "queue_full";

export type ResilienceOptions = {
  /** Maximum number of events held in memory. Oldest gets dropped when full. */
  maxQueueSize?: number;
  /** Hard time-to-live for an event in the queue, in milliseconds. */
  maxAgeMs?: number;
  /** Initial retry delay in milliseconds. */
  minBackoffMs?: number;
  /** Maximum retry delay in milliseconds (backoff caps at this value). */
  maxBackoffMs?: number;
  /**
   * Called when an event is dropped without reaching the API. `reason`
   * explains why. Use this to forward the event to your own Sentry /
   * Datadog / local fallback so no audit entry is silently lost.
   */
  onDrop?: (
    input: CreateEventInput,
    reason: QueueDropReason,
    error?: unknown,
  ) => void;
  /** Called after a queued event reaches the API successfully. */
  onDelivered?: (input: CreateEventInput, event: Event) => void;
  /**
   * Called on every failed delivery attempt (including attempts that
   * will be retried). Useful for observability — do not use this to
   * decide whether the event is "lost"; use `onDrop` for that.
   */
  onError?: (err: unknown, input: CreateEventInput) => void;
};

type ResolvedOptions = Required<Omit<ResilienceOptions, "onDrop" | "onDelivered" | "onError">> &
  Pick<ResilienceOptions, "onDrop" | "onDelivered" | "onError">;

type QueuedItem = {
  id: number;
  input: CreateEventInput;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
};

const DEFAULTS: Required<Omit<ResilienceOptions, "onDrop" | "onDelivered" | "onError">> = {
  maxQueueSize: 5000,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  minBackoffMs: 1000,            // 1 second
  maxBackoffMs: 10 * 60 * 1000,  // 10 minutes
};

// Error codes that mean "do NOT retry, this event will never succeed".
// Everything else (network error, timeout, 5xx, 429 rate-limit) is
// treated as transient and scheduled for a retry.
const FATAL_CODES = new Set<string>([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_API_KEY",
  "REVOKED_API_KEY",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "PLAN_LIMIT_REACHED",
]);

export type EventSender = (input: CreateEventInput) => Promise<Event>;

export class EventQueue {
  private readonly items: QueuedItem[] = [];
  private readonly opts: ResolvedOptions;
  private readonly sender: EventSender;
  private nextId = 1;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private drainWaiters: (() => void)[] = [];

  constructor(sender: EventSender, options: ResilienceOptions = {}) {
    this.sender = sender;
    this.opts = {
      maxQueueSize: options.maxQueueSize ?? DEFAULTS.maxQueueSize,
      maxAgeMs: options.maxAgeMs ?? DEFAULTS.maxAgeMs,
      minBackoffMs: options.minBackoffMs ?? DEFAULTS.minBackoffMs,
      maxBackoffMs: options.maxBackoffMs ?? DEFAULTS.maxBackoffMs,
      onDrop: options.onDrop,
      onDelivered: options.onDelivered,
      onError: options.onError,
    };
  }

  /** Add an event to the queue and kick the worker if needed. */
  enqueue(input: CreateEventInput): void {
    if (this.items.length >= this.opts.maxQueueSize) {
      const dropped = this.items.shift();
      if (dropped) this.opts.onDrop?.(dropped.input, "queue_full");
    }
    const now = Date.now();
    this.items.push({
      id: this.nextId++,
      input,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    });
    this.kick();
  }

  /** Current number of pending events. */
  size(): number {
    return this.items.length;
  }

  /**
   * Wait for every currently queued event to be delivered or dropped.
   * Resolves early on timeout if the queue cannot drain in time.
   */
  async flush(timeoutMs = 30_000): Promise<void> {
    if (this.items.length === 0) return;
    return new Promise<void>((resolve) => {
      let settled = false;
      const settleOnce = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        resolve();
      };
      const timeoutHandle = setTimeout(settleOnce, timeoutMs);
      this.drainWaiters.push(settleOnce);
      this.kick();
    });
  }

  private kick(): void {
    if (this.running) return;
    if (this.items.length === 0) {
      this.notifyDrain();
      return;
    }
    this.running = true;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const head = this.items[0];
    if (!head) {
      this.running = false;
      this.notifyDrain();
      return;
    }
    const delay = Math.max(0, head.nextAttemptAt - Date.now());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.processHead(), delay);
  }

  private async processHead(): Promise<void> {
    this.timer = null;
    const head = this.items[0];
    if (!head) {
      this.running = false;
      this.notifyDrain();
      return;
    }

    // TTL check — drop and move on if the event is too old.
    if (Date.now() - head.createdAt > this.opts.maxAgeMs) {
      this.items.shift();
      this.opts.onDrop?.(head.input, "ttl_expired");
      this.scheduleNext();
      return;
    }

    head.attempts += 1;
    try {
      const event = await this.sender(head.input);
      this.items.shift();
      this.opts.onDelivered?.(head.input, event);
      this.scheduleNext();
      return;
    } catch (err) {
      this.opts.onError?.(err, head.input);

      if (this.isFatal(err)) {
        // Fatal — this event will never succeed, drop it.
        this.items.shift();
        this.opts.onDrop?.(head.input, "fatal_error", err);
        this.scheduleNext();
        return;
      }

      // Recoverable — schedule the next attempt with exponential backoff.
      head.nextAttemptAt = Date.now() + this.computeBackoff(head.attempts);
      this.scheduleNext();
    }
  }

  private isFatal(err: unknown): boolean {
    if (!isRecalledError(err)) return false;
    if (FATAL_CODES.has(err.code)) return true;
    // A 4xx other than 408/429 is treated as fatal too (client mistake).
    if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
      return true;
    }
    return false;
  }

  private computeBackoff(attempts: number): number {
    const base = Math.min(
      this.opts.minBackoffMs * 2 ** (attempts - 1),
      this.opts.maxBackoffMs,
    );
    // Full-jitter: pick a random value in [0, base].
    return Math.floor(Math.random() * base) + Math.floor(base / 2);
  }

  private notifyDrain(): void {
    if (this.items.length !== 0) return;
    while (this.drainWaiters.length > 0) {
      const waiter = this.drainWaiters.shift();
      waiter?.();
    }
  }
}
