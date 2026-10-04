import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VENT — Talk it out",
  description: "A private voice-first journal that listens before it speaks.",
  applicationName: "VENT",
};

export const viewport: Viewport = { themeColor: "#26372f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
