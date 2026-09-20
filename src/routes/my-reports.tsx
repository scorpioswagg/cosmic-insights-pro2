import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyReports } from "@/lib/reports/checkout.functions";
import { formatPrice } from "@/lib/reports/pricing";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/my-reports")({
  ssr: false,
  component: MyReportsPage,
  head: () => ({
    meta: [
      { title: "My Cosmic Blueprint Reports" },
      {
        name: "description",
        content:
          "Every Cosmic Blueprint report you own — unlocked readings, purchase history, and downloads in one place.",
      },
      { property: "og:title", content: "My Cosmic Blueprint Reports" },
      {
        property: "og:description",
        content: "Your unlocked Cosmic Blueprint readings and purchase history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const msg = error instanceof Error ? error.message : String(error);
    const needsAuth = msg.startsWith("Unauthorized");
    return (
      <main className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">My Cosmic Blueprint Reports</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {needsAuth ? "Sign in to see the reports you own." : msg}
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/"><Button variant="outline">Go to sign in</Button></Link>
          <Button onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
        </div>
      </main>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function MyReportsPage() {
  const fetchMine = useServerFn(getMyReports);
  const { data, isLoading } = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => fetchMine(),
    retry: false,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My Cosmic Blueprint Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you own. Generate any unlocked report from your chart page.
          </p>
        </div>
        <Link to="/"><Button variant="outline">Back to my chart</Button></Link>
      </div>

      {data?.isAdmin && (
        <p className="mb-6 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          Administrator account — every report is unlocked for you.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your library…</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="mb-4 text-muted-foreground">
            You don&rsquo;t own any paid reports yet.
          </p>
          <Link to="/"><Button>Browse the report catalog</Button></Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data!.items.map((item) => (
            <li key={item.reportId} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="text-xl">{item.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.tagline}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-primary">
                    🔓 Unlocked · {item.source.replace("_", " ")}
                  </p>
                </div>
              </div>
              <Link to="/" hash={`report-${item.reportId}`}>
                <Button size="sm" className="mt-3 w-full">Open report</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(data?.purchases.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Purchase history</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3">Report</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {data!.purchases.map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{p.report_id}</td>
                    <td className="p-3">{formatPrice(p.amount_cents)}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}