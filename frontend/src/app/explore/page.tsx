import { DestinationWorkspace } from "@/components/destination-workspace";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim().slice(0, 160);
  return <DestinationWorkspace key={query} initialQuery={query} />;
}