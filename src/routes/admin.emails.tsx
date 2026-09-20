import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listEmailLogs } from "@/lib/admin/email-logs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/emails")({
  ssr: false,
  component: AdminEmailsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-2 text-2xl font-semibold">Email audit log</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {msg === "Forbidden" || msg === "Unauthorized"
            ? "You need admin access to view this page."
            : `Error: ${msg}`}
        </p>
        <Button
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function AdminEmailsPage() {
  const fetchLogs = useServerFn(listEmailLogs);
  const [status, setStatus] = useState<"all" | "sent" | "failed" | "pending">("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["email-logs", status],
    queryFn: () => fetchLogs({ data: { status, limit: 100 } }),
  });

  const statuses: Array<typeof status> = ["all", "sent", "failed", "pending"];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email audit log</h1>
          <p className="text-sm text-muted-foreground">
            Report delivery attempts via /api/send-report
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {data?.stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={data.stats.total} />
          <StatCard label="Sent" value={data.stats.sent} tone="success" />
          <StatCard label="Failed" value={data.stats.failed} tone="danger" />
          <StatCard label="Pending" value={data.stats.pending} tone="warn" />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.rows.length ? (
        <p className="text-sm text-muted-foreground">No records.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Report</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempts</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">{r.template_name}</td>
                  <td className="p-3">
                    <div>{r.recipient_email}</div>
                    {r.recipient_name && (
                      <div className="text-xs text-muted-foreground">{r.recipient_name}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3">{r.attempts}</td>
                  <td className="p-3 text-xs">
                    {r.error_message ? (
                      <span className="text-red-600">{r.error_message}</span>
                    ) : r.resend_id ? (
                      <span className="text-muted-foreground">id: {r.resend_id}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "warn";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-600"
      : tone === "danger"
        ? "text-red-600"
        : tone === "warn"
          ? "text-amber-600"
          : "";
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "sent"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant as never}>{status}</Badge>;
}