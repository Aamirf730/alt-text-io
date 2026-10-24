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
  title: "Alt Text Pro | AI Alt Text Plugin for WordPress",
  description: "Alt Text Pro drafts alt text for your WordPress images. Review and edit each one, or fix a whole media library. Start with 150 free credits.",
  openGraph: {
    title: "Alt Text Pro | AI Alt Text Plugin for WordPress",
    description: "Alt Text Pro drafts alt text for your WordPress images. Review and edit each one, or fix a whole media library. Start with 150 free credits.",
    siteName: "Alt Text Pro",
    type: "website",
  },
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
