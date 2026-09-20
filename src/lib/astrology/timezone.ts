import tzlookup from "tz-lookup";

/** Resolve IANA timezone from lat/lon. */
export function timezoneAt(lat: number, lon: number): string {
  return tzlookup(lat, lon);
}

/**
 * Return the UTC offset in hours for the given local civil date/time in the
 * given IANA timezone. Handles DST automatically.
 */
export function tzOffsetHoursFor(
  isoLocalDateTime: string,
  timeZone: string,
): number {
  // Treat the wall time as if it were UTC; then ask Intl how that instant
  // appears in the target tz, and compute the difference.
  const asUtc = new Date(`${isoLocalDateTime}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(asUtc).map((p) => [p.type, p.value]),
  );
  const tzAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // tzAsUtc - asUtc.getTime() = offset (ms)
  return (tzAsUtc - asUtc.getTime()) / 3_600_000;
}