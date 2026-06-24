import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dmca")({
  head: () => ({
    meta: [{ title: "DMCA — MOVIESALERT" }],
  }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-32 min-h-screen">
      <h1 className="text-4xl font-bold tracking-tight mb-8">DMCA Notice</h1>
      <div className="prose prose-invert prose-lg max-w-none text-muted-foreground">
        <p className="mb-4">
          MOVIESALERT does not host any files, it merely pulls streams from 3rd party services. 
          Legal issues should be taken up with the file hosts and providers. 
          MOVIESALERT is not responsible for any media files shown by the video providers.
        </p>
        <p>
          More detailed DMCA policy will be added soon.
        </p>
      </div>
    </div>
  );
}
