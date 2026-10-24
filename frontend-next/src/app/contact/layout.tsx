import type { Metadata } from "next";

const title = "Contact Alt Text Pro | Support and Questions";
const description =
    "Questions about the Alt Text Pro WordPress plugin, your credits or billing? Send us a message or email help@alt-text.pro.";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://www.alt-text.pro/contact",
        siteName: "Alt Text Pro",
        type: "website",
    },
};

export default function ContactLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
