import type { ChartCalculation } from "@/lib/astrology/types";
import { KYLE_MERRITT_EXPECTED, validateChart } from "@/lib/astrology/validation";

export function ValidationBadge({ chart }: { chart: ChartCalculation }) {
  const isKyle = chart.input.name.toLowerCase().includes("kyle")
    && chart.input.date === "1984-10-25";
  if (!isKyle) return null;
  const { rows, passRate } = validateChart(chart, KYLE_MERRITT_EXPECTED);
  const pct = Math.round(passRate * 100);
  return (
    <div className="glass rounded-2xl p-6 shadow-deep">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl text-gradient-gold">Swiss Ephemeris Validation</h3>
        <span className={`text-sm font-mono ${pct === 100 ? "text-gold" : "text-destructive"}`}>
          {pct}% match
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Comparing calculated placements against the Kyle Merritt reference chart.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.body} className="flex items-center justify-between rounded-md bg-card/50 px-3 py-2 border border-border/40">
            <span className="text-muted-foreground">{r.body}</span>
            <span className={r.match ? "text-gold" : "text-destructive"}>
              {r.match ? "✓" : "✗"} {r.actual}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}