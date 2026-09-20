/**
 * Deterministic two-chart (synastry) engine.
 *
 * Pure math — no AI, no network, no browser APIs. Safe to import from both
 * client and server code.
 *
 * Overlay ownership is fixed and must never be reversed:
 *   A→B overlays = Person A's planets resolved against Person B's house cusps.
 *   B→A overlays = Person B's planets resolved against Person A's house cusps.
 */
import { houseOf, normalizeDeg } from "./zodiac";

/** Minimal serializable chart shape shared by the report pipeline. */
export interface SerialChart {
  input: {
    name: string;
    date: string;
    time: string;
    place: string;
    latitude: number;
    longitude: number;
    timezone: string;
    timeUnknown?: boolean;
  };
  julianDayUT: number;
  utcIso: string;
  ascendant: number;
  midheaven: number;
  bodies: Array<{
    name: string;
    longitude?: number;
    sign: string;
    signDegree: number;
    house?: number;
    retrograde: boolean;
    speed?: number;
  }>;
  houses: number[];
  aspects: Array<{
    a: string;
    b: string;
    type: string;
    orb: number;
    applying: boolean;
  }>;
}

export interface CrossAspect {
  a: string; // Person A body
  b: string; // Person B body
  type: string;
  angle: number;
  orb: number;
}

export interface Overlay {
  body: string;   // the visiting planet
  sign: string;
  house: number;  // house in the *host* chart
}

export type SynastryDomain =
  | "attraction"
  | "emotionalCompatibility"
  | "communication"
  | "intimacy"
  | "trust"
  | "conflict"
  | "power"
  | "autonomy"
  | "attachment"
  | "growth"
  | "friendship"
  | "ambition"
  | "vulnerability"
  | "stability"
  | "friction"
  | "repairPotential";

export interface SynastryResult {
  aspects: CrossAspect[];
  aToB: Overlay[];
  bToA: Overlay[];
  scores: Record<SynastryDomain, number>;
}

const ASPECT_DEFS: { type: string; angle: number; baseOrb: number }[] = [
  { type: "Conjunction", angle: 0, baseOrb: 8 },
  { type: "Opposition", angle: 180, baseOrb: 7 },
  { type: "Trine", angle: 120, baseOrb: 6 },
  { type: "Square", angle: 90, baseOrb: 6 },
  { type: "Sextile", angle: 60, baseOrb: 4 },
  { type: "Quincunx", angle: 150, baseOrb: 3 },
];

const LUMINARIES = new Set(["Sun", "Moon", "Ascendant", "Midheaven"]);
const PERSONAL = new Set(["Mercury", "Venus", "Mars"]);

const CROSS_BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
  "Uranus", "Neptune", "Pluto", "Chiron", "North Node", "Lilith",
  "Ascendant", "Midheaven",
];

const OVERLAY_BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
  "Uranus", "Neptune", "Pluto", "Chiron", "North Node", "Lilith",
];

/** Per-pair orb: widest for luminary-to-luminary, tightest for outer-to-outer. */
function orbFor(a: string, b: string, baseOrb: number): number {
  const weight = (n: string) => (LUMINARIES.has(n) ? 1 : PERSONAL.has(n) ? 0.5 : 0);
  const bonus = weight(a) + weight(b); // 0 .. 2
  return baseOrb * (0.6 + 0.2 * bonus);
}

function lonOf(body: SerialChart["bodies"][number]): number | null {
  if (typeof body.longitude === "number") return normalizeDeg(body.longitude);
  return null;
}

