import { ServiceError } from "../errors";
// Enumerate real offsets around the local date. Reject gaps and ambiguous DST times rather than guessing.
export function localToUtc(local: string, timeZone: string): string {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(local)) {
    const d = new Date(local);
    if (!Number.isFinite(+d))
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "Invalid supplier timestamp.",
        503,
      );
    return d.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local))
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "Invalid local supplier timestamp.",
      503,
    );
  const normalized = local.length === 16 ? `${local}:00` : local;
  const epoch = Date.parse(`${normalized}Z`);
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wall = (date: number) => {
    const parts = Object.fromEntries(
      format.formatToParts(date).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  };
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const probe = epoch + hours * 3600000;
    offsets.add(Date.parse(`${wall(probe)}Z`) - probe);
  }
  const matches = [...offsets]
    .map((offset) => epoch - offset)
    .filter((candidate) => wall(candidate) === normalized);
  if (matches.length !== 1)
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "Supplier local timestamp is ambiguous or falls in a DST gap.",
      503,
    );
  return new Date(matches[0]!).toISOString();
}
