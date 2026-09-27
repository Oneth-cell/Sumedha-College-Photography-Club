import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Sumedha College Photography Club",
  description: "Official Sumedha College Photography Club",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {children}

        <Footer />

        <Analytics />
      </body>
    </html>
  );
}