import { jsPDF } from "jspdf";
import type { ChartCalculation } from "./types";

export interface GeneratedReport {
  reportId: string;
  title: string;
  markdown: string;
  generatedAt: string;
}

const GOLD: [number, number, number] = [176, 141, 66];
const GOLD_SOFT: [number, number, number] = [212, 175, 96];
const INK: [number, number, number] = [28, 28, 46];
const BODY: [number, number, number] = [46, 46, 66];
const MUTED: [number, number, number] = [120, 120, 140];
const MIDNIGHT: [number, number, number] = [14, 16, 42];

function fmtDeg(d: number) {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}\u00B0${String(min).padStart(2, "0")}'`;
}

function buildLuxuryReportDoc(
  report: GeneratedReport,
  chart: ChartCalculation,
  partnerChart?: ChartCalculation | null,
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 64;
  const maxW = pageW - margin * 2;
  let y = margin;
  let chapterIndex = 0;

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const newPage = () => { doc.addPage(); y = margin; };
  const ensureSpace = (needed: number) => { if (y + needed > pageH - margin - 24) newPage(); };

  const writeText = (
    text: string,
    size: number,
    opts: { bold?: boolean; italic?: boolean; color?: [number, number, number]; gap?: number; align?: "left" | "center" | "right"; x?: number; maxWidth?: number } = {},
  ) => {
    const style = opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal";
    doc.setFont("times", style);
    doc.setFontSize(size);
    setColor(opts.color ?? BODY);
    const w = opts.maxWidth ?? maxW;
    const lines = doc.splitTextToSize(text, w) as string[];
    const lh = size * 1.4;
    for (const ln of lines) {
      ensureSpace(lh);
      const x = opts.align === "center" ? pageW / 2 : opts.align === "right" ? pageW - margin : opts.x ?? margin;
      doc.text(ln, x, y, { align: opts.align ?? "left" });
      y += lh;
    }
    y += opts.gap ?? 4;
  };

  const hr = (color: [number, number, number] = GOLD_SOFT, thickness = 0.6) => {
    ensureSpace(12);
    setDraw(color);
    doc.setLineWidth(thickness);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  const calloutBox = (label: string, body: string) => {
    const padding = 10;
    const bodyLines = doc.splitTextToSize(body, maxW - padding * 2) as string[];
    const labelLines = doc.splitTextToSize(label.toUpperCase(), maxW - padding * 2) as string[];
    const boxH = padding * 2 + labelLines.length * 12 + 6 + bodyLines.length * 14;
    ensureSpace(boxH + 8);
    setFill([250, 246, 232]);
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, maxW, boxH, 6, 6, "FD");
    setFill(GOLD);
    doc.rect(margin, y, 3, boxH, "F");
    const startY = y;
    y += padding + 10;
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    setColor(GOLD);
    for (const ln of labelLines) { doc.text(ln, margin + padding + 6, y); y += 12; }
    y += 4;
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    setColor(INK);
    for (const ln of bodyLines) { doc.text(ln, margin + padding + 6, y); y += 14; }
    y = startY + boxH + 10;
  };

  const writeNatalSnapshot = (c: ChartCalculation, title: string) => {
    writeText(title, 22, { bold: true, color: GOLD, gap: 6 });
    hr();
    writeText("Every insight in this reading is drawn from the exact placements below. Nothing is invented.", 10, { italic: true, color: MUTED, gap: 12 });
    writeText("Birth Data", 13, { bold: true, color: INK, gap: 4 });
    writeText(`Name: ${c.input.name}`, 11);
    writeText(`Date & Time: ${c.input.date} at ${c.input.time}`, 11);
    writeText(`Location: ${c.input.place}`, 11);
    writeText(`Timezone: ${c.input.timezone}`, 11, { gap: 12 });
    writeText("Angles", 13, { bold: true, color: INK, gap: 4 });
    writeText(`Ascendant: ${c.ascendant.toFixed(2)}\u00B0`, 11);
    writeText(`Midheaven: ${c.midheaven.toFixed(2)}\u00B0`, 11, { gap: 12 });
    writeText("Planets & Points", 13, { bold: true, color: INK, gap: 6 });
    for (const b of c.bodies) {
      const house = b.house ? ` \u00B7 House ${b.house}` : "";
      const retro = b.retrograde ? " \u211E" : "";
      writeText(`${b.name.padEnd(12, " ")}  ${b.sign} ${fmtDeg(b.signDegree)}${house}${retro}`, 10.5, { color: BODY, gap: 1 });
    }
  };

  // COVER
  setFill(MIDNIGHT);
  doc.rect(0, 0, pageW, pageH, "F");
  setDraw(GOLD);
  doc.setLineWidth(1.2);
  doc.line(margin, margin, pageW - margin, margin);
  doc.line(margin, pageH - margin, pageW - margin, pageH - margin);
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  setColor(GOLD_SOFT);
  doc.text("THE COSMIC BLUEPRINT\u2122", pageW / 2, pageH / 2 - 120, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(18);
  setColor(GOLD);
  doc.text("\u2726  \u2727  \u2726", pageW / 2, pageH / 2 - 90, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(32);
  setColor([245, 232, 196]);
  const titleLines = doc.splitTextToSize(report.title, maxW - 40) as string[];
  let ty = pageH / 2 - 40;
  for (const ln of titleLines) { doc.text(ln, pageW / 2, ty, { align: "center" }); ty += 38; }
  doc.setFont("times", "italic");
  doc.setFontSize(13);
  setColor(GOLD_SOFT);
  doc.text(partnerChart ? "A personalized synastry reading" : "A personalized natal reading", pageW / 2, ty + 14, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  setColor([230, 220, 200]);
  doc.text("Prepared exclusively for", pageW / 2, pageH - 220, { align: "center" });
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  setColor([245, 232, 196]);
  const names = partnerChart ? `${chart.input.name}  &  ${partnerChart.input.name}` : chart.input.name;
  const nameLines = doc.splitTextToSize(names, maxW - 40) as string[];
  let ny = pageH - 195;
  for (const ln of nameLines) { doc.text(ln, pageW / 2, ny, { align: "center" }); ny += 22; }
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  setColor(GOLD_SOFT);
  doc.text(`${chart.input.date} \u00B7 ${chart.input.time} \u00B7 ${chart.input.place}`, pageW / 2, pageH - 155, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  setColor([180, 170, 150]);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, pageW / 2, pageH - margin - 20, { align: "center" });

  // FOUNDER LETTER
  newPage();
  writeText("A Personal Welcome", 10, { italic: true, color: GOLD, align: "center", gap: 4 });
  writeText("Letter from the Founder", 22, { bold: true, color: GOLD, align: "center", gap: 8 });
  hr();
  writeText("First, thank you.", 12, { gap: 8 });
  writeText("Thank you for becoming part of The Cosmic Blueprint community. Whether you've just created your free account or invested in one of our premium reports, I truly appreciate the trust you've placed in this project.", 11, { gap: 8 });
  writeText("For thousands of years, people across nearly every civilization have looked toward the heavens searching for meaning. Long before modern science, our ancestors noticed that the movements of the Sun, Moon, and planets seemed to coincide with the rhythms of life here on Earth. Over centuries, those observations evolved into the rich system we now know as astrology—not as a tool to predict every event with certainty, but as a language for understanding ourselves, our relationships, our strengths, our challenges, and the opportunities that shape our journey.", 11, { gap: 8 });
  writeText("Today, we have something our ancestors never imagined: the ability to combine centuries of astrological wisdom with modern technology. That's exactly why I created The Cosmic Blueprint.", 11, { gap: 8 });
  writeText("These reports are designed to go far beyond generic horoscope descriptions. They are personalized specifically for your unique birth chart, offering insights into your personality, your relationships, your purpose, your life cycles, your hidden gifts, and the lessons that can help you grow into the very best version of yourself.", 11, { gap: 8 });
  writeText("I encourage you to return to your reports often. As life changes, you'll discover that different sections begin to speak to you in new ways. What may seem insignificant today could become one of your greatest sources of clarity months or even years from now.", 11, { gap: 8 });
  writeText("Remember, astrology doesn't replace your free will—it empowers it.", 11, { gap: 6 });
  writeText("The stars may reveal possibilities, but your choices create your future.", 11, { italic: true, color: INK, gap: 8 });
  writeText("No matter where you are in life right now, you possess incredible potential waiting to be awakened. Every challenge can become wisdom. Every ending creates the space for a new beginning. Every chapter of your story has meaning.", 11, { gap: 8 });
  writeText("I sincerely hope these reports inspire you, encourage you, and help you discover something extraordinary about yourself.", 11, { gap: 8 });
  writeText("Thank you again for allowing me to be a small part of your journey.", 11, { gap: 6 });
  writeText("May your path be filled with purpose, confidence, growth, and endless possibilities.", 11, { gap: 6 });
  writeText("The universe has always been speaking.", 11, { italic: true, color: GOLD, gap: 2 });
  writeText("Now it's your turn to listen.", 11, { italic: true, color: GOLD, gap: 12 });
  writeText("With gratitude,", 11, { gap: 4 });
  writeText("Kyle Merritt", 16, { bold: true, color: GOLD, gap: 2 });
  writeText("Founder, The Cosmic Blueprint", 10, { color: MUTED, gap: 12 });
  writeText('"Every chart tells a story. Thank you for allowing The Cosmic Blueprint to help you discover yours."', 11, { italic: true, color: GOLD, align: "center", gap: 8 });

  // DEDICATION
  newPage();
  y = pageH / 2 - 60;
  writeText("For you \u2014", 14, { italic: true, color: MUTED, align: "center", gap: 12 });
  y += 10;
  writeText("May this reading meet you exactly where you are, and remind you of what you already carry.", 13, { italic: true, color: INK, align: "center", gap: 20, maxWidth: maxW - 80 });
  y += 10;
  writeText("\u2726", 18, { color: GOLD, align: "center" });

  // NATAL SNAPSHOT(S)
  newPage();
  writeNatalSnapshot(chart, partnerChart ? "Natal Snapshot — Person A" : "Your Natal Snapshot");
  if (partnerChart) {
    newPage();
    writeNatalSnapshot(partnerChart, "Natal Snapshot — Person B");
  }

  // TOC
  const chapterTitles: string[] = [];
  for (const raw of report.markdown.split("\n")) {
    if (raw.startsWith("## ")) {
      const t = raw.slice(3).trim();
      if (t === "Letter from the Founder" || t === "Your Natal Chart" || t === "Natal Charts" || t.startsWith("Natal Snapshot")) continue;
      chapterTitles.push(t);
    }
  }
  newPage();
  writeText("Table of Contents", 22, { bold: true, color: GOLD, gap: 6 });
  hr();
  y += 6;
  chapterTitles.forEach((t, i) => {
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    setColor(INK);
    const num = String(i + 1).padStart(2, "0");
    const label = `${num}   ${t}`;
    ensureSpace(20);
    doc.text(label, margin, y);
    setDraw([200, 190, 170]);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(margin + doc.getTextWidth(label) + 8, y - 3, pageW - margin - 20, y - 3);
    doc.setLineDashPattern([], 0);
    y += 20;
  });

  // BODY
  newPage();
  const lines = report.markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, "");
    const line = raw.trimEnd();
    if (!line.trim()) { y += 6; continue; }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      if (title === "Letter from the Founder" || title === "Your Natal Chart" || title === "Natal Charts" || title.startsWith("Natal Snapshot")) {
        while (i + 1 < lines.length && !lines[i + 1].startsWith("## ")) i += 1;
        continue;
      }
      chapterIndex += 1;
      newPage();
      writeText(`Chapter ${String(chapterIndex).padStart(2, "0")}`, 10, { italic: true, color: GOLD, align: "center", gap: 4 });
      writeText("\u2726", 14, { color: GOLD_SOFT, align: "center", gap: 8 });
      writeText(title, 22, { bold: true, color: INK, align: "center", gap: 10 });
      hr();
      continue;
    }
    if (line.startsWith("### ")) { y += 6; writeText(line.slice(4), 14, { bold: true, color: GOLD, gap: 6 }); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const clean = line.replace(/^\s*[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
      writeText(`\u2022  ${clean}`, 11, { color: BODY, gap: 2 });
      continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [line.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].startsWith("> ")) { i += 1; buf.push(lines[i].slice(2)); }
      calloutBox("Reflection", buf.join(" ").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1"));
      continue;
    }
    const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    writeText(clean, 11, { color: BODY });
  }

  y += 20;
  ensureSpace(60);
  writeText("\u2726  \u2727  \u2726", 16, { color: GOLD, align: "center", gap: 8 });
  writeText("End of reading", 10, { italic: true, color: MUTED, align: "center" });

  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text(report.title, margin, pageH - 28);
    doc.text(`${p} of ${total}`, pageW - margin, pageH - 28, { align: "right" });
    setDraw(GOLD_SOFT);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 38, pageW - margin, pageH - 38);
  }
  return doc;
}

export function downloadLuxuryReportPdf(
  report: GeneratedReport,
  chart: ChartCalculation,
  partnerChart?: ChartCalculation | null,
) {
  const doc = buildLuxuryReportDoc(report, chart, partnerChart);
  const safe = report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const namePart = partnerChart
    ? `${chart.input.name}-${partnerChart.input.name}`.replace(/\s+/g, "-")
    : chart.input.name.replace(/\s+/g, "-");
  doc.save(`${safe}-${namePart}.pdf`);
}

export function buildLuxuryReportPdfBytes(
  report: GeneratedReport,
  chart: ChartCalculation,
  partnerChart?: ChartCalculation | null,
): Uint8Array {
  const doc = buildLuxuryReportDoc(report, chart, partnerChart);
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
