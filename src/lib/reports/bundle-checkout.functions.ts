import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stripe Checkout for a gift bundle. The amount is always computed server-side. */
export const createBundleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bundleId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Please sign in with Google before purchasing.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe } = await import("./stripe.server");
    const { getBundle, bundlePricing } = await import("./bundles");

    const bundle = getBundle(data.bundleId);
    if (!bundle) throw new Error("Unknown bundle.");
    const pricing = bundlePricing(bundle);
    if (pricing.count === 0) throw new Error("This bundle is empty.");

    const stripe = getStripe();
    const origin =
      (context.claims as { origin?: string })?.origin ??
      process.env.SITE_URL ??
      "https://yourcosmicblueprint.lovable.app";
    const email =
      typeof (context.claims as { email?: unknown }).email === "string"
        ? ((context.claims as { email?: string }).email as string)
        : undefined;

    const anchor = bundle.reportIds[0]!;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pricing.priceCents,
            product_data: {
              name: bundle.title,
              description: `${pricing.count} premium reports — ${bundle.tagline}`,
            },
          },
        },
      ],
      customer_email: email,
      client_reference_id: context.userId,
      metadata: {
        user_id: context.userId,
        bundle_id: bundle.id,
        report_id: anchor,
        report_ids: bundle.reportIds.join(","),
      },
      payment_intent_data: {
        metadata: { user_id: context.userId, bundle_id: bundle.id, report_id: anchor },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&report=${encodeURIComponent(anchor)}`,
      cancel_url: `${origin}/checkout/cancel?report=${encodeURIComponent(anchor)}`,
    });

    await supabaseAdmin.from("report_purchases").insert({
      user_id: context.userId,
      report_id: anchor,
      stripe_session_id: session.id,
      amount_cents: pricing.priceCents,
      currency: "usd",
      status: "pending",
      customer_email: email ?? null,
      metadata: { bundle_id: bundle.id, report_ids: bundle.reportIds } as never,
    });

    return { url: session.url };
  });
