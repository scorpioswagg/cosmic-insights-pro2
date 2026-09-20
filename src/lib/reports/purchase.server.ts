import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPurchaseReceiptEmail } from "@/lib/email/service.server";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Returns false when this Stripe event was already processed. */
export async function claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    payload: { type: event.type, created: event.created } as never,
  });
  if (error) {
    // Unique violation → duplicate delivery.
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

export async function grantEntitlement(args: {
  userId: string;
  reportId: string;
  source: "purchase" | "admin_grant" | "free";
  purchaseId?: string | null;
  grantedBy?: string | null;
  note?: string | null;
}) {
  const { error } = await supabaseAdmin.from("report_entitlements").upsert(
    {
      user_id: args.userId,
      report_id: args.reportId,
      source: args.source,
      purchase_id: args.purchaseId ?? null,
      granted_by: args.grantedBy ?? null,
      note: args.note ?? null,
      status: "active",
      granted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,report_id" },
  );
  if (error) throw new Error(error.message);
}

export async function revokeEntitlement(userId: string, reportId: string) {
  const { error } = await supabaseAdmin
    .from("report_entitlements")
    .update({ status: "revoked" })
    .eq("user_id", userId)
    .eq("report_id", reportId);
  if (error) throw new Error(error.message);
}

/**
 * Marks the purchase paid, grants the entitlement for exactly one report, and
 * sends the confirmation email once. Safe to call more than once.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const reportId = session.metadata?.report_id;
  const userId = session.metadata?.user_id;
  const bundleId = session.metadata?.bundle_id ?? null;
  const bundleReportIds = (session.metadata?.report_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!reportId || !userId) {
    console.error("[stripe] session missing metadata", session.id);
    return { ok: false as const, reason: "missing_metadata" };
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { data: purchase, error: upErr } = await supabaseAdmin
    .from("report_purchases")
    .upsert(
      {
        user_id: userId,
        report_id: reportId,
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntent,
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        status: "paid",
        customer_email:
          session.customer_details?.email ?? session.customer_email ?? null,
        metadata: (bundleId
          ? { bundle_id: bundleId, report_ids: bundleReportIds }
          : {}) as never,
      },
      { onConflict: "stripe_session_id" },
    )
    .select("id, email_sent_at, customer_email, amount_cents, currency")
    .single();
  if (upErr) throw new Error(upErr.message);

  const idsToGrant = bundleReportIds.length > 0 ? bundleReportIds : [reportId];
  for (const id of idsToGrant) {
    await grantEntitlement({
      userId,
      reportId: id,
      source: "purchase",
      purchaseId: purchase.id,
      note: bundleId ? `bundle:${bundleId}` : null,
    });
  }

  if (!purchase.email_sent_at && purchase.customer_email) {
    const { data: product } = await supabaseAdmin
      .from("report_products")
      .select("title")
      .eq("id", reportId)
      .maybeSingle();
    try {
      await sendPurchaseReceiptEmail({
        to: purchase.customer_email,
        name: session.customer_details?.name ?? undefined,
        reportTitle: bundleId
          ? `${idsToGrant.length} reports (gift set)`
          : (product?.title ?? reportId),
        amountFormatted: formatMoney(purchase.amount_cents, purchase.currency),
        orderId: purchase.id,
      });
      await supabaseAdmin
        .from("report_purchases")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", purchase.id);
    } catch (e) {
      console.error("[stripe] confirmation email failed", e);
    }
  }

  return { ok: true as const, purchaseId: purchase.id, reportId, userId };
}

export async function markPurchaseFailed(sessionId: string, reason: string) {
  await supabaseAdmin
    .from("report_purchases")
    .update({ status: "failed", metadata: { reason } as never })
    .eq("stripe_session_id", sessionId);
}

export async function refundPurchaseByPaymentIntent(paymentIntentId: string) {
  const { data: rows } = await supabaseAdmin
    .from("report_purchases")
    .select("id, user_id, report_id, metadata")
    .eq("stripe_payment_intent", paymentIntentId);
  for (const row of rows ?? []) {
    await supabaseAdmin
      .from("report_purchases")
      .update({ status: "refunded" })
      .eq("id", row.id);
    const meta = (row.metadata ?? {}) as { report_ids?: string[] };
    const ids = Array.isArray(meta.report_ids) && meta.report_ids.length
      ? meta.report_ids
      : [row.report_id];
    for (const id of ids) await revokeEntitlement(row.user_id, id);
  }
}