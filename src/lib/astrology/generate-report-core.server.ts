import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { REPORTS } from "./reports-catalog";
import { computeSynastry, synastryToPrompt, type SerialChart } from "./synastry";
import { generateChapterEvidenceReport } from "./chapter-evidence.server";

// Minimal chart shape needed for report generation (subset of ChartCalculation).
export interface ReportChartInput {
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
    angle?: number;
    orb: number;
    applying: boolean;
  }>;
}

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

function chartToPrompt(chart: ReportChartInput, label = "") {
  const prefix = label ? `${label} ` : "";
  const bodies = chart.bodies
    .map((b) =>
      `- ${b.name}: ${b.sign} ${fmtDeg(b.signDegree)}${
        b.house ? ` (House ${b.house})` : ""
      }${b.retrograde ? " ℞" : ""}`,
    )
    .join("\n");
  const houses = chart.houses
    .map((cusp, i) => `  H${i + 1}: ${fmtDeg(cusp % 30)} (${cusp.toFixed(2)}°)`) 
    .join("\n");
  const aspects = chart.aspects
    .slice(0, 40)
    .map((a) => `- ${a.a} ${a.type} ${a.b} (orb ${a.orb.toFixed(2)}°, ${a.applying ? "applying" : "separating"})`)
    .join("\n");
  return `${prefix}BIRTH:\n- Name: ${chart.input.name}\n- Date/Time: ${chart.input.date} ${
    chart.input.timeUnknown
      ? "TIME UNKNOWN (calculated at local noon)"
      : chart.input.time
  } (${chart.input.timezone})\n- Place: ${chart.input.place} (${chart.input.latitude.toFixed(4)}, ${chart.input.longitude.toFixed(4)})\n- UTC: ${chart.utcIso}  JD(UT): ${chart.julianDayUT.toFixed(5)}\n\n${prefix}PLACEMENTS:\n${bodies}\n\n${prefix}ANGLES:\n- Ascendant: ${chart.ascendant.toFixed(4)}°\n- Midheaven: ${chart.midheaven.toFixed(4)}°\n\n${prefix}HOUSE CUSPS (Placidus):\n${houses}\n${
  chart.input.timeUnknown
    ? `\nBIRTH TIME STATUS: UNKNOWN.\n- Houses above are SOLAR-SIGN houses (the Sun's exact degree begins House 1). They are NOT Placidus cusps.\n- The reported \"Ascendant\" equals the Sun's degree and is a frame marker, not a real rising sign.\n- The Moon's degree may vary by up to ~13° across the birth day; its SIGN is reliable only if far from a cusp.\n`
    : ""
}\n\n${prefix}ASPECTS (top 40 by tightness):\n${aspects}`;
}

/** Founder letter included in every report from now on. */
export const FOUNDER_LETTER = `## Letter from the Founder\n\nFirst, thank you.\n\nThank you for becoming part of *The Cosmic Blueprint* community. Whether you've just created your free account or invested in one of our premium reports, I truly appreciate the trust you've placed in this project.\n\nFor thousands of years, people across nearly every civilization have looked toward the heavens searching for meaning. Long before modern science, our ancestors noticed that the movements of the Sun, Moon, and planets seemed to coincide with the rhythms of life here on Earth. Over centuries, those observations evolved into the rich system we now know as astrology—not as a tool to predict every event with certainty, but as a language for understanding ourselves, our relationships, our strengths, our challenges, and the opportunities that shape our journey.\n\nToday, we have something our ancestors never imagined: the ability to combine centuries of astrological wisdom with modern technology. That's exactly why I created The Cosmic Blueprint.\n\nThese reports are designed to go far beyond generic horoscope descriptions. They are personalized specifically for your unique birth chart, offering insights into your personality, your relationships, your purpose, your life cycles, your hidden gifts, and the lessons that can help you grow into the very best version of yourself.\n\nI encourage you to return to your reports often. As life changes, you'll discover that different sections begin to speak to you in new ways. What may seem insignificant today could become one of your greatest sources of clarity months or even years from now.\n\nRemember, astrology doesn't replace your free will—it empowers it.\n\nThe stars may reveal possibilities, but your choices create your future.\n\nNo matter where you are in life right now, you possess incredible potential waiting to be awakened. Every challenge can become wisdom. Every ending creates the space for a new beginning. Every chapter of your story has meaning.\n\nI sincerely hope these reports inspire you, encourage you, and help you discover something extraordinary about yourself.\n\nThank you again for allowing me to be a small part of your journey.\n\nMay your path be filled with purpose, confidence, growth, and endless possibilities.\n\nThe universe has always been speaking.\n\nNow it's your turn to listen.\n\nWith gratitude,\n\n**Kyle Merritt**  \nFounder, The Cosmic Blueprint\n\n> \"Every chart tells a story. Thank you for allowing The Cosmic Blueprint to help you discover yours.\"\n`;

export interface GeneratedReportPayload {
  reportId: string;
  title: string;
  markdown: string;
  generatedAt: string;
}

export async function generateReportMarkdown(input: {
  reportId: string;
  chart: ReportChartInput;
  partnerChart?: ReportChartInput;
}): Promise<GeneratedReportPayload> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const def = REPORTS.find((r) => r.id === input.reportId);
  if (!def) throw new Error(`Unknown report: ${input.reportId}`);

  if (def.requiresPartner && !input.partnerChart) {
    throw new Error(
      "This synastry report requires a second (partner) chart. Please provide birth data for both people.",
    );
  }

  const gateway = createLovableAiGatewayProvider(key);

  let chartBlock = chartToPrompt(input.chart, def.requiresPartner ? "PERSON A — " : "");
  let synastryBlock = "";

  if (def.requiresPartner && input.partnerChart) {
    chartBlock += "\n\n" + chartToPrompt(input.partnerChart, "PERSON B — ");
    const toSerial = (c: ReportChartInput): SerialChart => ({
      input: c.input,
      julianDayUT: c.julianDayUT,
      utcIso: c.utcIso,
      ascendant: c.ascendant,
      midheaven: c.midheaven,
      bodies: c.bodies.map((b) => ({
        name: b.name,
        longitude: b.longitude,
        sign: b.sign,
        signDegree: b.signDegree,
        house: b.house,
        retrograde: b.retrograde,
        speed: b.speed,
      })),
      houses: c.houses,
      aspects: c.aspects.map((a) => ({
        a: a.a,
        b: a.b,
        type: a.type,
        orb: a.orb,
        applying: a.applying,
      })),
    });
    const syn = computeSynastry(toSerial(input.chart), toSerial(input.partnerChart));
    synastryBlock =
      "\n\n" +
      synastryToPrompt(toSerial(input.chart), toSerial(input.partnerChart), syn, 50);
  }

  const system = `You are a master astrologer writing for the Cosmic Blueprint platform.\n\nABSOLUTE RULES:\n- Use ONLY the placements, houses, and aspects given. Never invent or hallucinate any position, aspect, degree, or house assignment.\n- Reference SPECIFIC placements by name (e.g., \"your Moon in Cancer in the 4th House\").\n- Tropical zodiac, Placidus houses, geocentric Western astrology.\n- Do not predict literal future events; describe patterns, energies, and choices.\n- Use markdown: H2 (##) per section, H3 (###) for subsections. No emojis.\n- Maintain a literate, grounded, modern psychological-astrology voice.\n${
  def.requiresPartner
    ? `\nSYNASTRY RULES (STRICT):\n- This is a TWO-CHART report. Distinguish Person A and Person B clearly by name.\n- Use the MUTUAL (CROSS-CHART) ASPECTS, HOUSE OVERLAYS, and DOMAIN SCORES provided.\n- Every major interpretation must cite a real mutual aspect or house overlay.\n- Never invent cross-aspects or overlays.\n`
    : ""
}\n\nCHAPTER BINDING RULES (STRICT):\n- Every chapter (## section) MUST open with a short \"Chart Anchors\" line in italics listing the exact placements and aspects from the CHART DATA that this chapter interprets.\n- Every paragraph MUST explicitly cite at least one real placement, house cusp, or aspect from the CHART DATA.\n- Never write a paragraph of generic astrology with no citation.\n- Do not paraphrase placements in ways that change the data.\n${
  input.chart.input.timeUnknown
    ? `\nUNKNOWN BIRTH TIME PROTOCOL (STRICT):\n- Open the report with a short italic note: birth time unknown, solar-sign house frame in use.\n- NEVER name a rising sign, Ascendant degree, Midheaven sign, Vertex, Part of Fortune, or a Placidus cusp as fact.\n- Interpret houses as SOLAR houses (\"your solar 7th house\") and say so.\n- If the Moon is within 6° of a sign boundary, state both possible signs and interpret the tension.\n- Deliver the full required length and depth; never shorten or hedge the whole report — only the time-dependent factors are qualified.\n`
    : ""
}\n\nREPORT FRAMING:\n${def.systemFraming}`;

  const model = gateway("google/gemini-3-flash-preview");

  const reportDef = def;
  function buildPrompt(sections: string[], opts: { partOf?: [number, number]; previous?: string }) {
    const sectionsList = sections.map((s, i) => `${i + 1}. ${s}`).join("\n");
    const partNote = opts.partOf
      ? `\nThis is PART ${opts.partOf[0]} of ${opts.partOf[1]} of a single continuous report. Write only the sections listed below — no preamble, no recap, no closing summary unless the final section calls for one.`
      : "";
    const prevNote = opts.previous
      ? `\nPreviously written sections (for continuity — do NOT repeat them):\n${opts.previous.slice(-4000)}`
      : "";
    return `Write the **${reportDef.title}** report${
      reportDef.requiresPartner
        ? ` for ${input.chart.input.name} and ${input.partnerChart!.input.name}`
        : ` for ${input.chart.input.name}`
    }.${partNote}\n\nTarget length for this part: ~${Math.round(reportDef.targetWords / (opts.partOf ? opts.partOf[1] : 1))} words.\n\nRequired sections (use exactly these as ## H2 headings, in order):\n${sectionsList}\n\nCHART DATA:\n${chartBlock}\n${synastryBlock}\n${prevNote}\n\nBegin now. Do not restate the chart data; weave it into interpretation.`;
  }

  let text: string;

  const useChapterLoop =
    def.category === "Unfiltered Series" ||
    (def.targetWords >= 4500 && def.sections.length >= 20);

  if (useChapterLoop) {
    text = await generateChapterEvidenceReport({
      def,
      chart: input.chart,
      partnerChart: input.partnerChart,
      system,
      model,
    });
  } else if (def.targetWords >= 3200 && def.sections.length > 12) {
    const mid = Math.ceil(def.sections.length / 2);
    const first = await generateText({
      model,
      system,
      prompt: buildPrompt(def.sections.slice(0, mid), { partOf: [1, 2] }),
    });
    const second = await generateText({
      model,
      system,
      prompt: buildPrompt(def.sections.slice(mid), { partOf: [2, 2], previous: first.text }),
    });
    text = `${first.text.trim()}\n\n${second.text.trim()}`;
  } else {
    const result = await generateText({ model, system, prompt: buildPrompt(def.sections, {}) });
    text = result.text;
  }

  const natalHeader = def.requiresPartner
    ? `## Natal Charts\n\nThis report is built from the exact Swiss Ephemeris charts of both people. Nothing is invented.\n`
    : `## Your Natal Chart\n\nThis report is built from your exact Swiss Ephemeris natal chart. Nothing is invented.\n`;

  const markdown = `${FOUNDER_LETTER}\n\n---\n\n${natalHeader}\n\n${text.trim()}`;

  return {
    reportId: def.id,
    title: def.title,
    markdown,
    generatedAt: new Date().toISOString(),
  };
}
