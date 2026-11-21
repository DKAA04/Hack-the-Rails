import type { Metadata } from "next";
import { TripWorkspace } from "../../features/trip/trip-workspace";

export const metadata: Metadata = { title: "Your trip" };

export default function TripPage() {
  return <TripWorkspace />;
}
