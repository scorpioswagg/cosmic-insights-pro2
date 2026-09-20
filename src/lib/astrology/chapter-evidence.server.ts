import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type { ReportDefinition } from "./reports-catalog";
import {
  computeSynastry,
  type SerialChart,
  type SynastryResult,
} from "./synastry";
import { natalEvidence, synastryEvidence } from "./evidence";

/** Minimal chart shape shared with generate-report-core. */
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

function toSerial(c: ReportChartInput): SerialChart {
  return {
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
  };
}

/** Chapter-by-chapter Unfiltered / long-form generation with evidence packets. */
export async function generateChapterEvidenceReport(opts: {
  def: ReportDefinition;
  chart: ReportChartInput;
  partnerChart?: ReportChartInput;
  system: string;
  model: LanguageModel;
}): Promise<string> {
  const { def, chart, partnerChart, system, model } = opts;
  const serialA = toSerial(chart);
  const serialB = partnerChart ? toSerial(partnerChart) : null;
  let synResult: SynastryResult | null = null;
  if (def.requiresPartner && serialB) {
    synResult = computeSynastry(serialA, serialB);
  }

  const wordsPerChapter = Math.max(140, Math.round(def.targetWords / def.sections.length));
  const chapters: string[] = [];
  let rolling = "";

  for (let i = 0; i < def.sections.length; i++) {
    const chapter = def.sections[i];
    const evidence =
      def.requiresPartner && serialB && synResult
        ? synastryEvidence(serialA, serialB, synResult, chapter)
        : natalEvidence(serialA, chapter);

    const prevNote = rolling
      ? `\nPrior chapters (continuity only — do NOT repeat):\n${rolling.slice(-2800)}\n`
      : "";

    const names =
      def.requiresPartner && partnerChart
        ? `${chart.input.name} and ${partnerChart.input.name}`
        : chart.input.name;

    const prompt = `Write CHAPTER ${i + 1} of ${def.sections.length} of **${def.title}** for ${names}.

Exact H2 heading (use this verbatim as ## heading):
${chapter}

Target length: ~${wordsPerChapter} words for this chapter only.

EVIDENCE PACKET (cite only these factors; do not invent placements):
${evidence}

${prevNote}
Rules for this chapter:
- Open with a one-line italic "Chart Anchors:" listing the placements/aspects you will use.
- Every paragraph must cite at least one factor from the evidence packet.
- Do not write other chapters. No preamble about the whole report.
- If this is the final chapter and the title implies closure, end with the line: Your chart does not give you an excuse. It gives you a mirror.
- Write in markdown. Begin with ## ${chapter}

Begin now.`;

    const result = await generateText({ model, system, prompt });
    const piece = result.text.trim();
    chapters.push(piece);
    rolling = `${rolling}\n\n${piece}`.slice(-6000);
  }

  return chapters.join("\n\n");
}
