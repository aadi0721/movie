import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — MOVIESALERT" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-32 min-h-screen">
      <h1 className="text-4xl font-bold tracking-tight mb-8">Terms of Service</h1>
      <div className="prose prose-invert prose-lg max-w-none text-muted-foreground">
        <p>
          Terms of Service content will be added here.
        </p>
      </div>
    </div>
  );
}
