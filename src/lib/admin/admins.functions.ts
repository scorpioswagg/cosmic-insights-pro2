import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(userId: string) {
  const { isAdminUser } = await import("@/lib/reports/access.server");
  if (!(await isAdminUser(userId))) throw new Error("Forbidden");
}

async function audit(entry: {
  actorId: string;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  targetReportId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    target_email: entry.targetEmail ?? null,
    target_report_id: entry.targetReportId ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}

export interface AdminAccount {
  userId: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string | null;
  pending: boolean;
}

export const listAdministrators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    const accounts: AdminAccount[] = [];
    for (const r of roles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      const u = data?.user;
      accounts.push({
        userId: r.user_id,
        email: u?.email ?? "(unknown)",
        role: "admin",
        status: u ? (u.banned_until ? "banned" : u.email_confirmed_at ? "active" : "unconfirmed") : "missing",
        createdAt: u?.created_at ?? r.created_at,
        pending: false,
      });
    }

    const emails = new Set(accounts.map((a) => a.email.toLowerCase()));
    const { data: invites } = await supabaseAdmin.from("admin_invites").select("email, created_at");
    for (const i of invites ?? []) {
      if (emails.has(i.email.toLowerCase())) continue;
      accounts.push({
        userId: null,
        email: i.email,
        role: "admin",
        status: "invited — becomes admin on first sign-in",
        createdAt: i.created_at,
        pending: true,
      });
    }

    return accounts.sort((a, b) => a.email.localeCompare(b.email));
  });

const EmailSchema = z.object({ email: z.string().email().max(200) });

export const addAdministrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EmailSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    await supabaseAdmin.from("admin_invites").upsert(
      { email, invited_by: context.userId },
      { onConflict: "email" },
    );

    // If the account already exists, grant the role immediately.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: found.id, role: "admin" }, { onConflict: "user_id,role" });
    }

    await audit({
      actorId: context.userId,
      action: "admin.add",
      targetEmail: email,
      targetUserId: found?.id ?? null,
    });
    return { granted: !!found, invited: !found };
  });

export const removeAdministrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EmailSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (found?.id === context.userId) {
      throw new Error("You cannot remove your own administrator access.");
    }

    await supabaseAdmin.from("admin_invites").delete().eq("email", email);
    if (found) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", found.id).eq("role", "admin");
    }

    await audit({
      actorId: context.userId,
      action: "admin.remove",
      targetEmail: email,
      targetUserId: found?.id ?? null,
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, action, actor_id, target_email, target_report_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });