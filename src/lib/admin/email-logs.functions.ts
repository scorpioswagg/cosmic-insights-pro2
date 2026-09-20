import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  status: z.enum(["all", "sent", "failed", "pending"]).optional(),
}).optional();

export type EmailLogRow = {
  id: string;
  template_name: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  attempts: number;
  error_message: string | null;
  resend_id: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
};

export const listEmailLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input) ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const limit = data?.limit ?? 100;
    let q = supabase
      .from("email_send_log")
      .select(
        "id, template_name, recipient_email, recipient_name, status, attempts, error_message, resend_id, pdf_url, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data?.status && data.status !== "all") {
      q = q.eq("status", data.status);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const stats = {
      total: rows?.length ?? 0,
      sent: rows?.filter((r) => r.status === "sent").length ?? 0,
      failed: rows?.filter((r) => r.status === "failed").length ?? 0,
      pending: rows?.filter((r) => r.status === "pending").length ?? 0,
    };

    return { rows: (rows ?? []) as EmailLogRow[], stats };
  });