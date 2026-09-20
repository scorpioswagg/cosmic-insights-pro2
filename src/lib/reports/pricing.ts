import type { ReportDefinition } from "@/lib/astrology/reports-catalog";

/**
 * Default list price for a report, in cents.
 * Tiered by category and depth (target length) so long-form flagship
 * readers price above short focused ones.
 */
export function defaultPriceCents(def: Pick<ReportDefinition, "category" | "targetWords">): number {
  if (def.category === "Unfiltered Series") return 9900;
  if (def.category === "Oracle Vault") return 8900;
  if (def.category === "Frontier Series") return 7900;
  if (def.category === "Signature Series") return def.targetWords >= 3200 ? 6900 : 5900;
  if (def.category === "Patriotic Collection") return 4900;
  if (def.category === "Intimacy (18+)") return 2900;
  if (def.targetWords >= 1700) return 3900;
  if (def.targetWords >= 1400) return 2900;
  if (def.targetWords >= 1200) return 1900;
  return 1400;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}