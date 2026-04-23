# @recalled/sdk

Audit logs as a Service. Record every action in your product in 3 lines of code — the hassle-free alternative to your homegrown `activity_logs` table. Searchable, exportable, and compliance-ready (SOC2, ISO 27001, GDPR) if you ever need it.

- Tiny, zero-dependency, TypeScript-first
- Works in Node 18+, Bun, Deno, browser, edge runtimes
- Optional React component `<RecalledFeed />` — an internal admin widget you drop inside the back-office your support, ops and compliance team already use
- [Français](./README-FR.md)

## Install

```bash
npm install @recalled/sdk
# or
pnpm add @recalled/sdk
# or
yarn add @recalled/sdk
```

## Quick start

```ts
import { Recalled } from "@recalled/sdk";

const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
});

await client.events.create({
  action: "invoice.deleted",
  actor: { id: "user_123", email: "alice@example.com" },
  organization: "org_xyz",
  targets: [{ type: "invoice", id: "inv_456" }],
  metadata: { reason: "client request" },
});
```

That's it. The event is signed, chained, stored, and searchable from your Recalled dashboard.

## Authentication

Grab an API key from your [Recalled dashboard](https://recalled.dev/dashboard), project settings, API keys tab. Pass it to the constructor or via the `RECALLED_API_KEY` environment variable.

```ts
const client = new Recalled({
  apiKey: "rec_live_aBcD1234_...",
  baseUrl: "https://api.recalled.dev/v1", // optional
  timeoutMs: 10_000, // optional
});
```

## Events

### Create (strict, throws on failure)

Call `create()` when you want the audit log to be part of the request's success condition — i.e. if Recalled is unreachable, your handler should return a 500 and the whole operation should fail.

```ts
const event = await client.events.create({
  action: "invoice.deleted",
  organization: "org_xyz",
  actor: {
    type: "user",
    id: "user_123",
    name: "Alice Dupont",
    email: "alice@example.com",
  },
  targets: [
    { type: "invoice", id: "inv_456", name: "Facture #2024-042" },
  ],
  metadata: {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    reason: "client request",
  },
});
```

Throws `RecalledError` on any failure (network, timeout, validation, etc).

### Emit (resilient, recommended)

Call `emit()` when you don't want a transient API outage to bubble up as an exception in your request path — which is almost always what you want for audit logs.

`emit()` returns immediately and delivery happens in the background. If the API is unreachable, events are held in an **in-memory queue** and retried automatically with exponential backoff for up to 24 hours. Your handler never sees the failure.

```ts
client.events.emit({
  action: "invoice.paid",
  actor: { id: "user_123", email: "alice@example.com" },
  organization: "org_xyz",
  metadata: { amount: 4200, currency: "eur" },
});
// returns immediately, delivery happens in the background
```

`emit()` never throws. Delivery outcomes are exposed through callbacks passed to the constructor:

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: {
    onDelivered: (input, event) => {
      // Event reached the API successfully.
    },
    onError: (err, input) => {
      // A delivery attempt failed. The SDK will retry automatically
      // unless the error is fatal (auth, validation, not found, quota).
    },
    onDrop: (input, reason, err) => {
      // Event dropped without reaching the API. Forward to your own
      // logger (Sentry, Datadog, file) so no audit entry is lost.
      // reason is one of: "ttl_expired" | "fatal_error" | "queue_full"
    },
  },
});
```

### Flush before exit

For short-lived processes (CLI, cron, Lambda), call `client.flush()` before exiting to give the queue a chance to drain. Otherwise any events still pending are lost when the process terminates.

```ts
async function main() {
  client.events.emit({ action: "job.started" });
  await doWork();
  client.events.emit({ action: "job.completed" });
  await client.flush(); // wait up to 30s for pending events to deliver
}
```

`flush(timeoutMs?)` defaults to 30 seconds and resolves early if the queue drains first.

### Resilience options

The resilience layer is enabled by default with sensible defaults. Override only what you need:

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: {
    maxQueueSize: 5000,            // events held in memory (default: 5000)
    maxAgeMs: 24 * 60 * 60 * 1000, // TTL before drop (default: 24h)
    minBackoffMs: 1000,            // first retry delay (default: 1s)
    maxBackoffMs: 10 * 60 * 1000,  // backoff cap (default: 10min)
    onDelivered, onError, onDrop,  // optional callbacks
  },
});
```

