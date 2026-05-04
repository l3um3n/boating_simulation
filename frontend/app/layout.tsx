import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boating Simulator",
  description:
    "Top-down sailing simulator. Trim your sail, find the broad reach, beat the polar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-display antialiased">{children}</body>
    </html>
  );
}
