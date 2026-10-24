import type { Metadata } from "next";

const title = "Alt Text Pro Docs: Setup, Bulk Runs, Credits and API";
const description =
    "How to install and connect the Alt Text Pro WordPress plugin, generate your first alt text, run bulk fixes, understand credits, and use the API.";

export const metadata: Metadata = {
    title,
    description,
    openGraph: {
        title,
        description,
        url: "https://www.alt-text.pro/docs",
        siteName: "Alt Text Pro",
        type: "website",
    },
};

export default function DocsLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