function crossAspects(a: SerialChart, b: SerialChart): CrossAspect[] {
  const out: CrossAspect[] = [];
  for (const nameA of CROSS_BODIES) {
    const ba = a.bodies.find((x) => x.name === nameA);
    const la = ba ? lonOf(ba) : null;
    if (la === null) continue;
    for (const nameB of CROSS_BODIES) {
      const bb = b.bodies.find((x) => x.name === nameB);
      const lb = bb ? lonOf(bb) : null;
      if (lb === null) continue;
      const diff = Math.abs(normalizeDeg(la - lb));
      const sep = diff > 180 ? 360 - diff : diff;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(sep - def.angle);
        if (orb <= orbFor(nameA, nameB, def.baseOrb)) {
          out.push({ a: nameA, b: nameB, type: def.type, angle: def.angle, orb });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/** Visitor's planets resolved against the host's house cusps. */
function overlays(visitor: SerialChart, host: SerialChart): Overlay[] {
  const out: Overlay[] = [];
  for (const name of OVERLAY_BODIES) {
    const body = visitor.bodies.find((x) => x.name === name);
    const lon = body ? lonOf(body) : null;
    if (!body || lon === null) continue;
    out.push({ body: name, sign: body.sign, house: houseOf(lon, host.houses) });
  }
  return out;
}

const HARMONIOUS = new Set(["Trine", "Sextile"]);
const HARD = new Set(["Square", "Opposition"]);

interface DomainRule {
  bodies: string[];
  houses: number[];
  /** Hard aspects raise rather than lower this domain (friction, conflict, power). */
  tensionDomain?: boolean;
}

const DOMAIN_RULES: Record<SynastryDomain, DomainRule> = {
  attraction: { bodies: ["Venus", "Mars", "Pluto", "Sun", "Ascendant"], houses: [5, 7, 8] },
  emotionalCompatibility: { bodies: ["Moon", "Venus", "Neptune", "Cancer"], houses: [4, 7, 12] },
  communication: { bodies: ["Mercury", "Moon", "Jupiter", "Uranus"], houses: [3, 9, 11] },
  intimacy: { bodies: ["Venus", "Mars", "Pluto", "Moon", "Lilith"], houses: [8, 5, 12] },
  trust: { bodies: ["Saturn", "Moon", "Pluto", "Jupiter"], houses: [8, 4, 7] },
  conflict: { bodies: ["Mars", "Pluto", "Saturn", "Uranus"], houses: [1, 7, 8], tensionDomain: true },
  power: { bodies: ["Pluto", "Mars", "Sun", "Saturn"], houses: [8, 10, 1], tensionDomain: true },
  autonomy: { bodies: ["Uranus", "Mars", "Sun", "Jupiter"], houses: [1, 9, 11] },
  attachment: { bodies: ["Moon", "Saturn", "Venus", "North Node"], houses: [4, 7, 12] },
  growth: { bodies: ["Jupiter", "North Node", "Chiron", "Uranus"], houses: [9, 12, 5] },
  friendship: { bodies: ["Mercury", "Jupiter", "Uranus", "Sun"], houses: [11, 3, 5] },
  ambition: { bodies: ["Saturn", "Sun", "Mars", "Midheaven"], houses: [10, 6, 2] },
  vulnerability: { bodies: ["Chiron", "Moon", "Neptune", "Pisces"], houses: [12, 4, 8] },
  stability: { bodies: ["Saturn", "Venus", "Moon", "Jupiter"], houses: [4, 2, 7] },
  friction: { bodies: ["Mars", "Saturn", "Uranus", "Pluto"], houses: [6, 7, 1], tensionDomain: true },
  repairPotential: { bodies: ["Jupiter", "Venus", "Moon", "Mercury", "Chiron"], houses: [7, 3, 12] },
};

function scoreDomain(
  domain: SynastryDomain,
  aspects: CrossAspect[],
  aToB: Overlay[],
  bToA: Overlay[],
): number {
  const rule = DOMAIN_RULES[domain];
  let score = 50;
  for (const asp of aspects) {
    const hits =
      (rule.bodies.includes(asp.a) ? 1 : 0) + (rule.bodies.includes(asp.b) ? 1 : 0);
    if (!hits) continue;
    const tightness = Math.max(0.2, 1 - asp.orb / 8);
    const weight = hits * tightness * 4;
    if (asp.type === "Conjunction") score += weight;
    else if (HARMONIOUS.has(asp.type)) score += rule.tensionDomain ? weight * 0.3 : weight;
    else if (HARD.has(asp.type)) score += rule.tensionDomain ? weight : -weight * 0.8;
    else score += rule.tensionDomain ? weight * 0.4 : -weight * 0.3;
  }
  for (const ov of [...aToB, ...bToA]) {
    if (rule.houses.includes(ov.house) && rule.bodies.includes(ov.body)) score += 2.5;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeSynastry(a: SerialChart, b: SerialChart): SynastryResult {
  const aspects = crossAspects(a, b);
  const aToB = overlays(a, b);
  const bToA = overlays(b, a);
  const scores = {} as Record<SynastryDomain, number>;
  for (const domain of Object.keys(DOMAIN_RULES) as SynastryDomain[]) {
    scores[domain] = scoreDomain(domain, aspects, aToB, bToA);
  }
  return { aspects, aToB, bToA, scores };
}

const DOMAIN_LABELS: Record<SynastryDomain, string> = {
  attraction: "Attraction",
  emotionalCompatibility: "Emotional compatibility",
  communication: "Communication",
  intimacy: "Intimacy",
  trust: "Trust",
  conflict: "Conflict",
  power: "Power",
  autonomy: "Autonomy",
  attachment: "Attachment",
  growth: "Growth",
  friendship: "Friendship",
  ambition: "Ambition",
  vulnerability: "Vulnerability",
  stability: "Stability",
  friction: "Friction",
  repairPotential: "Repair potential",
};

/** Compact prompt block describing the calculated two-chart data. */
export function synastryToPrompt(
  a: SerialChart,
  b: SerialChart,
  syn: SynastryResult,
  limit = 40,
): string {
  const nameA = a.input.name;
  const nameB = b.input.name;
  const asp = syn.aspects
    .slice(0, limit)
    .map((x) => `- ${nameA}'s ${x.a} ${x.type} ${nameB}'s ${x.b} (orb ${x.orb.toFixed(2)}°)`)
    .join("\n");
  const ab = syn.aToB
    .map((o) => `- ${nameA}'s ${o.body} (${o.sign}) falls in ${nameB}'s House ${o.house}`)
    .join("\n");
  const ba = syn.bToA
    .map((o) => `- ${nameB}'s ${o.body} (${o.sign}) falls in ${nameA}'s House ${o.house}`)
    .join("\n");
  const scores = (Object.keys(DOMAIN_LABELS) as SynastryDomain[])
    .map((d) => `- ${DOMAIN_LABELS[d]}: ${syn.scores[d]}/100`)
    .join("\n");
  return `MUTUAL (CROSS-CHART) ASPECTS — tightest ${Math.min(limit, syn.aspects.length)}:
${asp || "- none within orb"}

HOUSE OVERLAYS — ${nameA} → ${nameB} (resolved against ${nameB}'s house cusps):
${ab}

HOUSE OVERLAYS — ${nameB} → ${nameA} (resolved against ${nameA}'s house cusps):
${ba}

RELATIONSHIP DOMAIN SCORES (deterministic, derived from the data above — interpret them, do not restate them as a list):
${scores}`;
}
