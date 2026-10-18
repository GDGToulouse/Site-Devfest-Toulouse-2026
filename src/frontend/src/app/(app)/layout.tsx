import { googleSans } from "../fonts";
import "../globals.css";

// Root layout of the application screens: back-office, sponsor space, speaker
// edit link, agent connection. They are mono-language, so the language is a
// constant. It used to be read from the request headers, which made every route
// of the app dynamic, the public pages included (#700): the public site now has
// its own root layout, [locale]/layout.tsx, whose language comes from the URL.
export default function AppRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`h-full antialiased ${googleSans.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
