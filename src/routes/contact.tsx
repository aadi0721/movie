import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [{ title: "Contact Us — MOVIESALERT" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-32 min-h-screen">
      <h1 className="text-4xl font-bold tracking-tight mb-8">Contact Us</h1>
      <div className="prose prose-invert prose-lg max-w-none">
        <p className="text-muted-foreground">
          Contact information will be provided here.
        </p>
      </div>
    </div>
  );
}
