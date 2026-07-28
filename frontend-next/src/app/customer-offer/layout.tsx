import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "WPGeared Customer Gift | Alt Text Pro",
    description: "Claim your invited WPGeared customer bonus for Alt Text Pro.",
    robots: {
        index: false,
        follow: false,
    },
};

export default function CustomerOfferLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
