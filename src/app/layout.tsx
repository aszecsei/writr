import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Averia_Serif_Libre,
  Courier_Prime,
  Crimson_Pro,
  EB_Garamond,
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lexend,
  Literata,
  Lora,
  Lusitana,
  Merriweather,
  Source_Sans_3,
  Spectral,
} from "next/font/google";
import Script from "next/script";
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

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const averiaSerifLibre = Averia_Serif_Libre({
  variable: "--font-averia-serif-libre",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
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
  courierPrime.variable,
  jetbrainsMono.variable,
  ebGaramond.variable,
  crimsonPro.variable,
  spectral.variable,
  averiaSerifLibre.variable,
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${literaryFontVars} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
