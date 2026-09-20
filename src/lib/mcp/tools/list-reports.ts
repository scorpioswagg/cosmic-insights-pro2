import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { REPORTS } from "@/lib/astrology/reports-catalog";

export default defineTool({
  name: "list_reports",
  title: "List Cosmic Blueprint reports",
  description:
    "List all astrology reports available in the Cosmic Blueprint catalog. Optionally filter by category.",
  inputSchema: {
    category: z
      .string()
      .optional()
      .describe(
        "Optional category filter (e.g. 'Core', 'Relationships', 'Growth', 'Timing', 'Vocation', 'Esoteric', 'Intimacy (18+)', 'Patriotic Collection', 'Signature Series').",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const items = REPORTS.filter((r) => !category || r.category === category).map((r) => ({
      id: r.id,
      title: r.title,
      tagline: r.tagline,
      category: r.category,
      adult: r.adult ?? false,
      targetWords: r.targetWords,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { count: items.length, reports: items },
    };
  },
});