import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listReports from "./tools/list-reports";
import getReportDetails from "./tools/get-report-details";
import listCategories from "./tools/list-categories";
import generateReportPdf from "./tools/generate-report-pdf";

// OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cosmic-blueprint-mcp",
  title: "Cosmic Blueprint",
  version: "0.1.0",
  instructions:
    "Tools for the Cosmic Blueprint astrology platform. Use `list_categories` and `list_reports` to browse the catalog, `get_report_details` for the full definition of a specific report, and `generate_report_pdf` (admin-only) to produce a personalized luxury PDF from a natal chart and receive a short-lived signed download URL.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCategories, listReports, getReportDetails, generateReportPdf],
});