import { useMemo, useState } from "react";
import type { Event } from "../types.js";
import { useEmbedEvents } from "./hooks.js";
import { resolveTheme, themeToCssVars } from "./theme.js";
import { RECALLED_FEED_CSS } from "./styles.js";
import type {
  RecalledFeedLabels,
  RecalledFeedProps,
} from "./types.js";

const DEFAULT_LABELS_EN: Required<RecalledFeedLabels> = {
  searchPlaceholder: "Search events, actors, actions...",
  noEvents: "No events yet.",
  loading: "Loading...",
  error: "Something went wrong.",
  loadMore: "Load more",
  timeColumn: "Time",
  actionColumn: "Action",
  actorColumn: "Actor",
  orgColumn: "Organization",
  retry: "Retry",
  clearFilters: "Clear",
  poweredBy: "Powered by",
};

const DEFAULT_LABELS_FR: Required<RecalledFeedLabels> = {
  searchPlaceholder: "Cherche events, acteurs, actions...",
  noEvents: "Aucun event pour l'instant.",
  loading: "Chargement...",
  error: "Une erreur est survenue.",
  loadMore: "Charger plus",
  timeColumn: "Temps",
  actionColumn: "Action",
  actorColumn: "Acteur",
  orgColumn: "Organisation",
  retry: "Réessayer",
  clearFilters: "Effacer",
  poweredBy: "Propulsé par",
};

let styleInjected = false;

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (styleInjected) return;
  const existing = document.querySelector("style[data-recalled-feed]");
  if (existing) {
    styleInjected = true;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute("data-recalled-feed", "true");
  el.textContent = RECALLED_FEED_CSS;
  document.head.appendChild(el);
  styleInjected = true;
}

export function RecalledFeed(props: RecalledFeedProps) {
  const {
    embedToken,
    baseUrl,
    pageSize = 20,
    theme = "auto",
    locale = "en",
    labels,
    formatDate,
    refreshIntervalMs = 0,
    emptyState,
    errorState,
    className,
    style,
    onEventClick,
    onError,
    onLoad,
    showSearch = true,
    showTimestamps = true,
    showActor = true,
    showOrganization = true,
    showTargets = false,
    showMetadata = false,
    showPagination = true,
    showPoweredBy = true,
    compact = false,
    ...themeOverrides
  } = props;

  const [search, setSearch] = useState("");
  const resolvedLabels = useMemo(() => {
    const base = locale === "fr" ? DEFAULT_LABELS_FR : DEFAULT_LABELS_EN;
    return { ...base, ...labels } as Required<RecalledFeedLabels>;
  }, [locale, labels]);

  const resolvedTheme = useMemo(
    () => resolveTheme(theme, themeOverrides),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      theme,
      themeOverrides.accentColor,
      themeOverrides.backgroundColor,
      themeOverrides.cardColor,
      themeOverrides.foregroundColor,
      themeOverrides.mutedColor,
      themeOverrides.borderColor,
      themeOverrides.fontFamily,
      themeOverrides.fontFamilyMono,
      themeOverrides.fontSize,
      themeOverrides.radius,
      themeOverrides.rowHoverColor,
    ],
  );

  const { events, loading, error, hasMore, loadMore, reload } = useEmbedEvents({
    embedToken,
    baseUrl,
    pageSize,
    search: search || undefined,
    refreshIntervalMs,
    onError,
    onLoad,
  });

  ensureStyles();

  const rootStyle: React.CSSProperties = {
    ...themeToCssVars(resolvedTheme),
    ...style,
  };

  const formatter = formatDate ?? defaultFormatDate;

  return (
    <div
      className={["rcld-root", className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-recalled-feed
    >
      {showSearch && (
        <div className="rcld-header">
          <input
            type="text"
            className="rcld-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={resolvedLabels.searchPlaceholder}
            aria-label={resolvedLabels.searchPlaceholder}
          />
          {loading && (
            <span className="rcld-status rcld-loading">
              {resolvedLabels.loading}
            </span>
          )}
        </div>
      )}

      {error &&
        (errorState ?? (
          <div className="rcld-error" role="alert">
            <div>
              {resolvedLabels.error} {error.message ? `- ${error.message}` : null}
            </div>
            <button
              type="button"
              className="rcld-button"
              onClick={reload}
              style={{ marginTop: 8 }}
            >
              {resolvedLabels.retry}
            </button>
          </div>
        ))}

      {!error && events.length === 0 && !loading && (
        <>{emptyState ?? <div className="rcld-empty">{resolvedLabels.noEvents}</div>}</>
      )}

      {events.length > 0 && (
        <ul className="rcld-list">
          {events.map((event) => (
            <FeedRow
              key={event.id}
              event={event}
              compact={compact}
              showTimestamps={showTimestamps}
              showActor={showActor}
              showOrganization={showOrganization}
              showTargets={showTargets}
              showMetadata={showMetadata}
              locale={locale}
              formatter={formatter}
              onClick={onEventClick}
            />
          ))}
        </ul>
      )}

      {(showPagination && hasMore) || showPoweredBy ? (
        <div className="rcld-footer">
          {showPagination && hasMore ? (
            <button
              type="button"
              className="rcld-button"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? resolvedLabels.loading : resolvedLabels.loadMore}
            </button>
          ) : (
            <span />
          )}
          {showPoweredBy && (
            <span className="rcld-powered">
              {resolvedLabels.poweredBy}{" "}
              <a
                href="https://recalled.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                recalled.dev
              </a>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FeedRow({
  event,
  compact,
  showTimestamps,
  showActor,
  showOrganization,
  showTargets,
  showMetadata,
  locale,
  formatter,
  onClick,
}: {
  event: Event;
  compact: boolean;
  showTimestamps: boolean;
  showActor: boolean;
  showOrganization: boolean;
  showTargets: boolean;
  showMetadata: boolean;
  locale: string;
  formatter: (iso: string, locale: string) => string;
  onClick?: (event: Event) => void;
}) {
  const clickable = Boolean(onClick);
  return (
    <li
      className="rcld-row"
      data-clickable={clickable ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      onClick={clickable ? () => onClick?.(event) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.(event);
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {showTimestamps && (
        <div className="rcld-time">{formatter(event.occurredAt, locale)}</div>
      )}
      <div className="rcld-main">
        <span className="rcld-action">{event.action}</span>
        {showActor && (
          <div className="rcld-actor">
            {event.actor?.name ??
              event.actor?.email ??
              event.actor?.id ??
              "-"}
          </div>
        )}
        {showOrganization && event.organization && (
          <div className="rcld-org">{event.organization}</div>
        )}
        {showTargets && event.targets && event.targets.length > 0 && (
          <div className="rcld-targets">
            {event.targets.map((t, i) => (
              <span key={i} className="rcld-target">
                {t.type}:{t.id}
              </span>
            ))}
          </div>
        )}
        {showMetadata && event.metadata && Object.keys(event.metadata).length > 0 && (
          <pre className="rcld-metadata">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

function defaultFormatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}
