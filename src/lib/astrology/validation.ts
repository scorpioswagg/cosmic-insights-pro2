import type { ChartCalculation, BodyName, ZodiacSign } from "./types";

/**
 * Kyle Merritt — Oct 25, 1984, 3:45 PM, Cincinnati, OH.
 * Expected core placements per user spec.
 */
export const KYLE_MERRITT_EXPECTED: Partial<Record<BodyName, ZodiacSign>> = {
  Sun: "Scorpio",
  Moon: "Scorpio",
  Mercury: "Scorpio",
  Venus: "Sagittarius",
  Mars: "Capricorn",
  Jupiter: "Capricorn",
  Saturn: "Scorpio",
  Uranus: "Sagittarius",
  Neptune: "Sagittarius",
  Pluto: "Scorpio",
  Ascendant: "Aquarius",
  Midheaven: "Sagittarius",
};

export const KYLE_MERRITT_INPUT = {
  name: "Kyle Merritt",
  date: "1984-10-25",
  time: "15:45",
  place: "Cincinnati, Ohio, USA",
  latitude: 39.1031,
  longitude: -84.5120,
  timezone: "America/New_York",
};

export interface ValidationRow {
  body: BodyName;
  expected: ZodiacSign;
  actual: ZodiacSign | "—";
  match: boolean;
}

export function validateChart(
  chart: ChartCalculation,
  expected: Partial<Record<BodyName, ZodiacSign>>,
): { rows: ValidationRow[]; passRate: number } {
  const rows: ValidationRow[] = [];
  for (const [body, sign] of Object.entries(expected) as Array<[BodyName, ZodiacSign]>) {
    const b = chart.bodies.find((x) => x.name === body);
    const actual = b?.sign ?? "—";
    rows.push({ body, expected: sign, actual, match: actual === sign });
  }
  const matches = rows.filter((r) => r.match).length;
  return { rows, passRate: rows.length ? matches / rows.length : 0 };
}