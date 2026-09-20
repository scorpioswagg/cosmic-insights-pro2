import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function stripeSecret(): string {
  // The project secret was originally saved under a misspelled name; support both.
  const key =
    process.env.STRIPE_SECRET_KEY ??
    process.env.SRIPE_API_SECTRET_KEY ??
    process.env.STRIPE_API_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured: missing STRIPE_SECRET_KEY.");
  return key;
}

export function stripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK;
  if (!key) throw new Error("Stripe webhook secret is not configured.");
  return key;
}

export function getStripe(): Stripe {
  return new Stripe(stripeSecret(), {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export interface CatalogRow {
  id: string;
  title: string;
  tagline: string;
  price_cents: number;
  currency: string;
  is_free: boolean;
  is_published: boolean;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
}

/**
 * Resolves (creating if needed) the Stripe Price for a report. The amount is
 * always taken from the database — never from the client.
 */
export async function ensureStripePrice(
  stripe: Stripe,
  row: CatalogRow,
): Promise<string> {
  if (row.stripe_price_id) {
    try {
      const existing = await stripe.prices.retrieve(row.stripe_price_id);
      if (
        existing.active &&
        existing.unit_amount === row.price_cents &&
        existing.currency === row.currency
      ) {
        return existing.id;
      }
    } catch {
      // fall through and create a fresh price
    }
  }

  let productId = row.stripe_product_id ?? null;
  if (productId) {
    try {
      const p = await stripe.products.retrieve(productId);
      if (!p.active) productId = null;
    } catch {
      productId = null;
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: row.title,
      description: row.tagline?.slice(0, 300) || undefined,
      metadata: { report_id: row.id },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: row.currency,
    unit_amount: row.price_cents,
    metadata: { report_id: row.id },
  });

  await supabaseAdmin
    .from("report_products")
    .update({ stripe_price_id: price.id, stripe_product_id: productId })
    .eq("id", row.id);

  return price.id;
}