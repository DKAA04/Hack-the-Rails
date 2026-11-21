import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Wayward ? Find your way through Europe",
  description:
    "One workspace for flights, trains, coaches, ferries and the connections between.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
