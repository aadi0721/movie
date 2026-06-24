import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [{ title: "About Us — MOVIESALERT" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-32 min-h-screen">
      <h1 className="text-4xl font-bold tracking-tight mb-8">About Us</h1>
      <div className="prose prose-invert prose-lg max-w-none">
        <p className="text-muted-foreground">
          Welcome to MOVIESALERT. Content for this page will be added soon.
        </p>
      </div>
    </div>
  );
}
