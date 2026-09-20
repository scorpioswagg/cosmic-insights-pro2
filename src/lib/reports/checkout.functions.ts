import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Creates a Stripe Checkout Session for one report. Price is resolved server-side. */
export const createReportCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reportId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Please sign in with Google before purchasing.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe, ensureStripePrice } = await import("./stripe.server");
    const { resolveReportAccess } = await import("./access.server");

    const access = await resolveReportAccess(context.userId, data.reportId);
    if (access.allowed) return { alreadyOwned: true as const, url: null };
    if (access.reason === "unknown_report") throw new Error("Unknown report.");
    if (access.reason === "unpublished") throw new Error("This report is not available.");

    const { data: row, error } = await supabaseAdmin
      .from("report_products")
      .select(
        "id, title, tagline, price_cents, currency, is_free, is_published, stripe_price_id, stripe_product_id",
      )
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Unknown report.");
    if (!row.is_published) throw new Error("This report is not available.");
    if (row.is_free || row.price_cents <= 0) throw new Error("This report is free.");

    const stripe = getStripe();
    const priceId = await ensureStripePrice(stripe, row);

    const origin =
      (context.claims as { origin?: string })?.origin ??
      process.env.SITE_URL ??
      "https://yourcosmicblueprint.lovable.app";

    const email =
      typeof (context.claims as { email?: unknown }).email === "string"
        ? ((context.claims as { email?: string }).email as string)
        : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: context.userId,
      metadata: {
        user_id: context.userId,
        report_id: row.id,
        report_slug: row.id,
      },
      payment_intent_data: {
        metadata: { user_id: context.userId, report_id: row.id },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&report=${encodeURIComponent(row.id)}`,
      cancel_url: `${origin}/checkout/cancel?report=${encodeURIComponent(row.id)}`,
    });

    await supabaseAdmin.from("report_purchases").insert({
      user_id: context.userId,
      report_id: row.id,
      stripe_session_id: session.id,
      amount_cents: row.price_cents,
      currency: row.currency,
      status: "pending",
      customer_email: email ?? null,
    });

    return { alreadyOwned: false as const, url: session.url };
  });

/** Access state for every published report, for the signed-in user. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isAdminUser } = await import("./access.server");
    const admin = await isAdminUser(context.userId);

    const { data: ents } = await supabaseAdmin
      .from("report_entitlements")
      .select("report_id, status, expires_at, source, granted_at")
      .eq("user_id", context.userId)
      .eq("status", "active");

    const now = Date.now();
    const unlocked = (ents ?? [])
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)
      .map((e) => e.report_id);

    return { isAdmin: admin, unlocked };
  });

/** Polled by the success page until the verified webhook has landed. */
export const getEntitlementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reportId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveReportAccess } = await import("./access.server");
    const access = await resolveReportAccess(context.userId, data.reportId);
    return {
      unlocked: access.allowed,
      reason: access.reason,
      title: access.title ?? data.reportId,
    };
  });

/** The signed-in customer's library. */
export const getMyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isAdminUser } = await import("./access.server");
    const admin = await isAdminUser(context.userId);

    const { data: ents } = await supabaseAdmin
      .from("report_entitlements")
      .select("report_id, source, granted_at, status")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("granted_at", { ascending: false });

    const ids = (ents ?? []).map((e) => e.report_id);
    const { data: products } = ids.length
      ? await supabaseAdmin
          .from("report_products")
          .select("id, title, tagline, category, icon")
          .in("id", ids)
      : { data: [] as { id: string; title: string; tagline: string; category: string; icon: string }[] };

    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    const { data: purchases } = await supabaseAdmin
      .from("report_purchases")
      .select("report_id, amount_cents, currency, status, created_at")
      .eq("user_id", context.userId)
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    return {
      isAdmin: admin,
      items: (ents ?? []).map((e) => ({
        reportId: e.report_id,
        source: e.source,
        grantedAt: e.granted_at,
        title: byId.get(e.report_id)?.title ?? e.report_id,
        tagline: byId.get(e.report_id)?.tagline ?? "",
        category: byId.get(e.report_id)?.category ?? "",
        icon: byId.get(e.report_id)?.icon ?? "",
      })),
      purchases: purchases ?? [],
    };
  });