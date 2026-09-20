import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  grantReportAccess,
  listEntitlements,
  listPurchases,
  listReportGenerations,
  revokeReportAccess,
} from "@/lib/admin/purchases.functions";
import { formatPrice } from "@/lib/reports/pricing";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/AdminNav";

export const Route = createFileRoute("/admin/purchases")({
  ssr: false,
  component: PurchasesPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-2 text-2xl font-semibold">Purchases</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {msg === "Forbidden" || msg.startsWith("Unauthorized")
            ? "You need admin access to view this page."
            : msg}
        </p>
        <div className="flex gap-3">
          <Link to="/">
            <Button variant="outline">Home</Button>
          </Link>
          <Button
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function PurchasesPage() {
  const fetchPurchases = useServerFn(listPurchases);
  const fetchEntitlements = useServerFn(listEntitlements);
  const fetchGenerations = useServerFn(listReportGenerations);
  const runGrant = useServerFn(grantReportAccess);
  const runRevoke = useServerFn(revokeReportAccess);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [reportId, setReportId] = useState("");

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: () => fetchPurchases(),
  });
  const { data: entitlements } = useQuery({
    queryKey: ["admin-entitlements"],
    queryFn: () => fetchEntitlements(),
  });
  const { data: generations } = useQuery({
    queryKey: ["admin-generations"],
    queryFn: () => fetchGenerations(),
  });

  const grant = useMutation({
    mutationFn: () => runGrant({ data: { email: email.trim(), reportId: reportId.trim() } }),
    onSuccess: () => {
      toast.success("Access granted.");
      setEmail("");
      setReportId("");
      qc.invalidateQueries({ queryKey: ["admin-entitlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (v: { userId: string; reportId: string }) => runRevoke({ data: v }),
    onSuccess: () => {
      toast.success("Access revoked.");
      qc.invalidateQueries({ queryKey: ["admin-entitlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidCount = (purchases ?? []).filter((p) => p.status === "paid").length;
  const freeEntitlements = (entitlements ?? []).filter((e) => e.isFreeReport).length;
  const freeGens = (generations ?? []).filter((g) => g.isFree).length;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Purchases & activity</h1>
        <p className="text-sm text-muted-foreground">
          Paid checkouts, free entitlements, and every report generation with name, email, and time.
        </p>
      </div>

      <AdminNav />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Purchases" value={String(purchases?.length ?? 0)} />
        <Stat label="Paid" value={String(paidCount)} />
        <Stat label="Free entitlements" value={String(freeEntitlements)} />
        <Stat label="Free generations" value={String(freeGens)} />
      </div>

      <div className="mb-8 rounded-md border p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Grant free access
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@email.com"
            className="min-w-[220px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="report-id (e.g. brutal-blueprint)"
            className="min-w-[220px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button
            disabled={!email.trim() || !reportId.trim() || grant.isPending}
            onClick={() => grant.mutate()}
          >
            {grant.isPending ? "Granting…" : "Grant access"}
          </Button>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Purchases</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Report</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Email status</th>
                <th className="p-3">Date & time</th>
              </tr>
            </thead>
            <tbody>
              {(purchases ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">{p.customerName || "—"}</td>
                  <td className="p-3 text-muted-foreground">{p.customerEmailResolved || "—"}</td>
                  <td className="p-3">
                    {p.reportTitle}
                    {p.isFreeReport && (
                      <span className="ml-2 rounded border px-1 text-[10px] uppercase text-gold">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="p-3">{formatPrice(p.amount_cents)}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3 text-muted-foreground">{p.emailStatus}</td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(p.actionAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(purchases ?? []).length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={7}>
                    No purchases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Report generations (free & paid)</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Logged each time a signed-in user generates a report. Free includes admin and free-tier access.
      </p>
      <div className="mb-8 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Report</th>
              <th className="p-3">Chart</th>
              <th className="p-3">Access</th>
              <th className="p-3">Date & time</th>
            </tr>
          </thead>
          <tbody>
            {(generations ?? []).map((g) => (
              <tr key={g.id} className="border-t">
                <td className="p-3">{g.actorName || "—"}</td>
                <td className="p-3 text-muted-foreground">{g.actorEmail || "—"}</td>
                <td className="p-3">
                  {g.reportTitle}
                  {g.isFree && (
                    <span className="ml-2 rounded border px-1 text-[10px] uppercase text-gold">
                      Free
                    </span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {g.chartName || "—"}
                  {g.partnerName ? ` + ${g.partnerName}` : ""}
                </td>
                <td className="p-3">{g.accessReason || "—"}</td>
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {new Date(g.actionAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {(generations ?? []).length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={6}>
                  No generations logged yet. New generations appear here after users create reports.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Entitlements</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Report</th>
              <th className="p-3">Source</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date & time</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(entitlements ?? []).map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{e.customerName || "—"}</td>
                <td className="p-3 text-muted-foreground">{e.customerEmail || "—"}</td>
                <td className="p-3">
                  {e.reportTitle}
                  {e.isFreeReport && (
                    <span className="ml-2 rounded border px-1 text-[10px] uppercase text-gold">
                      Free
                    </span>
                  )}
                </td>
                <td className="p-3">{e.sourceLabel}</td>
                <td className="p-3">{e.status}</td>
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {new Date(e.actionAt).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  {e.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revoke.mutate({ userId: e.user_id, reportId: e.report_id })}
                    >
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(entitlements ?? []).length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  No entitlements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
