import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { REPORTS } from "@/lib/astrology/reports-catalog";

const BodySchema = z.object({
  name: z.string(),
  sign: z.string(),
  signDegree: z.number(),
  house: z.number().optional(),
  retrograde: z.boolean(),
});

const AspectSchema = z.object({
  a: z.string(),
  b: z.string(),
  type: z.string(),
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
  }),
  julianDayUT: z.number(),
  utcIso: z.string(),
  ascendant: z.number(),
  midheaven: z.number(),
  bodies: z.array(BodySchema).max(30),
  houses: z.array(z.number()).length(12),
  aspects: z.array(AspectSchema).max(80),
});

function errorContent(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function requireAdmin(ctx: ToolContext): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  if (!ctx.isAuthenticated()) return { ok: false, error: "Not authenticated." };
  const userId = ctx.getUserId();
  if (!userId) return { ok: false, error: "Missing user id in token." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) return { ok: false, error: `Role check failed: ${error.message}` };
  if (!data) return { ok: false, error: "Forbidden: admin role required." };
  return { ok: true, userId };
}

export default defineTool({
  name: "generate_report_pdf",
  title: "Generate a Cosmic Blueprint report PDF",
  description:
    "Generate a personalized Cosmic Blueprint report as a luxury PDF for a given natal chart and report type. Uploads the PDF to private storage and returns a short-lived signed download URL. Admin-only.",
  inputSchema: {
    report_id: z
      .string()
      .min(1)
      .describe("Report id from the catalog (see list_reports), e.g. 'natal-essence'."),
    chart: ChartSchema.describe(
      "Full natal chart calculation. Must include Placidus houses, planetary bodies, and aspects — no invented data.",
    ),
    signed_url_ttl_seconds: z
      .number()
      .int()
      .min(60)
      .max(60 * 60 * 24 * 7)
      .optional()
      .describe("How long the signed download URL should remain valid. Defaults to 1 hour."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ report_id, chart, signed_url_ttl_seconds }, ctx) => {
    const auth = await requireAdmin(ctx);
    if (!auth.ok) return errorContent(auth.error);

    const def = REPORTS.find((r) => r.id === report_id);
    if (!def) return errorContent(`Unknown report_id: ${report_id}`);

    // 1) AI-generate markdown.
    const { generateReportMarkdown } = await import(
      "@/lib/astrology/generate-report-core.server"
    );
    let payload;
    try {
      payload = await generateReportMarkdown({ reportId: report_id, chart });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorContent(`Report generation failed: ${msg}`);
    }

    // 2) Build PDF bytes.
    let bytes: Uint8Array;
    try {
      const { buildLuxuryReportPdfBytes } = await import("@/lib/astrology/luxury-pdf");
      // The PDF builder reads a few optional chart fields the tool schema does not require.
      // Cast to the builder's ChartCalculation shape; missing fields are unused during layout.
      bytes = buildLuxuryReportPdfBytes(payload, chart as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorContent(`PDF build failed: ${msg}`);
    }

    // 3) Upload to private storage.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeSlug = def.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const objectPath = `${auth.userId}/${safeSlug}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("report-pdfs")
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) return errorContent(`Upload failed: ${uploadError.message}`);

    const ttl = signed_url_ttl_seconds ?? 60 * 60;
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("report-pdfs")
      .createSignedUrl(objectPath, ttl);
    if (signError || !signed?.signedUrl) {
      return errorContent(`Signed URL failed: ${signError?.message ?? "no url returned"}`);
    }

    const result = {
      reportId: report_id,
      title: payload.title,
      pdfUrl: signed.signedUrl,
      pdfPath: objectPath,
      expiresInSeconds: ttl,
      generatedAt: payload.generatedAt,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});