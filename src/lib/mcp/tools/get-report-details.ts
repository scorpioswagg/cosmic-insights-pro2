import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { REPORTS } from "@/lib/astrology/reports-catalog";

export default defineTool({
  name: "get_report_details",
  title: "Get report details",
  description:
    "Get the full definition of a Cosmic Blueprint report — sections, tagline, category, target length, and framing.",
  inputSchema: {
    report_id: z.string().min(1).describe("The report id, e.g. 'natal-essence' or 'soul-purpose'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ report_id }) => {
    const report = REPORTS.find((r) => r.id === report_id);
    if (!report) {
      return {
        content: [{ type: "text", text: `No report found with id "${report_id}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      structuredContent: { report },
    };
  },
});