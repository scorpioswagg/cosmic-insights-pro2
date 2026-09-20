import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { REPORTS } from "@/lib/astrology/reports-catalog";
import { defaultPriceCents } from "./pricing";

export interface ReportProduct {
  id: string;
  title: string;
  tagline: string;
  category: string;
  icon: string;
  adult: boolean;
  price_cents: number;
  is_free: boolean;
  is_published: boolean;
  sort_order: number;
}

const SELECT_COLS =
  "id, title, tagline, category, icon, adult, price_cents, is_free, is_published, sort_order";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/** Published catalog — safe for anonymous visitors. */
export const listPublishedReports = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("report_products")
    .select(SELECT_COLS)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportProduct[];
});

async function assertAdmin(context: { userId: string }) {
  const { isAdminUser } = await import("@/lib/reports/access.server");
  if (!(await isAdminUser(context.userId))) throw new Error("Forbidden");
}

/** Whether the signed-in caller is an admin (admins get every report free). */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isAdminUser } = await import("@/lib/reports/access.server");
    return { isAdmin: await isAdminUser(context.userId) };
  });

/** Full catalog including unpublished rows. Admin only. */
export const listAllReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("report_products")
      .select(SELECT_COLS)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ReportProduct[];
  });

/**
 * Upserts every report in the code catalog into the database.
 * - New rows: default price, published.
 * - Existing rows: refresh presentation fields.
 * - Unfiltered Series rows: force $99 and published so the 18/20 ship together.
 */
export const syncReportCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);

    const { data: existing, error: readErr } = await context.supabase
      .from("report_products")
      .select("id");
    if (readErr) throw new Error(readErr.message);
    const known = new Set((existing ?? []).map((r) => r.id));

    const inserts = REPORTS.filter((r) => !known.has(r.id)).map((r) => ({
      id: r.id,
      title: r.title,
      tagline: r.tagline,
      category: r.category,
      icon: r.icon,
      adult: !!r.adult,
      price_cents: defaultPriceCents(r),
      is_free: false,
      is_published: true,
      sort_order: Math.max(0, REPORTS.findIndex((x) => x.id === r.id)),
      slug: r.id,
    }));

    if (inserts.length > 0) {
      const { error } = await context.supabase.from("report_products").insert(inserts);
      if (error) throw new Error(error.message);
    }

    let updated = 0;
    for (const r of REPORTS) {
      const patch: Record<string, unknown> = {
        title: r.title,
        tagline: r.tagline,
        category: r.category,
        icon: r.icon,
        adult: !!r.adult,
      };
      if (r.category === "Unfiltered Series") {
        patch.price_cents = 9900;
        patch.is_free = false;
        patch.is_published = true;
      }
      const { error } = await context.supabase
        .from("report_products")
        .update(patch)
        .eq("id", r.id);
      if (error) throw new Error(error.message);
      updated += 1;
    }

    return { inserted: inserts.length, updated, total: REPORTS.length };
  });

/** Export catalog rows as a Stripe-ready CSV (admin). */
export const exportStripeCatalogCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ unfilteredOnly: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const unfilteredOnly = !!data?.unfilteredOnly;

    const { data: rows, error } = await context.supabase
      .from("report_products")
      .select(
        "id, title, tagline, category, price_cents, currency, is_free, is_published, stripe_product_id, stripe_price_id",
      )
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const filtered = (rows ?? []).filter((r) =>
      unfilteredOnly ? r.category === "Unfiltered Series" : true,
    );

    const esc = (s: string | null | undefined) => {
      const v = (s ?? "").replace(/"/g, '""');
      return `"${v}"`;
    };

    const header = [
      "report_id",
      "name",
      "description",
      "category",
      "price_usd",
      "price_cents",
      "currency",
      "is_free",
      "is_published",
      "stripe_product_id",
      "stripe_price_id",
    ].join(",");

    const lines = filtered.map((r) =>
      [
        esc(r.id),
        esc(r.title),
        esc(r.tagline),
        esc(r.category),
        (r.price_cents / 100).toFixed(2),
        String(r.price_cents),
        esc(r.currency ?? "usd"),
        r.is_free ? "true" : "false",
        r.is_published ? "true" : "false",
        esc(r.stripe_product_id),
        esc(r.stripe_price_id),
      ].join(","),
    );

    return {
      filename: unfilteredOnly
        ? "cosmic-blueprint-unfiltered-stripe-catalog.csv"
        : "cosmic-blueprint-stripe-catalog.csv",
      csv: [header, ...lines].join("\n") + "\n",
      count: filtered.length,
    };
  });

const UpdateSchema = z.object({
  id: z.string().min(1).max(64),
  price_cents: z.number().int().min(0).max(100000).optional(),
  is_free: z.boolean().optional(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
});

export const updateReportProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { id, ...patch } = data;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("report_products")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
