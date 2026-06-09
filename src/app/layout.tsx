import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CommandPalette } from "@/components/CommandPalette";
import { SmoothScroll } from "@/components/SmoothScroll";
import { UniversalCapture } from "@/components/UniversalCapture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Accumulate",
  description: "A minimal creative project archive.",
};

const themeScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("accumulate.theme");
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SmoothScroll>{children}</SmoothScroll>
        <UniversalCapture />
        <CommandPalette />
      </body>
    </html>
  );
}
