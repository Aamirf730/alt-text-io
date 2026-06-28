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
  description: "Generate AI alt text for WordPress images, bulk-fix missing media-library alt text, and improve accessibility with 30 free credits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${lato.variable} antialiased font-sans bg-notebook-paper selection:bg-notebook-blue/10`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
