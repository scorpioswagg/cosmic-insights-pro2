import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/cancel")({
  ssr: false,
  component: CheckoutCancel,
  head: () => ({
    meta: [
      { title: "Checkout cancelled | Cosmic Blueprint" },
      {
        name: "description",
        content:
          "Your Cosmic Blueprint checkout was cancelled. No payment was taken — you can try again any time.",
      },
      { property: "og:title", content: "Checkout cancelled | Cosmic Blueprint" },
      { property: "og:description", content: "No payment was taken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function CheckoutCancel() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-3 text-3xl font-semibold tracking-tight">Checkout cancelled</h1>
      <p className="mb-6 text-muted-foreground">
        No payment was taken and nothing was charged. Your report is still waiting
        whenever you&rsquo;re ready.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/">
          <Button>Back to my chart</Button>
        </Link>
        <Link to="/my-reports">
          <Button variant="outline">My Reports</Button>
        </Link>
      </div>
    </main>
  );
}