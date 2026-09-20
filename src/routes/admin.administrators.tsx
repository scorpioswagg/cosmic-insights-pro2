import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  addAdministrator,
  listAdministrators,
  listAuditLog,
  removeAdministrator,
} from "@/lib/admin/admins.functions";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/AdminNav";

export const Route = createFileRoute("/admin/administrators")({
  ssr: false,
  component: AdministratorsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-2 text-2xl font-semibold">Administrators</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {msg === "Forbidden" || msg.startsWith("Unauthorized")
            ? "You need admin access to view this page."
            : msg}
        </p>
        <div className="flex gap-3">
          <Link to="/"><Button variant="outline">Home</Button></Link>
          <Button onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function AdministratorsPage() {
  const fetchAdmins = useServerFn(listAdministrators);
  const fetchAudit = useServerFn(listAuditLog);
  const runAdd = useServerFn(addAdministrator);
  const runRemove = useServerFn(removeAdministrator);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: admins, isLoading } = useQuery({
    queryKey: ["administrators"],
    queryFn: () => fetchAdmins(),
  });
  const { data: audit } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fetchAudit() });

  const add = useMutation({
    mutationFn: (e: string) => runAdd({ data: { email: e } }),
    onSuccess: (r) => {
      toast.success(r.granted ? "Administrator added." : "Invited — they become an admin at first sign-in.");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["administrators"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (e: string) => runRemove({ data: { email: e } }),
    onSuccess: () => {
      toast.success("Administrator access removed.");
      qc.invalidateQueries({ queryKey: ["administrators"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Administrators</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Live from the account database. Nothing here is hard-coded.
      </p>
      <AdminNav />

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) add.mutate(email.trim()); }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="new-admin@example.com"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add administrator"}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).map((a) => (
                <tr key={a.email} className="border-t">
                  <td className="p-3 font-medium">{a.email}</td>
                  <td className="p-3">{a.role}</td>
                  <td className="p-3 text-muted-foreground">{a.status}</td>
                  <td className="p-3 text-muted-foreground">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(a.email)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-lg font-semibold">Recent admin actions</h2>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {(audit ?? []).map((row) => (
          <li key={row.id}>
            {new Date(row.created_at).toLocaleString()} — {row.action}
            {row.target_email ? ` · ${row.target_email}` : ""}
            {row.target_report_id ? ` · ${row.target_report_id}` : ""}
          </li>
        ))}
        {(audit ?? []).length === 0 && <li>No admin actions recorded yet.</li>}
      </ul>
    </div>
  );
}