import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(userId: string) {
  const { isAdminUser } = await import("@/lib/reports/access.server");
  if (!(await isAdminUser(userId))) throw new Error("Forbidden");
}

/** Resolve auth user display fields for a set of user ids. */
async function resolveUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userIds: string[],
) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<
    string,
    { email: string | null; name: string | null }
  >();
  // listUsers is paginated; for admin dashboards we fetch a few pages.
  let page = 1;
  const perPage = 200;
  while (unique.length > 0 && page <= 5) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    for (const u of data.users) {
      if (!unique.includes(u.id)) continue;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        (typeof meta.display_name === "string" && meta.display_name) ||
        null;
      map.set(u.id, { email: u.email ?? null, name });
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return map;
}

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: purchases, error } = await supabaseAdmin
      .from("report_purchases")
      .select(
        "id, user_id, report_id, amount_cents, currency, status, customer_email, email_sent_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const { data: products } = await supabaseAdmin
      .from("report_products")
      .select("id, title, is_free, price_cents");
    const titles = new Map((products ?? []).map((p) => [p.id, p.title]));
    const freeIds = new Set(
      (products ?? []).filter((p) => p.is_free || p.price_cents <= 0).map((p) => p.id),
    );

    const users = await resolveUsers(
      supabaseAdmin,
      (purchases ?? []).map((p) => p.user_id),
    );

    return (purchases ?? []).map((p) => {
      const u = users.get(p.user_id);
      return {
        ...p,
        reportTitle: titles.get(p.report_id) ?? p.report_id,
        customerName: u?.name ?? null,
        customerEmailResolved: p.customer_email || u?.email || null,
        isFreeReport: freeIds.has(p.report_id) || p.amount_cents <= 0,
        emailStatus: p.email_sent_at ? "sent" : p.status === "paid" ? "pending" : "n/a",
        actionAt: p.created_at,
      };
    });
  });

export const listEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("report_entitlements")
      .select(
        "id, user_id, report_id, source, status, granted_at, granted_by, note, purchase_id",
      )
      .order("granted_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const { data: products } = await supabaseAdmin
      .from("report_products")
      .select("id, title, is_free, price_cents");
    const titles = new Map((products ?? []).map((p) => [p.id, p.title]));
    const freeIds = new Set(
      (products ?? []).filter((p) => p.is_free || p.price_cents <= 0).map((p) => p.id),
    );

    const users = await resolveUsers(
      supabaseAdmin,
      (data ?? []).flatMap((e) => [e.user_id, e.granted_by].filter(Boolean) as string[]),
    );

    return (data ?? []).map((e) => {
      const u = users.get(e.user_id);
      const granter = e.granted_by ? users.get(e.granted_by) : null;
      const isFree =
        freeIds.has(e.report_id) ||
        e.source === "admin_grant" ||
        e.source === "free" ||
        e.source === "promo";
      return {
        ...e,
        reportTitle: titles.get(e.report_id) ?? e.report_id,
        customerName: u?.name ?? null,
        customerEmail: u?.email ?? null,
        grantedByName: granter?.name ?? null,
        grantedByEmail: granter?.email ?? null,
        isFreeReport: isFree,
        sourceLabel:
          e.source === "admin_grant"
            ? "Admin grant (free)"
            : e.source === "purchase"
              ? "Purchase"
              : e.source === "free" || e.source === "promo"
                ? "Free"
                : e.source,
        actionAt: e.granted_at,
      };
    });
  });

/** Recent report generation activity (paid + free), with actor identity. */
export const listReportGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select(
        "id, action, actor_id, actor_email, target_user_id, target_email, target_report_id, metadata, created_at",
      )
      .eq("action", "report.generate")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const { data: products } = await supabaseAdmin
      .from("report_products")
      .select("id, title");
    const titles = new Map((products ?? []).map((p) => [p.id, p.title]));

    const userIds = (data ?? []).flatMap((r) =>
      [r.actor_id, r.target_user_id].filter(Boolean) as string[],
    );
    const users = await resolveUsers(supabaseAdmin, userIds);

    return (data ?? []).map((r) => {
      const actor = r.actor_id ? users.get(r.actor_id) : null;
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        reportId: r.target_report_id,
        reportTitle:
          (typeof meta.title === "string" && meta.title) ||
          (r.target_report_id ? titles.get(r.target_report_id) : null) ||
          r.target_report_id,
        actorName: actor?.name ?? null,
        actorEmail: r.actor_email || actor?.email || r.target_email || null,
        chartName: typeof meta.chartName === "string" ? meta.chartName : null,
        partnerName: typeof meta.partnerName === "string" ? meta.partnerName : null,
        accessReason: typeof meta.accessReason === "string" ? meta.accessReason : null,
        isFree:
          meta.accessReason === "admin" ||
          meta.accessReason === "free" ||
          meta.isFree === true,
        actionAt: r.created_at,
      };
    });
  });

const GrantSchema = z.object({
  email: z.string().email().max(200),
  reportId: z.string().min(1).max(64),
  note: z.string().max(300).optional(),
});

export const grantReportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => GrantSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { grantEntitlement } = await import("@/lib/reports/purchase.server");

    const email = data.email.trim().toLowerCase();
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const user = listed?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) throw new Error(`No account found for ${email}.`);

    await grantEntitlement({
      userId: user.id,
      reportId: data.reportId,
      source: "admin_grant",
      grantedBy: context.userId,
      note: data.note ?? null,
    });

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "entitlement.grant",
      target_user_id: user.id,
      target_email: email,
      target_report_id: data.reportId,
    });
    return { ok: true };
  });

export const revokeReportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), reportId: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { revokeEntitlement } = await import("@/lib/reports/purchase.server");
    await revokeEntitlement(data.userId, data.reportId);
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: context.userId,
      action: "entitlement.revoke",
      target_user_id: data.userId,
      target_report_id: data.reportId,
    });
    return { ok: true };
  });

/** Creates/refreshes the Stripe Product & Price for every paid published report. */
export const syncStripePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe, ensureStripePrice } = await import("@/lib/reports/stripe.server");

    const { data: rows, error } = await supabaseAdmin
      .from("report_products")
      .select(
        "id, title, tagline, price_cents, currency, is_free, is_published, stripe_price_id, stripe_product_id",
      )
      .eq("is_published", true)
      .eq("is_free", false)
      .gt("price_cents", 0);
    if (error) throw new Error(error.message);

    const stripe = getStripe();
    let synced = 0;
    const failures: string[] = [];
    for (const row of rows ?? []) {
      try {
        await ensureStripePrice(stripe, row);
        synced += 1;
      } catch (e) {
        failures.push(`${row.title}: ${(e as Error).message}`);
      }
    }
    return { synced, total: rows?.length ?? 0, failures };
  });
