# @recalled/sdk

Les logs d'audit en SaaS. Enregistre chaque action de ton produit en 3 lignes de code, reste conforme SOC2, ISO 27001 et RGPD.

- Petit, zéro dépendance, TypeScript-first
- Fonctionne en Node 18+, Bun, Deno, navigateur, edge runtimes
- Composant React optionnel `<RecalledFeed />` — un widget admin interne à brancher dans le back-office que ton équipe support, ops et compliance utilise déjà
- [English](./README.md)

## Installation

```bash
npm install @recalled/sdk
# ou
pnpm add @recalled/sdk
# ou
yarn add @recalled/sdk
```

## Démarrage rapide

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
  metadata: { reason: "demande client" },
});
```

C'est tout. L'event est signé, chaîné, stocké, et searchable depuis ton dashboard Recalled.

## Authentification

Récupère une clé API depuis ton [dashboard Recalled](https://recalled.dev/dashboard), paramètres projet, onglet clés API. Passe-la au constructeur ou via la variable d'environnement `RECALLED_API_KEY`.

```ts
const client = new Recalled({
  apiKey: "rec_live_aBcD1234_...",
  baseUrl: "https://api.recalled.dev/v1", // optionnel
  timeoutMs: 10_000, // optionnel
});
```

## Events

### Créer (mode strict, throw en cas d'échec)

Appelle `create()` quand tu veux que le log d'audit fasse partie du succès de la requête — c'est-à-dire que si Recalled est injoignable, ton handler doit renvoyer un 500 et toute l'opération doit échouer.

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
    { type: "invoice", id: "inv_456", name: "Facture n°2024-042" },
  ],
  metadata: {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    reason: "demande client",
  },
});
```

Throw une `RecalledError` en cas d'échec (réseau, timeout, validation, etc).

### Emit (résilient, recommandé)

Appelle `emit()` quand tu ne veux pas qu'une panne API passagère fasse remonter une exception dans ton request path — c'est ce que tu veux presque toujours pour des logs d'audit.

`emit()` retourne immédiatement et la livraison a lieu en arrière-plan. Si l'API est injoignable, les events sont stockés dans une **queue en mémoire** et retentés automatiquement avec backoff exponentiel pendant 24 heures maximum. Ton handler ne voit jamais l'échec.

```ts
client.events.emit({
  action: "invoice.paid",
  actor: { id: "user_123", email: "alice@example.com" },
  organization: "org_xyz",
  metadata: { amount: 4200, currency: "eur" },
});
// retourne immédiatement, la livraison se fait en arrière-plan
```

`emit()` ne throw jamais. Les résultats de livraison sont exposés via des callbacks passés au constructeur :

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: {
    onDelivered: (input, event) => {
      // L'event a atteint l'API avec succès.
    },
    onError: (err, input) => {
      // Une tentative de livraison a échoué. Le SDK retry automatiquement
      // sauf si l'erreur est fatale (auth, validation, not found, quota).
    },
    onDrop: (input, reason, err) => {
      // Event droppé sans avoir atteint l'API. Route-le vers ton propre
      // logger (Sentry, Datadog, fichier) pour ne perdre aucune entrée.
      // reason vaut : "ttl_expired" | "fatal_error" | "queue_full"
    },
  },
});
```

### Flush avant de sortir

Pour les process courts (CLI, cron, Lambda), appelle `client.flush()` avant de sortir pour laisser la queue se vider. Sinon les events encore en attente sont perdus à la fermeture du process.

```ts
async function main() {
  client.events.emit({ action: "job.started" });
  await doWork();
  client.events.emit({ action: "job.completed" });
  await client.flush(); // attend jusqu'à 30s que les events pending soient livrés
}
```

`flush(timeoutMs?)` vaut 30 secondes par défaut et resolve tôt si la queue se vide avant.

### Options de résilience

La couche de résilience est activée par défaut avec des valeurs raisonnables. Override uniquement ce dont tu as besoin :

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: {
    maxQueueSize: 5000,            // events stockés en mémoire (défaut : 5000)
    maxAgeMs: 24 * 60 * 60 * 1000, // TTL avant drop (défaut : 24h)
    minBackoffMs: 1000,            // premier délai de retry (défaut : 1s)
    maxBackoffMs: 10 * 60 * 1000,  // cap du backoff (défaut : 10min)
    onDelivered, onError, onDrop,  // callbacks optionnels
  },
});
```

