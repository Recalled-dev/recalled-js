import type { RecalledFeedTheme, RecalledFeedThemeOverrides } from "./types.js";

export type ResolvedTheme = {
  accent: string;
  bg: string;
  card: string;
  fg: string;
  muted: string;
  border: string;
  font: string;
  fontMono: string;
  fontSize: string;
  radius: string;
  rowHover: string;
};

const DARK: ResolvedTheme = {
  accent: "#06b6d4",
  bg: "#080808",
  card: "#0f0f0f",
  fg: "#e8e8e8",
  muted: "#888888",
  border: "rgba(255, 255, 255, 0.08)",
  font: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: "14px",
  radius: "12px",
  rowHover: "rgba(255, 255, 255, 0.03)",
};

const LIGHT: ResolvedTheme = {
  accent: "#0891b2",
  bg: "#ffffff",
  card: "#fafafa",
  fg: "#0f0f0f",
  muted: "#666666",
  border: "rgba(0, 0, 0, 0.08)",
  font: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: "14px",
  radius: "12px",
  rowHover: "rgba(0, 0, 0, 0.03)",
};

export function resolveTheme(
  theme: RecalledFeedTheme | undefined,
  overrides: RecalledFeedThemeOverrides,
): ResolvedTheme {
  const base = pickBase(theme);
  return {
    accent: overrides.accentColor ?? base.accent,
    bg: overrides.backgroundColor ?? base.bg,
    card: overrides.cardColor ?? base.card,
    fg: overrides.foregroundColor ?? base.fg,
    muted: overrides.mutedColor ?? base.muted,
    border: overrides.borderColor ?? base.border,
    font: overrides.fontFamily ?? base.font,
    fontMono: overrides.fontFamilyMono ?? base.fontMono,
    fontSize: overrides.fontSize ?? base.fontSize,
    radius: overrides.radius ?? base.radius,
    rowHover: overrides.rowHoverColor ?? base.rowHover,
  };
}

function pickBase(theme: RecalledFeedTheme | undefined): ResolvedTheme {
  if (theme === "light") return LIGHT;
  if (theme === "dark") return DARK;
  if (typeof window !== "undefined" && window.matchMedia) {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    return prefersLight ? LIGHT : DARK;
  }
  return DARK;
}

export function themeToCssVars(theme: ResolvedTheme): React.CSSProperties {
  return {
    // @ts-expect-error, CSS custom properties
    "--rcld-accent": theme.accent,
    "--rcld-bg": theme.bg,
    "--rcld-card": theme.card,
    "--rcld-fg": theme.fg,
    "--rcld-muted": theme.muted,
    "--rcld-border": theme.border,
    "--rcld-font": theme.font,
    "--rcld-font-mono": theme.fontMono,
    "--rcld-font-size": theme.fontSize,
    "--rcld-radius": theme.radius,
    "--rcld-row-hover": theme.rowHover,
  };
}
