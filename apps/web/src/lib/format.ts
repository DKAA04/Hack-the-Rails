// View-level formatting. Works on plain primitives, never on contract DTOs.

export interface MoneyValue {
  amount: number; // integer minor units
  currency: string;
}

const fractionCache = new Map<string, number>();
export function minorDigits(currency: string): number {
  const cached = fractionCache.get(currency);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency })
        .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  fractionCache.set(currency, digits);
  return digits;
}

/** Formats integer minor units without floating-point arithmetic. */
export function formatMoney(money: MoneyValue, opts: { compact?: boolean } = {}) {
  const digits = minorDigits(money.currency);
  const base = 10 ** digits;
  const major = Math.trunc(money.amount / base);
  const minor = money.amount - major * base;
  const decimal =
    digits === 0 ? `${major}` : `${major}.${String(minor).padStart(digits, "0")}`;
  const showMinor = !opts.compact || minor !== 0;
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: showMinor ? digits : 0,
    maximumFractionDigits: showMinor ? digits : 0,
  });
  // Intl accepts decimal strings exactly (ES2023); keeps money integer-safe.
  return formatter.format(decimal as unknown as number);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

export function formatTime(utc: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(utc));
}

export function localDateKey(utc: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(utc));
}

export function formatDate(utc: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(utc));
}

export function formatDateTime(utc: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utc));
}

export function localHour(utc: string, timeZone: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(new Date(utc)),
  );
}

/** Whole local-calendar days between two UTC instants in their own zones. */
export function dayOffset(
  fromUtc: string,
  fromZone: string,
  toUtc: string,
  toZone: string,
) {
  const a = Date.parse(localDateKey(fromUtc, fromZone));
  const b = Date.parse(localDateKey(toUtc, toZone));
  return Math.round((b - a) / 86_400_000);
}

export function minutesBetween(fromUtc: string, toUtc: string) {
  return Math.round((Date.parse(toUtc) - Date.parse(fromUtc)) / 60_000);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
