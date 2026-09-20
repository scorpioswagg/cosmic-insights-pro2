import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getEntitlementStatus } from "@/lib/reports/checkout.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/success")({
  ssr: false,
  validateSearch: z.object({
    session_id: z.string().optional(),
    report: z.string().optional(),
  }),
  component: CheckoutSuccess,
  head: () => ({
    meta: [
      { title: "Payment received | Cosmic Blueprint" },
      {
        name: "description",
        content:
          "We're confirming your Cosmic Blueprint report purchase. Your report unlocks as soon as payment is verified.",
      },
      { property: "og:title", content: "Payment received | Cosmic Blueprint" },
      {
        property: "og:description",
        content: "Confirming your Cosmic Blueprint report purchase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <Shell title="Something went wrong">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Button className="mt-4" onClick={() => { reset(); router.invalidate(); }}>
          Retry
        </Button>
      </Shell>
    );
  },
  notFoundComponent: () => <Shell title="Not found">This page does not exist.</Shell>,
});

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="w-full">{children}</div>
    </main>
  );
}

function CheckoutSuccess() {
  const { report } = Route.useSearch();
  const check = useServerFn(getEntitlementStatus);

  const { data, isError, error } = useQuery({
    queryKey: ["entitlement-status", report],
    enabled: !!report,
    queryFn: () => check({ data: { reportId: report! } }),
    refetchInterval: (q) => (q.state.data?.unlocked ? false : 2500),
    retry: 3,
  });

  if (!report) {
    return (
      <Shell title="Payment received">
        <p className="text-muted-foreground">
          We&rsquo;re confirming your purchase. Check{" "}
          <Link to="/my-reports" className="underline">My Reports</Link> in a moment.
        </p>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell title="Payment received">
        <p className="text-sm text-muted-foreground">
          We couldn&rsquo;t confirm your access yet: {(error as Error).message}
        </p>
        <Link to="/my-reports">
          <Button className="mt-4" variant="outline">Go to My Reports</Button>
        </Link>
      </Shell>
    );
  }

  if (data?.unlocked) {
    return (
      <Shell title="Your report is unlocked!">
        <p className="mb-6 text-muted-foreground">
          Payment verified for <strong>{data.title}</strong>. A confirmation email is on its way.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/my-reports">
            <Button>Open my report</Button>
          </Link>
          <Link to="/">
            <Button variant="outline">Back to chart</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Payment received — we&rsquo;re confirming your purchase">
      <p className="text-muted-foreground">
        This usually takes just a few seconds. This page updates automatically once
        your payment is verified — you don&rsquo;t need to refresh.
      </p>
      <div
        className="mx-auto mt-6 h-1 w-40 animate-pulse rounded-full bg-primary/60"
        role="status"
        aria-label="Confirming payment"
      />
    </Shell>
  );
}