/** Small, locale-stable formatters shared by memories, prompts and UI. */

export function formatUsd(value: number | null, options: { signed?: boolean } = {}): string {
  if (value === null || !Number.isFinite(value)) return "unknown";
  const sign = options.signed && value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 2;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "an unknown amount of";
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "unknown";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatDateTime(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}

export function shortType(coinType: string): string {
  return coinType.split("::").at(-1) ?? coinType;
}
