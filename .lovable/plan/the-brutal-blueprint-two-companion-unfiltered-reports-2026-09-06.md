# The Brutal Blueprint™ + two companion "unfiltered" reports

Add a new premium collection of three radically honest, long-form reports built on the same 31-chapter structure, tone rules, and safety guardrails you specified.

## The three reports

1. **The Brutal Blueprint™** — "The astrology report that tells you what everyone else is too afraid to say."
   Personality, contradictions, blind spots, shadow traits, relationship red flags, self-sabotage, accountability, and the redemption path. All 31 chapters exactly as written in your brief.

2. **The Unspoken Contract™** — "The brutally honest truth about how you actually love people."
   Same concept and layout, aimed at relationships: what you promise versus what you deliver, the deals you make without saying them out loud, how you behave when you want someone, when you're bored, when you're hurt, how you exit, what partners are afraid to tell you, and what mature partnership looks like for this chart.

3. **The Ambition Autopsy™** — "Why you haven't gotten where you said you'd be."
   Same concept and layout, aimed at drive, money, work, status, and self-image: the gap between stated goals and actual behavior, procrastination and perfectionism as defenses, entitlement versus confidence, money avoidance, envy and comparison, quitting patterns, and the mature path to real output.

Each gets its own 31 chapters, feature list, tagline, and SEO title/description/keywords in the same style.

## Tone and safety rules (applied to all three)

- Brutally honest, specific, provocative — never cruel for entertainment.
- Every difficult claim traced to real calculated chart evidence: placement, sign, degree, house, aspect.
- Each major pattern follows the same seven-step treatment: chart signature → traditional symbolism → healthy expression → shadow expression → interpersonal consequence → the uncomfortable question → the mature path.
- Hedged language only ("this may suggest", "under pressure this can become", "others may experience this as").
- Hard prohibitions: no diagnoses, no claims of abuse or criminality, no "you are a narcissist/dangerous/will cheat", no invented birth data, memories, or history, no presenting astrology as scientific fact.
- Each report ends with a concise "Brutal Truths" verdict and a transformation-oriented close.

## Length and price

Longest in the library: roughly 4,800–5,200 words each across 31 chapters, delivered as luxury PDFs like the rest of the catalog.
New "Unfiltered Series" tier priced at **$99** per report, sitting above Oracle Vault ($89).

## Where they show up

- Listed under a new **Unfiltered Series** category in the report library, with the same paywall, purchase, generation, download, and email flow every other paid report uses.
- Included in your admin catalog so you can edit price and visibility, and free for admin accounts.
- Not marked 18+, since the content is psychological rather than sexual.

## Technical notes

- `src/lib/astrology/reports-catalog.ts`: add `"Unfiltered Series"` to the category union and append the three `ReportDefinition` entries (31 `sections` each, `targetWords` ~5000, custom `systemFraming` carrying the full prompt module and guardrails).
- `src/lib/reports/pricing.ts`: `defaultPriceCents` returns `9900` for `Unfiltered Series`.
- `src/lib/astrology/generate-report-core.server.ts`: verify the per-report `systemFraming` and chapter-binding rules carry through unchanged; no structural change expected.
- No database migration needed — `access.server.ts` self-seeds new catalog reports into `report_products` on first access; admin "Sync from code catalog" also picks them up.
- Optionally regenerate the downloadable catalog CSV so the three new products can be imported into Stripe.

## Open item

The 31 chapters are long; generation will take noticeably longer than existing reports and may need the report to be produced in two passes to avoid truncation. I'll build in continuation handling so a full report always completes.
