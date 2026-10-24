import type { Metadata } from "next";

const title = "Alt Text Simulator: Hear the Difference | Alt Text Pro";
const description =
    "Compare an image with and without alt text. Hear what a screen reader says and see what text search engines can read from each version.";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://www.alt-text.pro/alt-text-simulator",
        siteName: "Alt Text Pro",
        type: "website",
    },
};

export default function AltTextSimulatorLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
