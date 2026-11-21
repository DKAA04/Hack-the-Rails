import type { Metadata } from "next";
import { ResultsView } from "../../../features/comparison/results-view";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ params }: { params: Promise<{ searchId: string }> }) {
  const { searchId } = await params;
  return <ResultsView searchId={decodeURIComponent(searchId)} />;
}
