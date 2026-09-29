import type { Metadata } from "next";
import { Instrument_Serif, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const sans = IBM_Plex_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Frontdoor",
  description:
    "Ask about any RealPage product. Get a cited answer, or get sent to the right owner. Built from public pages.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
