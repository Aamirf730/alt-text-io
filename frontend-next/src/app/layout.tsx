import type { Metadata } from "next";
import { Inter, Lato } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import TawkToWidget from "@/components/TawkToWidget";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "Alt Text Generator",
  description: "Generate alt text for your images automatically.",
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
        className={`${inter.variable} ${lato.variable} antialiased font-sans`}
      >
        {children}
        <Toaster />
        <TawkToWidget />
      </body>
    </html>
  );
}
