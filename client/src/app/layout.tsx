import type { Metadata } from "next";
import { Archivo, Newsreader, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/providers/react-query-provider";
import Navbar from "@/components/navbar";
import RouteGuard from "@/components/route-guard";
import Footer from "@/components/footer";

/**
 * Three faces, three jobs.
 *
 * Archivo is the system: nav, labels, buttons, table headers. It's a grotesque
 * with enough width variation to stay legible in dense table chrome.
 *
 * Newsreader is the content — film titles, and nothing else. `font-serif` was
 * already used in 54 places but no serif was ever registered, so every title
 * had been falling back to Times New Roman.
 *
 * Geist Mono is for identifiers that really are identifiers: the 8-hex asset
 * refs, durations, timestamps.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CMS Hub",
  description: "IFFA CMS Hub",
  icons: {
    icon: "/CMSfavicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${newsreader.variable} ${geistMono.variable} font-sans antialiased min-h-svh flex flex-col`}
      >
        <ReactQueryProvider>
          <Navbar />
          {/* Offset comes from --header-h, which navbar.tsx measures and
              republishes on resize. The old `pt-20` was a guess at the
              header's height and stopped matching it at small widths. */}
          <div className="flex-1 flex flex-col pt-[var(--header-h)]">
            <RouteGuard>{children}</RouteGuard>
          </div>
          <Footer />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
