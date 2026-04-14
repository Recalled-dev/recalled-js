import type { Event } from "../types.js";

export type RecalledFeedTheme = "dark" | "light" | "auto";

export type RecalledFeedLabels = {
  searchPlaceholder?: string;
  noEvents?: string;
  loading?: string;
  error?: string;
  loadMore?: string;
  timeColumn?: string;
  actionColumn?: string;
  actorColumn?: string;
  orgColumn?: string;
  retry?: string;
  clearFilters?: string;
  poweredBy?: string;
};

export type RecalledFeedThemeOverrides = {
  accentColor?: string;
  backgroundColor?: string;
  cardColor?: string;
  foregroundColor?: string;
  mutedColor?: string;
  borderColor?: string;
  fontFamily?: string;
  fontFamilyMono?: string;
  fontSize?: string;
  radius?: string;
  rowHoverColor?: string;
};

export type RecalledFeedFeatures = {
  showSearch?: boolean;
  showTimestamps?: boolean;
  showActor?: boolean;
  showOrganization?: boolean;
  showTargets?: boolean;
  showMetadata?: boolean;
  showPagination?: boolean;
  showPoweredBy?: boolean;
  compact?: boolean;
};

export type RecalledFeedProps = RecalledFeedThemeOverrides &
  RecalledFeedFeatures & {
    embedToken: string;
    baseUrl?: string;
    pageSize?: number;
    theme?: RecalledFeedTheme;
    locale?: "en" | "fr" | string;
    labels?: RecalledFeedLabels;
    formatDate?: (iso: string, locale: string) => string;
    refreshIntervalMs?: number;
    emptyState?: React.ReactNode;
    errorState?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onEventClick?: (event: Event) => void;
    onError?: (error: Error) => void;
    onLoad?: (events: Event[]) => void;
  };

export type { Event };