Pass `resilience: false` to disable buffering entirely. `emit()` then becomes a raw fire-and-forget with errors swallowed.

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: false,
});
```

### `create` vs `emit` cheat sheet

| | `create()` | `emit()` |
|---|---|---|
| Return | `Promise<Event>` | `void` |
| Throws on failure | yes | no |
| Buffers on outage | no | yes |
| Retries after 24h timeout | no | yes, with backoff |
| Blocks your request path | yes | no |
| Use when | failure must surface | failure should be invisible |

### List

Cursor-based pagination:

```ts
const { data, nextCursor } = await client.events.list({
  limit: 50,
  organization: "org_xyz",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
});

if (nextCursor) {
  const more = await client.events.list({ cursor: nextCursor });
}
```

### Search

Full-text search across action, actor name, actor email, actor id:

```ts
const results = await client.events.search({ q: "deleted invoice" });
```

### Retrieve one

```ts
const event = await client.events.retrieve("event_id");
```

## GDPR (Article 17, right to erasure)

Anonymize all events tied to a specific actor:

```ts
const result = await client.actors.delete({
  id: "user_123",
  organization: "org_xyz", // optional scope
});
// result.anonymizedEvents, result.erasedAt
```

## Embed tokens

Short-lived, browser-safe credentials for the `<RecalledFeed />` admin widget. Mint them on your server (where the API key lives) and pass only the token to the browser — your key never leaves the backend.

```ts
// Admin-wide: the widget sees every event in the project, across every tenant.
const { token, expiresAt } = await client.embed.createToken({
  ttlSeconds: 3600,
});
```

Need to drill into a single tenant? Pass an `organization` and the token is narrowed to that tenant only:

```ts
// Scoped: only events tagged with organization "org_xyz"
const { token } = await client.embed.createToken({
  organization: "org_xyz",
  ttlSeconds: 900,
});
```

Either way, pass the resulting `token` to the `<RecalledFeed />` component below.

## React embed component — admin widget

`<RecalledFeed />` is an **internal observability widget**. You drop it inside the **admin panel, support console, or back-office your team already uses to operate the product** — so your support, ops, SRE and compliance people can investigate "who did what" without ever leaving their workflow.

It is **not** a customer-facing component. The end users of your SaaS never see Recalled directly. Keep the widget behind whatever admin auth you already have.

Install `react` and `react-dom` in your project. Import from `@recalled/sdk/react`.

```tsx
// inside your own admin dashboard / support console
import { RecalledFeed } from "@recalled/sdk/react";

export default function AdminAuditLogPage({ embedToken }: { embedToken: string }) {
  return (
    <RecalledFeed
      embedToken={embedToken}
      theme="dark"
      pageSize={20}
    />
  );
}
```

### Props

All props are optional except `embedToken`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `embedToken` | `string` | required | Signed token from `client.embed.createToken()`. |
| `baseUrl` | `string` | `https://api.recalled.dev/v1` | Override if you self-host the API. |
| `pageSize` | `number` | `20` | Events fetched per page. |
| `theme` | `"dark" \| "light" \| "auto"` | `"auto"` | Theme. `"auto"` uses `prefers-color-scheme`. |
| `locale` | `"en" \| "fr" \| string` | `"en"` | Locale for default labels and date formatting. |
| `refreshIntervalMs` | `number` | `0` | Auto-refresh interval in ms. `0` disables. |
| `onEventClick` | `(event) => void` | - | Called when a row is clicked. Makes rows keyboard-accessible. |
| `onError` | `(error) => void` | - | Fired when a fetch fails. |
| `onLoad` | `(events) => void` | - | Fired on each successful fetch. |

