import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "VENT — a friend who listens",
  description: "A private voice-first journal that listens before it speaks.",
  applicationName: "VENT",
  appleWebApp: { capable: true, title: "VENT", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f8f6f0", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