Passe `resilience: false` pour désactiver complètement le buffering. `emit()` devient alors un fire-and-forget brut avec les erreurs silencieusement ignorées.

```ts
const client = new Recalled({
  apiKey: process.env.RECALLED_API_KEY!,
  resilience: false,
});
```

### Cheat sheet `create` vs `emit`

| | `create()` | `emit()` |
|---|---|---|
| Retour | `Promise<Event>` | `void` |
| Throw en cas d'échec | oui | non |
| Buffer en cas de panne | non | oui |
| Retry jusqu'au TTL de 24h | non | oui, avec backoff |
| Bloque ton request path | oui | non |
| À utiliser quand | l'échec doit remonter | l'échec doit être invisible |

### Lister

Pagination cursor-based :

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

### Rechercher

Recherche full-text sur action, nom d'acteur, email d'acteur, id d'acteur :

```ts
const results = await client.events.search({ q: "facture supprimée" });
```

### Récupérer un event

```ts
const event = await client.events.retrieve("event_id");
```

## RGPD (Article 17, droit à l'effacement)

Anonymise tous les events liés à un acteur spécifique :

```ts
const result = await client.actors.delete({
  id: "user_123",
  organization: "org_xyz", // scope optionnel
});
// result.anonymizedEvents, result.erasedAt
```

## Tokens d'embed

Des credentials courts et browser-safe pour le widget admin `<RecalledFeed />`. Tu les génères sur ton serveur (là où vit la clé API) et tu passes uniquement le token au navigateur — ta clé ne quitte jamais le backend.

```ts
// Vue admin complète : le widget voit tous les events du projet, tous tenants confondus.
const { token, expiresAt } = await client.embed.createToken({
  ttlSeconds: 3600,
});
```

Besoin de drill-down sur un tenant précis ? Passe un `organization` et le token est restreint à ce tenant :

```ts
// Restreint : uniquement les events taggés "org_xyz"
const { token } = await client.embed.createToken({
  organization: "org_xyz",
  ttlSeconds: 900,
});
```

Dans les deux cas, passe le `token` au composant `<RecalledFeed />` ci-dessous.

## Composant React embed — widget admin

`<RecalledFeed />` est un **widget d'observabilité interne**. Tu le branches dans le **panneau admin, la console support ou le back-office que ton équipe utilise déjà pour opérer ton produit** — pour que ton support, tes ops, tes SRE et tes auditeurs compliance puissent investiguer "qui a fait quoi" sans jamais quitter leur workflow.

Ce **n'est pas** un composant customer-facing. Les end users de ton SaaS ne voient jamais Recalled directement. Garde le widget derrière l'auth admin que tu utilises déjà.

Installe `react` et `react-dom` dans ton projet. Importe depuis `@recalled/sdk/react`.

```tsx
// à l'intérieur de ton propre dashboard admin / console support
import { RecalledFeed } from "@recalled/sdk/react";

export default function AdminAuditLogPage({ embedToken }: { embedToken: string }) {
  return (
    <RecalledFeed
      embedToken={embedToken}
      theme="dark"
      locale="fr"
      pageSize={20}
    />
  );
}
```

### Props

Toutes les props sont optionnelles sauf `embedToken`.

| Prop | Type | Défaut | Description |
|---|---|---|---|
| `embedToken` | `string` | requis | Token signé issu de `client.embed.createToken()`. |
| `baseUrl` | `string` | `https://api.recalled.dev/v1` | Override si tu self-host l'API. |
| `pageSize` | `number` | `20` | Events fetchés par page. |
| `theme` | `"dark" \| "light" \| "auto"` | `"auto"` | Thème. `"auto"` utilise `prefers-color-scheme`. |
| `locale` | `"en" \| "fr" \| string` | `"en"` | Locale pour les labels par défaut et le formatage des dates. |
| `refreshIntervalMs` | `number` | `0` | Intervalle d'auto-refresh en ms. `0` désactive. |
| `onEventClick` | `(event) => void` | - | Appelé quand une ligne est cliquée. Rend les lignes accessibles au clavier. |
| `onError` | `(error) => void` | - | Déclenché quand un fetch échoue. |
| `onLoad` | `(events) => void` | - | Déclenché à chaque fetch réussi. |

