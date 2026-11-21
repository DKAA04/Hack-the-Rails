import type { Metadata, Viewport } from "next";
import { AppShell } from "../components/app-shell";
import { TripProvider } from "../features/trip/store";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wayward: every way across Europe",
    template: "%s · Wayward",
  },
  description:
    "Compare flights, trains, coaches, ferries and the connections between, with straight answers about price, seller and transfers.",
};

export const viewport: Viewport = {
  themeColor: "#0b1630",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={fontVariables}>
      <body>
        <TripProvider>
          <AppShell>{children}</AppShell>
        </TripProvider>
      </body>
    </html>
  );
}
