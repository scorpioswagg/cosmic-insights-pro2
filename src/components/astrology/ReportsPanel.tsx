import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ChartCalculation } from "@/lib/astrology/types";
import { REPORTS } from "@/lib/astrology/reports-catalog";
import { generateAstroReport } from "@/lib/astrology/generate-report.functions";
import { acknowledgeAdultConsent } from "@/lib/astrology/adult-consent.functions";
import { supabase } from "@/integrations/supabase/client";
import { listPublishedReports, getIsAdmin } from "@/lib/reports/catalog.functions";
import { createReportCheckout, getMyAccess } from "@/lib/reports/checkout.functions";
import { createBundleCheckout } from "@/lib/reports/bundle-checkout.functions";
import { GIFT_BUNDLES, bundlePricing } from "@/lib/reports/bundles";
import { formatPrice } from "@/lib/reports/pricing";
import { downloadLuxuryReportPdf } from "@/lib/astrology/luxury-pdf";

interface GeneratedReport {
  reportId: string;
  title: string;
  markdown: string;
  generatedAt: string;
}

export function ReportsPanel({
  chart,
  partnerChart = null,
}: {
  chart: ChartCalculation;
  partnerChart?: ChartCalculation | null;
}) {
  const runReport = useServerFn(generateAstroReport);
  const runAckAdult = useServerFn(acknowledgeAdultConsent);
  const fetchCatalog = useServerFn(listPublishedReports);
  const fetchIsAdmin = useServerFn(getIsAdmin);
  const fetchAccess = useServerFn(getMyAccess);
  const startCheckout = useServerFn(createReportCheckout);
  const startBundleCheckout = useServerFn(createBundleCheckout);

  const { data: catalog } = useQuery({
    queryKey: ["published-report-products"],
    queryFn: () => fetchCatalog(),
  });
  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
    retry: false,
  });
  const isAdmin = !!adminInfo?.isAdmin;

  const { data: accessInfo } = useQuery({
    queryKey: ["my-report-access"],
    queryFn: () => fetchAccess(),
    retry: false,
  });
  const unlockedIds = new Set(accessInfo?.unlocked ?? []);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchasingBundleId, setPurchasingBundleId] = useState<string | null>(null);
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, GeneratedReport>>({});
  const [error, setError] = useState<string | null>(null);
  const [adultUnlocked, setAdultUnlocked] = useState(false);
  const [bulk, setBulk] = useState<{
    label: string;
    current: number;
    total: number;
    currentTitle: string;
    failures: { title: string; message: string }[];
  } | null>(null);
  const isBulkRunning = bulk !== null;

  const [genPct, setGenPct] = useState(0);
  useEffect(() => {
    if (!loadingId) {
      setGenPct(0);
      return;
    }
    const started = Date.now();
    setGenPct(3);
    const t = setInterval(() => {
      const secs = (Date.now() - started) / 1000;
      const ratio = 1 - Math.exp(-secs / 55);
      const next = Math.round(95 * ratio);
      setGenPct(Math.min(95, next));
    }, 500);
    return () => clearInterval(t);
  }, [loadingId]);

  function toChartPayload(c: ChartCalculation) {
    return {
      input: {
        name: c.input.name,
        date: c.input.date,
        time: c.input.time,
        place: c.input.place,
        latitude: c.input.latitude,
        longitude: c.input.longitude,
        timezone: c.input.timezone,
        timeUnknown: c.input.timeUnknown ?? false,
      },
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
      aspects: c.aspects.slice(0, 80).map((a) => ({
        a: a.a, b: a.b, type: a.type, angle: a.angle, orb: a.orb, applying: a.applying,
      })),
    };
  }

  async function generate(reportId: string) {
    setError(null);
    const def = REPORTS.find((r) => r.id === reportId);
    if (def?.adult && !adultUnlocked) {
      const ok = typeof window !== "undefined" &&
        window.confirm(
          "This is an 18+ Intimacy report with explicit sexual content. Confirm you are 18 or older and want to proceed."
        );
      if (!ok) return;
      try { await runAckAdult({}); } catch (e) {
        setError((e as Error).message || "Could not record adult consent.");
        return;
      }
      setAdultUnlocked(true);
    }
    setActiveId(reportId);
    if (reports[reportId]) return;
    setLoadingId(reportId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session || sessionData.session.user.is_anonymous) {
        throw new Error("Please sign in with Google to generate reports.");
      }
      if (def?.requiresPartner && !partnerChart) {
        throw new Error(
          "This synastry report needs a second (partner) chart. Use the Partner Chart form above, then try again.",
        );
      }
      const chartPayload = toChartPayload(chart);
      const partnerPayload = partnerChart ? toChartPayload(partnerChart) : undefined;
      const result = await runReport({
        data: { reportId, chart: chartPayload, partnerChart: partnerPayload },
      });
      setReports((prev) => ({ ...prev, [reportId]: result }));
      setGenPct(100);
      requestAnimationFrame(() => {
        document.getElementById(`report-${reportId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      toast.success(`${def?.title ?? "Report"} ready`);
    } catch (e) {
      const msg = (e as Error).message || "Report generation failed.";
      if (msg.includes("REPORT_LOCKED") || msg.includes("Purchase required")) {
        setError("This report is locked. Unlock it with Stripe, or sign in as an admin to generate free.");
      } else if (msg.includes("sign in") || msg.includes("Unauthorized")) {
        setError("Please sign in with Google to generate reports.");
      } else if (msg.includes("Invalid chart data")) {
        setError(msg + " Try recalculating your chart, then generate again.");
      } else if (msg.includes("LOVABLE") || msg.includes("AI key")) {
        setError("Report AI is not configured. Set LOVABLE_API_KEY in the project environment.");
      } else {
        setError(msg);
      }
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally {
      setLoadingId(null);
    }
  }

  const priceById = new Map((catalog ?? []).map((p) => [p.id, p]));
  const visible = catalog && catalog.length > 0
    ? REPORTS.filter((r) => priceById.has(r.id))
    : REPORTS;

  const grouped = visible.reduce<Record<string, typeof REPORTS>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  const active = activeId ? reports[activeId] : null;

  function downloadReport(r: GeneratedReport) {
    const safe = r.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const content = `# ${r.title}\n\nFor ${chart.input.name}\nGenerated ${new Date(r.generatedAt).toLocaleString()}\n\n---\n\n${r.markdown}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}-${chart.input.name.replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadReportPdf(r: GeneratedReport) {
    downloadLuxuryReportPdf(r, chart, partnerChart);
  }

  function isUnlocked(id: string): boolean {
    if (isAdmin) return true;
    if (unlockedIds.has(id)) return true;
    const p = priceById.get(id);
    if (!p) return true;
    if (p.is_free || p.price_cents <= 0) return true;
    return false;
  }

  function priceLabel(id: string): string | null {
    if (isAdmin) return "Included";
    const p = priceById.get(id);
    if (!p) return null;
    if (p.is_free) return "Free";
    return formatPrice(p.price_cents);
  }

  function statusLabel(id: string): string {
    if (isAdmin) return "🆓 Included";
    const p = priceById.get(id);
    if (p && (p.is_free || p.price_cents <= 0)) return "🆓 Free";
    return isUnlocked(id) ? "🔓 Unlocked" : "🔒 Locked";
  }

  async function purchase(reportId: string) {
    setError(null);
    setPurchasingId(reportId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session || sessionData.session.user.is_anonymous) {
        throw new Error("Please sign in with Google before purchasing.");
      }
      const res = await startCheckout({ data: { reportId } });
      if (res.alreadyOwned) {
        toast.success("You already own this report.");
        return;
      }
      if (!res.url) throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(res.url);
    } catch (e) {
      const msg = (e as Error).message || "Could not start checkout.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <section className="space-y-8">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-gold mb-2">Premium Reports</p>
        <h2 className="font-display text-4xl text-gradient-gold">{visible.length} Astrological Reports</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
          Each report is generated from your real Swiss Ephemeris chart data — no templates, no guesswork.
        </p>
        {isAdmin && (
          <p className="mt-2 text-xs text-gold">Admin mode — all reports generate free.</p>
        )}
        {partnerChart ? (
          <p className="mt-3 text-xs text-gold">
            ✦ Partner chart loaded: <span className="font-medium">{partnerChart.input.name}</span> — synastry reports are ready.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Synastry (two-chart) reports require a partner chart. Scroll up to add one, then return here.
          </p>
        )}
      </div>

      {error && (
        <div className="glass rounded-xl p-4 border border-destructive/50 text-destructive text-sm">
          {error}
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{category}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((r) => {
              const unlocked = isUnlocked(r.id);
              const busy = loadingId === r.id;
              const needsPartner = !!r.requiresPartner && !partnerChart;
              return (
                <div key={r.id} className="glass rounded-xl border border-border/50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-display text-base text-gradient-gold">{r.title}</h4>
                    <span className="text-[10px] shrink-0">{statusLabel(r.id)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.tagline}</p>
                  {r.requiresPartner && (
                    <p className="text-[10px] uppercase tracking-widest text-gold/80">
                      Two-chart synastry{partnerChart ? " · ready" : " · needs partner"}
                    </p>
                  )}
                  {busy && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
                        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${genPct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Writing… {genPct}%</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {unlocked ? (
                      <button
                        type="button"
                        disabled={busy || needsPartner || isBulkRunning}
                        onClick={() => generate(r.id)}
                        className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-md bg-gold text-primary-foreground disabled:opacity-50"
                      >
                        {busy ? "Generating…" : reports[r.id] ? "View" : "Generate report"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={purchasingId === r.id}
                        onClick={() => purchase(r.id)}
                        className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-md border border-gold/50 text-gold disabled:opacity-50"
                      >
                        {purchasingId === r.id ? "Redirecting…" : `Unlock ${priceLabel(r.id) ?? ""}`}
                      </button>
                    )}
                    {reports[r.id] && (
                      <>
                        <button type="button" onClick={() => downloadReport(reports[r.id])} className="text-xs text-muted-foreground hover:text-gold">MD</button>
                        <button type="button" onClick={() => downloadReportPdf(reports[r.id])} className="text-xs text-muted-foreground hover:text-gold">PDF</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {active && (
        <article id={`report-${active.reportId}`} className="glass rounded-2xl p-6 shadow-deep prose prose-invert max-w-none">
          <h3 className="font-display text-2xl text-gradient-gold">{active.title}</h3>
          <ReactMarkdown>{active.markdown}</ReactMarkdown>
        </article>
      )}
    </section>
  );
}
