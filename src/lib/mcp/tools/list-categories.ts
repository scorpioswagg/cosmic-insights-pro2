import { defineTool } from "@lovable.dev/mcp-js";
import { REPORTS } from "@/lib/astrology/reports-catalog";

export default defineTool({
  name: "list_categories",
  title: "List report categories",
  description:
    "List every Cosmic Blueprint report category with the number of reports in each.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const counts = new Map<string, number>();
    for (const r of REPORTS) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const categories = Array.from(counts, ([name, count]) => ({ name, count }));
    return {
      content: [{ type: "text", text: JSON.stringify(categories, null, 2) }],
      structuredContent: { categories },
    };
  },
});