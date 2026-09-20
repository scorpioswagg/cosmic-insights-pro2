/**
 * Client-only Swiss Ephemeris wrapper.
 *
 * Runs in the browser. Loads swisseph.wasm + swisseph.data from /wasm/.
 * Uses SEFLG_SWIEPH (with embedded ephemeris files for 1800-2400).
 *
 * NEVER imported by server code. NEVER falls back to fake data — if the
 * WASM module fails to load, every public method throws.
 */
import type {
  BirthInput, BodyPosition, BodyName, ChartCalculation,
} from "./types";
import { signFromLongitude, normalizeDeg, houseOf, calculateAspects } from "./zodiac";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let swePromise: Promise<any> | null = null;

async function getSwe() {
  if (typeof window === "undefined") {
    throw new Error("Swiss Ephemeris must be calculated in the browser.");
  }
  if (!swePromise) {
    swePromise = (async () => {
      const mod = await import("swisseph-wasm");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SwissEph: any = (mod as any).default ?? mod;
      const swe = new SwissEph();
      // The library's built-in initSwissEph resolves the .wasm/.data files
      // relative to its own module URL via import.meta.url — Vite serves
      // those correctly from node_modules in dev and from the asset bundle
      // in production. Do NOT import "swisseph-wasm/wasm/swisseph.js" — the
      // package's exports map only exposes ".", so subpath imports break
      // the build with: Missing "./wasm/swisseph.js" specifier.
      await swe.initSwissEph();
      return swe;
    })();
  }
  return swePromise;
}

const PLANET_IDS: Array<{ id: number; name: BodyName }> = [
  { id: 0, name: "Sun" },
  { id: 1, name: "Moon" },
  { id: 2, name: "Mercury" },
  { id: 3, name: "Venus" },
  { id: 4, name: "Mars" },
  { id: 5, name: "Jupiter" },
  { id: 6, name: "Saturn" },
  { id: 7, name: "Uranus" },
  { id: 8, name: "Neptune" },
  { id: 9, name: "Pluto" },
  { id: 15, name: "Chiron" },
  { id: 11, name: "North Node" }, // true node
  { id: 13, name: "Lilith" },     // mean apogee (Black Moon Lilith - oscillating not requested)
];

const SEFLG_SWIEPH = 2;
const SEFLG_SPEED = 256;
const FLAGS = SEFLG_SWIEPH | SEFLG_SPEED;

export async function calculateChart(input: BirthInput): Promise<ChartCalculation> {
  const swe = await getSwe();

  // Local civil time -> UT
  const [y, m, d] = input.date.split("-").map(Number);
  const [hh, mm] = input.time.split(":").map(Number);
  const utHour = hh + mm / 60 - input.tzOffsetHours;

  const jd: number = swe.julday(y, m, d, utHour);
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0) + (utHour * 3600 * 1000);
  const utcIso = new Date(utcMs).toISOString();

  const bodies: BodyPosition[] = [];

  for (const { id, name } of PLANET_IDS) {
    try {
      const res = swe.calc(jd, id, FLAGS);
      const lon = normalizeDeg(res.longitude);
      const { sign, degree } = signFromLongitude(lon);
      bodies.push({
        name,
        longitude: lon,
        latitude: res.latitude,
        distance: res.distance,
        speed: res.longitudeSpeed,
        sign, signDegree: degree,
        retrograde: res.longitudeSpeed < 0 && name !== "North Node" && name !== "South Node",
      });
    } catch (err) {
      throw new Error(`Swiss Ephemeris failed for ${name}: ${(err as Error).message}`);
    }
  }

  // South Node = North Node + 180
  const nn = bodies.find((b) => b.name === "North Node");
  if (nn) {
    const slon = normalizeDeg(nn.longitude + 180);
    const { sign, degree } = signFromLongitude(slon);
    bodies.push({
      name: "South Node",
      longitude: slon, latitude: -nn.latitude, distance: nn.distance,
      speed: nn.speed, sign, signDegree: degree, retrograde: nn.retrograde,
    });
  }

  // Houses (Placidus)
  const housesRes = swe.houses(jd, input.latitude, input.longitude, "P");
  let cusps12 = Array.from(housesRes.cusps as Float64Array).slice(1, 13).map(normalizeDeg);
  let ascendant = normalizeDeg(housesRes.ascmc[0]);
  let midheaven = normalizeDeg(housesRes.ascmc[1]);
  let vertex = normalizeDeg(housesRes.ascmc[3]);

  // Unknown birth time: time-dependent angles are meaningless, so we switch to
  // the standard solar-sign house frame (Sun's exact degree = 1st cusp, then
  // every 30°). Planetary longitudes are still exact (computed at local noon,
  // the minimum-error point of the day). No fabricated Ascendant is reported.
  if (input.timeUnknown) {
    const sunLon = normalizeDeg(
      (bodies.find((b) => b.name === "Sun") as BodyPosition).longitude,
    );
    cusps12 = Array.from({ length: 12 }, (_, i) => normalizeDeg(sunLon + i * 30));
    ascendant = sunLon;
    midheaven = normalizeDeg(sunLon + 270);
    vertex = normalizeDeg(sunLon + 180);
  }

  // Part of Fortune (day formula: ASC + Moon - Sun; night formula flips Moon/Sun).
  const sun = bodies.find((b) => b.name === "Sun")!;
  const moon = bodies.find((b) => b.name === "Moon")!;
  // Determine day birth: Sun above horizon (houses 7..12)
  const sunHouse = houseOf(sun.longitude, cusps12);
  const isDay = sunHouse >= 7;
  const pof = normalizeDeg(
    isDay
      ? ascendant + moon.longitude - sun.longitude
      : ascendant + sun.longitude - moon.longitude,
  );

  // Add ASC, MC, Vertex, Part of Fortune as bodies (no speed)
  for (const [name, lon] of [
    ["Ascendant", ascendant],
    ["Midheaven", midheaven],
    ["Vertex", vertex],
    ["Part of Fortune", pof],
  ] as Array<[BodyName, number]>) {
    const { sign, degree } = signFromLongitude(lon);
    bodies.push({
      name, longitude: lon, latitude: 0, distance: 0, speed: 0,
      sign, signDegree: degree, retrograde: false,
    });
  }

  // Assign houses to every body
  for (const b of bodies) {
    b.house = houseOf(b.longitude, cusps12);
  }

  const aspects = calculateAspects(bodies);

  let version = "unknown";
  try { version = swe.version(); } catch { /* ignore */ }

  return {
    input,
    julianDayUT: jd,
    utcIso,
    bodies,
    houses: cusps12,
    ascendant, midheaven, vertex, partOfFortune: pof,
    aspects,
    engine: {
      name: "Swiss Ephemeris (WASM)",
      version,
      flagsUsed: FLAGS,
      houseSystem: input.timeUnknown ? "Solar Sign (birth time unknown)" : "Placidus",
      zodiac: "Tropical",
      calculatedAt: new Date().toISOString(),
    },
  };
}