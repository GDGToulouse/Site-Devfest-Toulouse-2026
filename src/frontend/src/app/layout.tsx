import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s — DevFest Toulouse 2026",
    default: "DevFest Toulouse 2026",
  },
  description:
    "La plus grande conférence tech du bassin Toulousain — 19 novembre 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