### Personnalisation UI

Chaque couleur, police, bordure et rayon est une prop. Aucun fichier CSS à importer.

| Prop | Type | Description |
|---|---|---|
| `accentColor` | `string` | Accent principal (chips d'action, boutons). |
| `backgroundColor` | `string` | Fond racine. |
| `cardColor` | `string` | Fond des cards et inputs. |
| `foregroundColor` | `string` | Couleur de texte principale. |
| `mutedColor` | `string` | Texte secondaire. |
| `borderColor` | `string` | Bordures et séparateurs. |
| `rowHoverColor` | `string` | Fond au survol quand la ligne est cliquable. |
| `fontFamily` | `string` | Stack de police sans-serif. |
| `fontFamilyMono` | `string` | Stack de police monospace. |
| `fontSize` | `string` | Taille de base (valeur CSS). |
| `radius` | `string` | Rayon de bordure externe (valeur CSS). |
| `className` | `string` | Classe supplémentaire sur l'élément racine. |
| `style` | `CSSProperties` | Style inline sur l'élément racine. |

### Toggles de features

| Prop | Défaut | Description |
|---|---|---|
| `showSearch` | `true` | Affiche la barre de recherche. |
| `showTimestamps` | `true` | Affiche la colonne temps à gauche. |
| `showActor` | `true` | Affiche nom/email/id d'acteur sous chaque action. |
| `showOrganization` | `true` | Affiche le tag organisation quand présent. |
| `showTargets` | `false` | Affiche les chips de targets. |
| `showMetadata` | `false` | Affiche la metadata brute en JSON. |
| `showPagination` | `true` | Affiche le bouton "Charger plus". |
| `showPoweredBy` | `true` | Affiche le footer "Propulsé par recalled.dev". |
| `compact` | `false` | Padding de ligne plus dense. |

### Labels et i18n

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

### Formatage de date custom

```tsx
<RecalledFeed
  embedToken={token}
  formatDate={(iso) => new Date(iso).toLocaleString("fr-FR")}
/>
```

### États empty / error custom

```tsx
<RecalledFeed
  embedToken={token}
  emptyState={<MonEtatVide />}
  errorState={<MonEtatErreur />}
/>
```

## Erreurs

Toutes les erreurs lancées par le SDK sont des `RecalledError` avec un `code` stable :

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

| Code | Signification |
|---|---|
| `INVALID_API_KEY` | La clé n'existe pas ou est malformée. |
| `REVOKED_API_KEY` | La clé a été révoquée. |
| `UNAUTHORIZED` | Authentification manquante ou invalide. |
| `FORBIDDEN` | Authentifié mais non autorisé. |
| `NOT_FOUND` | La ressource n'existe pas. |
| `VALIDATION_ERROR` | Body ou params invalides. |
| `PLAN_LIMIT_REACHED` | Quota mensuel dépassé. Upgrade ton plan. |
| `RATE_LIMITED` | Trop de requêtes. Backoff. |
| `NETWORK_ERROR` | Échec TCP/DNS/connexion. |
| `TIMEOUT` | Requête plus longue que `timeoutMs`. |
| `INTERNAL_ERROR` | Erreur serveur. Réessaye avec backoff. |
| `UNKNOWN_ERROR` | Erreur inattendue que le SDK n'a pas pu classer. |

## Compatibilité

- Node.js 18+
- Bun 1+
- Deno (avec le specifier `npm:`)
- Navigateurs modernes, y compris edge runtimes (Cloudflare Workers, Vercel Edge)
- React 18+ et React 19+ pour le composant embed

## Licence

MIT, voir [LICENSE](./LICENSE).
