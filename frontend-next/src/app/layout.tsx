import type { Metadata } from "next";
import { Inter, Lato, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.alt-text.pro"),
  title: "Alt Text Pro | AI Alt Text Generator for WordPress",
  description: "Generate AI alt text for WordPress images, bulk-fix missing media-library alt text, and improve accessibility with 150 free signup credits plus 15 every month.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} ${lato.variable} antialiased font-sans bg-white selection:bg-yellow-soft`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
