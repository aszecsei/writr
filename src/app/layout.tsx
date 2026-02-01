import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Geist,
  Geist_Mono,
  Inter,
  Lexend,
  Literata,
  Lora,
  Lusitana,
  Merriweather,
  Source_Sans_3,
} from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Literary fonts
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

const lusitana = Lusitana({
  variable: "--font-lusitana",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

const literaryFontVars = [
  literata.variable,
  lusitana.variable,
  lora.variable,
  merriweather.variable,
  inter.variable,
  sourceSans.variable,
  lexend.variable,
  atkinson.variable,
].join(" ");

export const metadata: Metadata = {
  title: "writr",
  description: "A long-form writing tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${literaryFontVars} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
