import {
  ZODIAC_SIGNS, type ZodiacSign, type BodyPosition, type Aspect, type AspectType, type BodyName,
} from "./types";

export function normalizeDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

export function signFromLongitude(lon: number): { sign: ZodiacSign; degree: number } {
  const n = normalizeDeg(lon);
  const idx = Math.floor(n / 30);
  return { sign: ZODIAC_SIGNS[idx], degree: n - idx * 30 };
}

export function formatDegree(deg: number): string {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
}

export function houseOf(lon: number, cusps: number[]): number {
  // cusps[0] is house 1. Returns 1-12.
  const n = normalizeDeg(lon);
  for (let i = 0; i < 12; i++) {
    const start = normalizeDeg(cusps[i]);
    const end = normalizeDeg(cusps[(i + 1) % 12]);
    const inside =
      start < end
        ? n >= start && n < end
        : n >= start || n < end;
    if (inside) return i + 1;
  }
  return 1;
}

const ASPECT_DEFS: { type: AspectType; angle: number; orb: number }[] = [
  { type: "Conjunction", angle: 0, orb: 8 },
  { type: "Opposition", angle: 180, orb: 8 },
  { type: "Trine", angle: 120, orb: 7 },
  { type: "Square", angle: 90, orb: 7 },
  { type: "Sextile", angle: 60, orb: 5 },
  { type: "Quincunx", angle: 150, orb: 3 },
  { type: "Semi-Sextile", angle: 30, orb: 2 },
  { type: "Semi-Square", angle: 45, orb: 2 },
  { type: "Sesquiquadrate", angle: 135, orb: 2 },
  { type: "Quintile", angle: 72, orb: 2 },
  { type: "Biquintile", angle: 144, orb: 2 },
];

const ASPECT_BODIES: BodyName[] = [
  "Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn",
  "Uranus","Neptune","Pluto","Chiron","North Node","Ascendant","Midheaven",
];

export function calculateAspects(bodies: BodyPosition[]): Aspect[] {
  const map = new Map(bodies.map((b) => [b.name, b]));
  const out: Aspect[] = [];
  const list = ASPECT_BODIES.filter((n) => map.has(n));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = map.get(list[i])!;
      const b = map.get(list[j])!;
      const diff = Math.abs(normalizeDeg(a.longitude - b.longitude));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(angle - def.angle);
        if (orb <= def.orb) {
          const relSpeed = (a.speed ?? 0) - (b.speed ?? 0);
          out.push({
            a: a.name, b: b.name, type: def.type,
            angle: def.angle, orb,
            applying: relSpeed * (a.longitude - b.longitude) < 0,
          });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}