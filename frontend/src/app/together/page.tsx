import { TogetherWorkspace } from "@/components/together-workspace";
import "./together.css";

export default async function TogetherPage({ searchParams }: { searchParams: Promise<{ destination?: string | string[] }> }) {
  const params = await searchParams;
  const destination = typeof params.destination === "string" ? params.destination.trim().slice(0, 160) : "";
  return <TogetherWorkspace initialDestination={destination} />;
}