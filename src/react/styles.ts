export const RECALLED_FEED_CSS = `
.rcld-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--rcld-bg);
  color: var(--rcld-fg);
  font-family: var(--rcld-font);
  font-size: var(--rcld-font-size);
  border-radius: var(--rcld-radius);
  padding: 16px;
  border: 1px solid var(--rcld-border);
  box-sizing: border-box;
  width: 100%;
  line-height: 1.5;
}
.rcld-root *, .rcld-root *::before, .rcld-root *::after { box-sizing: border-box; }

.rcld-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.rcld-search {
  flex: 1;
  min-width: 160px;
  padding: 8px 12px;
  background: var(--rcld-card);
  border: 1px solid var(--rcld-border);
  border-radius: calc(var(--rcld-radius) * 0.7);
  color: var(--rcld-fg);
  font-family: inherit;
  font-size: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.rcld-search:focus {
  border-color: var(--rcld-accent);
}
.rcld-search::placeholder {
  color: var(--rcld-muted);
}

.rcld-status {
  font-family: var(--rcld-font-mono);
  font-size: 11px;
  color: var(--rcld-muted);
}

.rcld-error {
  padding: 12px;
  border: 1px solid var(--rcld-accent);
  border-radius: calc(var(--rcld-radius) * 0.6);
  background: color-mix(in srgb, var(--rcld-accent) 6%, transparent);
  color: var(--rcld-fg);
  font-size: 13px;
}

.rcld-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--rcld-muted);
  font-size: 13px;
  border: 1px dashed var(--rcld-border);
  border-radius: calc(var(--rcld-radius) * 0.7);
}

.rcld-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rcld-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 10px;
  border-top: 1px solid var(--rcld-border);
  cursor: default;
  transition: background 0.15s;
}
.rcld-row:first-child { border-top: none; }
.rcld-row[data-clickable="true"] { cursor: pointer; }
.rcld-row[data-clickable="true"]:hover { background: var(--rcld-row-hover); }
.rcld-row[data-compact="true"] { padding: 8px 10px; gap: 8px; }

.rcld-time {
  flex-shrink: 0;
  min-width: 92px;
  font-family: var(--rcld-font-mono);
  font-size: 11px;
  color: var(--rcld-muted);
  padding-top: 2px;
}

.rcld-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.rcld-action {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--rcld-accent) 30%, transparent);
  background: color-mix(in srgb, var(--rcld-accent) 8%, transparent);
  color: var(--rcld-accent);
  font-family: var(--rcld-font-mono);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rcld-actor {
  font-family: var(--rcld-font-mono);
  font-size: 11px;
  color: var(--rcld-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rcld-org {
  font-family: var(--rcld-font-mono);
  font-size: 10px;
  color: var(--rcld-muted);
  opacity: 0.7;
}

.rcld-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.rcld-target {
  padding: 1px 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--rcld-fg) 5%, transparent);
  font-family: var(--rcld-font-mono);
  font-size: 10px;
  color: var(--rcld-muted);
}

.rcld-metadata {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--rcld-fg) 3%, transparent);
  font-family: var(--rcld-font-mono);
  font-size: 10px;
  color: var(--rcld-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

.rcld-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
}

.rcld-button {
  padding: 8px 14px;
  background: var(--rcld-card);
  border: 1px solid var(--rcld-border);
  border-radius: calc(var(--rcld-radius) * 0.6);
  color: var(--rcld-fg);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.rcld-button:hover:not(:disabled) {
  border-color: var(--rcld-accent);
  background: color-mix(in srgb, var(--rcld-accent) 6%, var(--rcld-card));
}
.rcld-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rcld-powered {
  font-family: var(--rcld-font-mono);
  font-size: 10px;
  color: var(--rcld-muted);
  opacity: 0.6;
}
.rcld-powered a {
  color: var(--rcld-accent);
  text-decoration: none;
}

@keyframes rcld-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
.rcld-loading {
  animation: rcld-pulse 1.2s ease-in-out infinite;
}

@media (max-width: 520px) {
  .rcld-time { min-width: 0; }
  .rcld-row { flex-direction: column; gap: 6px; }
}
`;
