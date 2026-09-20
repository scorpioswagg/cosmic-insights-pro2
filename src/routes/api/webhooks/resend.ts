import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  verifySvix,
  statusFromEvent,
  shouldAdvanceStatus,
} from "@/lib/email/resend-webhook";

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        const svixId = request.headers.get("svix-id") ?? "";
        const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
        const svixSignature = request.headers.get("svix-signature") ?? "";

        const verified = verifySvix({
          secret,
          svixId,
          svixTimestamp,
          svixSignature,
          rawBody,
        });
        if (!verified) {
          console.warn("[resend-webhook] signature verification failed", { svixId });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          type?: string;
          created_at?: string;
          data?: {
            email_id?: string;
            to?: string[] | string;
            subject?: string;
            bounce?: { message?: string; subType?: string };
            click?: { link?: string };
          };
        };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType = payload.type ?? "";
        const nextStatus = statusFromEvent(eventType);
        const resendId = payload.data?.email_id;

        if (!nextStatus || !resendId) {
          // Ack unknown/irrelevant events so Resend doesn't retry forever.
          return Response.json({ ok: true, ignored: true, type: eventType });
        }

        const db = adminClient();
        if (!db) {
          console.error("[resend-webhook] admin client unavailable");
          return new Response("Server misconfigured", { status: 500 });
        }

        const { data: row, error: fetchErr } = await db
          .from("email_send_log")
          .select("id, status, metadata")
          .eq("resend_id", resendId)
          .maybeSingle();

        if (fetchErr) {
          console.error("[resend-webhook] lookup failed", fetchErr);
          return new Response("Lookup failed", { status: 500 });
        }
        if (!row) {
          // Ack — nothing to update, but not an error worth retrying.
          console.warn("[resend-webhook] no log row for resend_id", resendId);
          return Response.json({ ok: true, unmatched: true });
        }

        const shouldAdvance = shouldAdvanceStatus(row.status, nextStatus);

        const prevMeta =
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        const events = Array.isArray((prevMeta as { events?: unknown }).events)
          ? ((prevMeta as { events: unknown[] }).events as unknown[])
          : [];
        const nextMeta: Record<string, unknown> = {
          ...prevMeta,
          events: [
            ...events,
            {
              type: eventType,
              at: payload.created_at ?? new Date().toISOString(),
              ...(payload.data?.bounce ? { bounce: payload.data.bounce } : {}),
              ...(payload.data?.click ? { click: payload.data.click } : {}),
            },
          ],
        };

        const patch: {
          metadata: Json;
          updated_at: string;
          status?: string;
          error_message?: string | null;
        } = {
          metadata: nextMeta as Json,
          updated_at: new Date().toISOString(),
        };
        if (shouldAdvance) patch.status = nextStatus;
        if (nextStatus === "bounced" || nextStatus === "failed") {
          patch.error_message =
            payload.data?.bounce?.message ?? `Resend event: ${eventType}`;
        }

        const { error: updateErr } = await db
          .from("email_send_log")
          .update(patch)
          .eq("id", row.id);

        if (updateErr) {
          console.error("[resend-webhook] update failed", updateErr);
          return new Response("Update failed", { status: 500 });
        }

        return Response.json({ ok: true, id: row.id, status: patch.status ?? row.status });
      },
    },
  },
});