### UI customization

Every color, font, border and radius is a prop. No CSS file to import.

| Prop | Type | Description |
|---|---|---|
| `accentColor` | `string` | Primary accent (action chips, buttons). |
| `backgroundColor` | `string` | Root background. |
| `cardColor` | `string` | Card / input background. |
| `foregroundColor` | `string` | Main text color. |
| `mutedColor` | `string` | Secondary text. |
| `borderColor` | `string` | Borders and dividers. |
| `rowHoverColor` | `string` | Row hover background when clickable. |
| `fontFamily` | `string` | Sans-serif font stack. |
| `fontFamilyMono` | `string` | Monospace font stack. |
| `fontSize` | `string` | Base font size (CSS length). |
| `radius` | `string` | Outer border radius (CSS length). |
| `className` | `string` | Extra class on the root element. |
| `style` | `CSSProperties` | Inline style on the root element. |

### Feature toggles

| Prop | Default | Description |
|---|---|---|
| `showSearch` | `true` | Show the search box. |
| `showTimestamps` | `true` | Show the left time column. |
| `showActor` | `true` | Show actor name/email/id under each action. |
| `showOrganization` | `true` | Show the organization tag when present. |
| `showTargets` | `false` | Show target chips. |
| `showMetadata` | `false` | Show raw metadata as JSON. |
| `showPagination` | `true` | Show the "Load more" button. |
| `showPoweredBy` | `true` | Show the "Powered by recalled.dev" footer. |
| `compact` | `false` | Denser row padding. |

### Labels and i18n

```tsx
<RecalledFeed
  embedToken={token}
  locale="fr"
  labels={{
    searchPlaceholder: "Cherche dans les events...",
    noEvents: "Pas d'events.",
    loadMore: "Charger plus",
  }}
/>
```

### Custom date formatting

```tsx
<RecalledFeed
  embedToken={token}
  formatDate={(iso) => new Date(iso).toLocaleString("fr-FR")}
/>
```

### Custom empty / error states

```tsx
<RecalledFeed
  embedToken={token}
  emptyState={<MyEmptyState />}
  errorState={<MyErrorState />}
/>
```

## Errors

All errors thrown by the SDK are `RecalledError` instances with a stable `code`:

```ts
import { Recalled, RecalledError, isRecalledError } from "@recalled/sdk";

try {
  await client.events.create({ action: "test" });
} catch (err) {
  if (isRecalledError(err)) {
    console.log(err.code, err.status, err.message, err.requestId);
  }
}
```

| Code | Meaning |
|---|---|
| `INVALID_API_KEY` | Key does not exist or is malformed. |
| `REVOKED_API_KEY` | Key was revoked. |
| `UNAUTHORIZED` | Missing or invalid authentication. |
| `FORBIDDEN` | Authenticated but not allowed. |
| `NOT_FOUND` | Resource does not exist. |
| `VALIDATION_ERROR` | Request body or params failed validation. |
| `PLAN_LIMIT_REACHED` | Monthly quota exceeded. Upgrade your plan. |
| `RATE_LIMITED` | Too many requests. Back off. |
| `NETWORK_ERROR` | TCP/DNS/connection failure. |
| `TIMEOUT` | Request took longer than `timeoutMs`. |
| `INTERNAL_ERROR` | Server error. Retry with backoff. |
| `UNKNOWN_ERROR` | Unexpected error the SDK could not classify. |

## Compatibility

- Node.js 18+
- Bun 1+
- Deno (with `npm:` specifier)
- Modern browsers, including edge runtimes (Cloudflare Workers, Vercel Edge)
- React 18+ and React 19+ for the embed component

## License

MIT, see [LICENSE](./LICENSE).
