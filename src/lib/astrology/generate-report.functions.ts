import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORTS } from "./reports-catalog";
import { generateReportMarkdown } from "./generate-report-core.server";

const BodySchema = z.object({
  name: z.string(),
  longitude: z.number().optional(),
  sign: z.string(),
  signDegree: z.number(),
  house: z.number().optional(),
  retrograde: z.boolean(),
  speed: z.number().optional(),
});

const AspectSchema = z.object({
  a: z.string(),
  b: z.string(),
  type: z.string(),
  angle: z.number().optional(),
  orb: z.number(),
  applying: z.boolean(),
});

const ChartSchema = z.object({
  input: z.object({
    name: z.string(),
    date: z.string(),
    time: z.string(),
    place: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
    timeUnknown: z.boolean().optional(),
  }),
  julianDayUT: z.number(),
  utcIso: z.string(),
  ascendant: z.number(),
  midheaven: z.number(),
  bodies: z.array(BodySchema).min(1).max(40),
  // Accept 12 Placidus cusps; tolerate slight variance from clients.
  houses: z.array(z.number()).min(12).max(12),
  aspects: z.array(AspectSchema).max(120),
});

const InputSchema = z.object({
  reportId: z.string().min(1).max(64),
  chart: ChartSchema,
  partnerChart: ChartSchema.optional(),
});

function unwrapInput(input: unknown): unknown {
  if (input && typeof input === "object" && "data" in input) {
    return (input as { data: unknown }).data;
  }
  return input;
}

export const generateAstroReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    try {
      return InputSchema.parse(unwrapInput(input));
    } catch (e) {
      if (e instanceof z.ZodError) {
        const first = e.issues[0];
        const path = first?.path?.join(".") || "input";
        throw new Error(`Invalid chart data (${path}): ${first?.message ?? "validation failed"}`);
      }
      throw e;
    }
  })
  .handler(async ({ data, context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Unauthorized: please sign in with Google to generate reports.");
    }
    const def = REPORTS.find((r) => r.id === data.reportId);
    if (!def) throw new Error(`Unknown report: ${data.reportId}`);

    const { assertReportAccess } = await import("@/lib/reports/access.server");
    const access = await assertReportAccess(context.userId, data.reportId);

    if (def.adult) {
      const { data: profile, error: profileError } = await context.supabase
        .from("profiles")
        .select("adult_consent")
        .eq("id", context.userId)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);
      if (!profile?.adult_consent) {
        throw new Error(
          "ADULT_CONSENT_REQUIRED: You must record 18+ consent before generating intimacy reports.",
        );
      }
    }

    if (def.requiresPartner && !data.partnerChart) {
      throw new Error(
        "This synastry report requires a second (partner) chart. Please provide birth data for both people.",
      );
    }

    let result;
    try {
      result = await generateReportMarkdown({
        reportId: data.reportId,
        chart: data.chart,
        partnerChart: data.partnerChart,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("LOVABLE_API_KEY") || msg.includes("Missing LOVABLE")) {
        throw new Error(
          "Report engine is not configured (missing AI key). Ask the site admin to set LOVABLE_API_KEY.",
        );
      }
      throw new Error(msg || "Report generation failed.");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const email = (context.claims as { email?: string })?.email ?? null;
      await supabaseAdmin.from("admin_audit_log").insert({
        actor_id: context.userId,
        actor_email: email,
        action: "report.generate",
        target_user_id: context.userId,
        target_email: email,
        target_report_id: data.reportId,
        metadata: {
          title: def.title,
          chartName: data.chart.input.name,
          partnerName: data.partnerChart?.input.name ?? null,
          accessReason: access.reason,
          isFree:
            access.reason === "admin" ||
            access.reason === "free" ||
            (access.priceCents ?? 1) <= 0,
        },
      });
    } catch {
      // Never block report delivery on logging failure.
    }

    return result;
  });
