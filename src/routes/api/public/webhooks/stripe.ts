import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const raw = await request.text();

        const { getStripe, stripeWebhookSecret } = await import(
          "@/lib/reports/stripe.server"
        );
        const stripe = getStripe();

        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            raw,
            signature,
            stripeWebhookSecret(),
            undefined,
            (
              await import("stripe")
            ).default.createSubtleCryptoProvider(),
          );
        } catch (e) {
          console.error("[stripe-webhook] signature verification failed", e);
          return new Response("Invalid signature", { status: 400 });
        }

        const {
          claimWebhookEvent,
          fulfillCheckoutSession,
          markPurchaseFailed,
          refundPurchaseByPaymentIntent,
        } = await import("@/lib/reports/purchase.server");

        try {
          const fresh = await claimWebhookEvent(event);
          if (!fresh) return Response.json({ received: true, duplicate: true });

          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              const session = event.data.object;
              if (
                session.payment_status === "paid" ||
                event.type === "checkout.session.async_payment_succeeded"
              ) {
                await fulfillCheckoutSession(session);
              }
              break;
            }
            case "checkout.session.async_payment_failed":
            case "checkout.session.expired": {
              await markPurchaseFailed(event.data.object.id, event.type);
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object;
              const pi =
                typeof charge.payment_intent === "string"
                  ? charge.payment_intent
                  : charge.payment_intent?.id;
              if (pi) await refundPurchaseByPaymentIntent(pi);
              break;
            }
            default:
              break;
          }
        } catch (e) {
          console.error("[stripe-webhook] processing failed", e);
          return new Response("Processing error", { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});