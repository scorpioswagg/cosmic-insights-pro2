import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const acknowledgeAdultConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Anonymous users cannot acknowledge adult content.");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ adult_consent: true })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdultConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("adult_consent")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { adultConsent: !!data?.adult_consent };
  });
