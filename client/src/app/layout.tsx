import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ReactQueryProvider from "@/providers/react-query-provider";
import Navbar from "@/components/navbar";
import RouteGuard from "@/components/route-guard";
import Footer from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CMS Hub",
  description: "IFFA CMS Hub",
  icons: {
    icon: "/CMSfavicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <Navbar />
          <main className="pt-20">
            <RouteGuard>{children}</RouteGuard>
          </main>
          <Footer />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
