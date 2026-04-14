# @recalled/sdk

Audit logs as a Service. Record every action in your product in 3 lines of code, stay compliant with SOC2, ISO 27001 and GDPR.

- Tiny, zero-dependency, TypeScript-first
- Works in Node 18+, Bun, Deno, browser, edge runtimes
- Optional React component `<RecalledFeed />` to drop a live audit log view inside your own admin dashboard
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

### Create

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

Issue short-lived tokens that let you embed a scoped view of the audit log in your own admin dashboard without exposing your API key.

```ts
const { token, expiresAt } = await client.embed.createToken({
  organization: "org_xyz",
  ttlSeconds: 3600,
});
```

Pass the `token` to the `<RecalledFeed />` React component below.

## React embed component

`<RecalledFeed />` is meant for **your own admin dashboard**, the internal tool you and your team use to operate your product. It is an internal observability widget, not a white-label component to resell to your customers.

Install `react` and `react-dom` in your project. Import from `@recalled/sdk/react`.

```tsx
import { RecalledFeed } from "@recalled/sdk/react";

export default function AdminAuditPage({ embedToken }: { embedToken: string }) {
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

## Compatibility

- Node.js 18+
- Bun 1+
- Deno (with `npm:` specifier)
- Modern browsers, including edge runtimes (Cloudflare Workers, Vercel Edge)
- React 18+ and React 19+ for the embed component

## License

MIT, see [LICENSE](./LICENSE).
