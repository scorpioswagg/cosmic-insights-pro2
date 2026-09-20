import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
  approveAuthorization: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
  denyAuthorization: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
};
const authOAuth = () => (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("oauth_next", next);
        } catch {
          // ignore
        }
      }
      throw redirect({ to: "/", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="font-display text-2xl text-gradient-gold">Authorization request unavailable</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await authOAuth().approveAuthorization(authorization_id)
      : await authOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="starfield relative min-h-screen flex items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-lg glass rounded-2xl shadow-deep border border-gold/20 p-8 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Authorization</p>
          <h1 className="font-display text-3xl text-gradient-gold leading-tight">
            Connect {clientName} to your Cosmic Blueprint account
          </h1>
          <p className="text-sm text-muted-foreground">
            This lets {clientName} call this app's tools as you.
          </p>
        </div>

        <ul className="text-sm text-muted-foreground space-y-2 border-y border-border/40 py-4">
          <li className="flex gap-3"><span className="text-gold">✦</span> Share your basic profile</li>
          <li className="flex gap-3"><span className="text-gold">✦</span> Share your email address</li>
          <li className="flex gap-3"><span className="text-gold">✦</span> Browse the Cosmic Blueprint report catalog on your behalf</li>
        </ul>

        <p className="text-xs text-muted-foreground">
          This does not bypass this app's permissions or backend policies.
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="min-h-11 px-6 py-2 rounded-md border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-gold/40 transition disabled:opacity-50"
          >
            Cancel connection
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="min-h-11 px-6 py-2 rounded-md bg-gold text-primary-foreground text-sm font-display tracking-[0.15em] uppercase shadow-gold hover:opacity-95 transition disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      </div>
    </main>
  );
}