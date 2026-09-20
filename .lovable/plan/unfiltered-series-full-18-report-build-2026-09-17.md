# Unfiltered Series™ — Full 18-Report Build

Rebuild the Unfiltered Series to the exact specification: 18 reports at $99 each, 31 named chapters apiece, ~5,000 words, written chapter by chapter against real chart evidence. Seven of them are two-person reports, which need a partner-chart engine the app does not have yet.

## What you'll get

**11 solo reports** (your chart only)
The Brutal Blueprint, The Unspoken Contract, The Ambition Autopsy, The Self-Sabotage File, The Mirror You Avoid, The Shadow Ledger, The Inner Courtroom, The Pattern That Won't Die, The Identity Collapse, The Excuse Machine, The Power Bill, plus the two flagships — The Cosmic Cross-Examination and The Final Mirror (13 solo in total).

**7 two-person reports** (your chart + theirs)
The Relationship Crime Scene, The Chemistry Autopsy, The Power Struggle, The Unfinished Business, The Attraction Trap, The Things We Won't Say, The Breaking Point.

Each one uses the exact chapter list you specified, in order, and ends with five Brutal Truths and the closing line "Your chart does not give you an excuse. It gives you a mirror."

## New in the app

- A **partner birth details** panel appears when you open any two-person report: name, date, time (with the same "I don't know the time" option), and birthplace. Their chart is calculated with the same engine as yours before writing starts.
- A **live writing progress bar** ("Chapter 12 of 31") since these take a few minutes each.
- Each report page gets its own search-friendly title and description.
- Everything flows through the existing purchase and admin rules — as admin you generate and download any of the 18 free, with no per-report exceptions.

## Technical notes

1. **Catalog rewrite** — `unfiltered-series-catalog.ts` replaced: the 18 spec IDs (`brutal-blueprint`, `self-sabotage-file`, … `final-mirror`), verbatim 31-chapter arrays, taglines, icons, `targetWords: 5000`, `adult: false`. `ReportDefinition` gains `requiresPartner?: boolean`, `seoTitle`, `seoDescription`, `estimatedPages`, `readingMinutes`, `difficulty`. The three current `unfiltered-*` IDs are renamed to the spec IDs and the stale `report_products` rows are migrated (no purchases exist, so this is safe).
2. **Synastry engine** — new `src/lib/astrology/synastry.ts`: cross-chart aspects with per-pair orbs, A→B overlays resolved against B's house cusps and B→A against A's, plus domain scoring (attraction, trust, power, communication, conflict, autonomy, repair potential). Pure deterministic code, no AI.
3. **Evidence packets** — new `src/lib/astrology/evidence.ts` maps each chapter title to the planets, houses, and aspects it may cite, and builds a compact packet per chapter from the calculated chart(s). Only that packet plus a short chart summary goes into each chapter prompt, which keeps cost and hallucination down.
4. **Chapter-by-chapter generation** — `generate-report-core.server.ts` gains a per-chapter loop for Unfiltered reports (~160 words × 31), each call streaming with the shared system standard (seven-step method, hedged language, forbidden claims, contradiction hunting) plus a rolling summary of prior chapters for continuity. Chapters are assembled into one markdown document. Existing report types keep their current one/two-pass path.
5. **Server plumbing** — `generate-report.functions.ts` accepts an optional `partnerChart` and rejects a two-person report submitted without one; a new progress-reporting server function streams chapter completion to the UI. Access/entitlement, adult gating, and admin bypass stay in `access.server.ts` untouched.
6. **UI** — `ReportsPanel.tsx` gains the partner form, per-chapter progress, and a partner-required badge. PDF export reuses `luxury-pdf.ts`; the partner's details are printed on the cover of two-person reports.
7. **Validation** — a post-generation check asserts 31 unique chapter headings, presence of the Brutal Truths section and closing sentence, and no chapter left under length; failures retry that chapter once before surfacing an error.
8. **Pricing/catalog** — all 18 stay at 9,900 cents via the existing `Unfiltered Series` branch; `report_products` is re-seeded and the downloadable CSV regenerated with the 18 rows.

## Not included

Per-report artwork (the visual motif table) — the reports use the existing midnight/gold PDF identity. Say the word and I'll add custom cover art as a follow-up.
