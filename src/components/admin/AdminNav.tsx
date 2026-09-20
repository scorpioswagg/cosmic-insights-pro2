import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/purchases", label: "Purchases" },
  { to: "/admin/administrators", label: "Administrators" },
  { to: "/admin/emails", label: "Emails" },
] as const;

export function AdminNav() {
  return (
    <nav aria-label="Admin sections" className="mb-6 flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          activeProps={{ className: "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm" }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}