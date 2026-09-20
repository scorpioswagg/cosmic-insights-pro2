/**
 * Section-local evidence packets.
 *
 * Each chapter receives only the chart factors relevant to its subject rather
 * than the whole chart, which keeps prompts small, cheap and far less prone to
 * drifting into generic astrology.
 *
 * Pure deterministic selection — no AI. Client and server safe.
 */
import type { SerialChart, SynastryResult } from "./synastry";

interface Topic {
  match: RegExp;
  bodies: string[];
  houses: number[];
}

/** Chapter-title keyword → relevant chart factors. */
const TOPICS: Topic[] = [
  { match: /power|control|ego|dominan|leverage|authority/i, bodies: ["Pluto", "Mars", "Sun", "Saturn"], houses: [1, 8, 10] },
  { match: /communicat|say|word|silence|unsaid|talk|honest/i, bodies: ["Mercury", "Moon", "Jupiter", "Uranus"], houses: [3, 9, 11] },
  { match: /attract|chemistry|desire|seduc|passion|sex|intimac/i, bodies: ["Venus", "Mars", "Pluto", "Lilith", "Moon"], houses: [5, 7, 8] },
  { match: /love|romance|partner|relationship|marriage|commit/i, bodies: ["Venus", "Moon", "Saturn", "Juno", "Descendant"], houses: [5, 7, 11] },
  { match: /fear|anxiet|insecur|vulnerab|wound|shame|pain|hurt/i, bodies: ["Chiron", "Moon", "Saturn", "Neptune", "Pluto"], houses: [4, 8, 12] },
  { match: /shadow|dark|hidden|secret|deni|avoid|repress|mask/i, bodies: ["Pluto", "Lilith", "Neptune", "Saturn", "Moon"], houses: [8, 12, 4] },
  { match: /ambition|career|work|success|achiev|legacy|reputation/i, bodies: ["Saturn", "Sun", "Mars", "Jupiter", "Midheaven"], houses: [2, 6, 10] },
  { match: /money|value|worth|resource|cost|bill|price/i, bodies: ["Venus", "Saturn", "Jupiter", "Pluto"], houses: [2, 8, 10] },
  { match: /family|mother|father|childhood|home|root|origin/i, bodies: ["Moon", "Saturn", "Sun", "Chiron"], houses: [4, 10, 12] },
  { match: /identity|self|who you|mirror|image|persona|become/i, bodies: ["Sun", "Ascendant", "Moon", "Pluto", "North Node"], houses: [1, 10, 12] },
  { match: /conflict|anger|fight|rage|argu|defens|attack|breaking/i, bodies: ["Mars", "Pluto", "Saturn", "Uranus"], houses: [1, 6, 7] },
  { match: /pattern|repeat|habit|cycle|loop|sabotage|excuse/i, bodies: ["Saturn", "Moon", "South Node", "Neptune", "Pluto"], houses: [6, 12, 4] },
  { match: /freedom|autonomy|independ|detach|escape|distance/i, bodies: ["Uranus", "Aquarius", "Sun", "Mars", "Jupiter"], houses: [1, 9, 11] },
  { match: /growth|future|mature|path|potential|transform|integrat/i, bodies: ["Jupiter", "North Node", "Chiron", "Pluto", "Saturn"], houses: [9, 5, 12] },
  { match: /trust|betray|loyal|boundar|accountab|blame/i, bodies: ["Saturn", "Pluto", "Moon", "Neptune"], houses: [7, 8, 4] },
  { match: /truth|judgment|courtroom|cross-examination|verdict|evidence/i, bodies: ["Mercury", "Saturn", "Jupiter", "Sun", "Pluto"], houses: [3, 9, 10] },
];

const CORE_BODIES = ["Sun", "Moon", "Ascendant"];

function topicFor(chapter: string): { bodies: string[]; houses: number[] } {
  const bodies = new Set(CORE_BODIES);
  const houses = new Set<number>();
  let matched = false;
  for (const t of TOPICS) {
    if (t.match.test(chapter)) {
      matched = true;
      t.bodies.forEach((b) => bodies.add(b));
      t.houses.forEach((h) => houses.add(h));
    }
  }
  if (!matched) {
    ["Mercury", "Venus", "Mars", "Saturn", "Pluto"].forEach((b) => bodies.add(b));
    [1, 7, 10, 12].forEach((h) => houses.add(h));
  }
  return { bodies: [...bodies], houses: [...houses] };
}

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

/** Evidence packet for one chapter of a single-chart report. */
export function natalEvidence(chart: SerialChart, chapter: string): string {
  const { bodies, houses } = topicFor(chapter);
  const placements = chart.bodies
    .filter((b) => bodies.includes(b.name) || (b.house && houses.includes(b.house)))
    .map(
      (b) =>
        `- ${b.name}: ${b.sign} ${fmtDeg(b.signDegree)}${b.house ? ` (House ${b.house})` : ""}${
          b.retrograde ? " ℞" : ""
        }`,
    )
    .join("\n");
  const aspects = chart.aspects
    .filter((a) => bodies.includes(a.a) || bodies.includes(a.b))
    .slice(0, 14)
    .map((a) => `- ${a.a} ${a.type} ${a.b} (orb ${a.orb.toFixed(2)}°, ${a.applying ? "applying" : "separating"})`)
    .join("\n");
  const cusps = chart.houses
    .map((c, i) => ({ h: i + 1, c }))
    .filter((x) => houses.includes(x.h))
    .map((x) => `- House ${x.h} cusp: ${x.c.toFixed(2)}°`)
    .join("\n");
  return `RELEVANT PLACEMENTS:
${placements || "- (none isolated; use the core chart factors)"}

RELEVANT HOUSE CUSPS:
${cusps || "- n/a"}

RELEVANT ASPECTS:
${aspects || "- none within orb for these factors"}`;
}

/** Evidence packet for one chapter of a two-chart report. */
export function synastryEvidence(
  a: SerialChart,
  b: SerialChart,
  syn: SynastryResult,
  chapter: string,
): string {
  const { bodies, houses } = topicFor(chapter);
  const cross = syn.aspects
    .filter((x) => bodies.includes(x.a) || bodies.includes(x.b))
    .slice(0, 16)
    .map((x) => `- ${a.input.name}'s ${x.a} ${x.type} ${b.input.name}'s ${x.b} (orb ${x.orb.toFixed(2)}°)`)
    .join("\n");
  const ab = syn.aToB
    .filter((o) => bodies.includes(o.body) || houses.includes(o.house))
    .map((o) => `- ${a.input.name}'s ${o.body} (${o.sign}) in ${b.input.name}'s House ${o.house}`)
    .join("\n");
  const ba = syn.bToA
    .filter((o) => bodies.includes(o.body) || houses.includes(o.house))
    .map((o) => `- ${b.input.name}'s ${o.body} (${o.sign}) in ${a.input.name}'s House ${o.house}`)
    .join("\n");
  return `${a.input.name.toUpperCase()} — RELEVANT NATAL FACTORS:
${natalEvidence(a, chapter)}

${b.input.name.toUpperCase()} — RELEVANT NATAL FACTORS:
${natalEvidence(b, chapter)}

RELEVANT MUTUAL ASPECTS:
${cross || "- none within orb for these factors"}

RELEVANT OVERLAYS ${a.input.name} → ${b.input.name} (${b.input.name}'s houses):
${ab || "- n/a"}

RELEVANT OVERLAYS ${b.input.name} → ${a.input.name} (${a.input.name}'s houses):
${ba || "- n/a"}`;
}
