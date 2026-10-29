import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
    title: "About Alt Text Pro | AI Alt Text for WordPress Sites",
    description:
        "Alt Text Pro is a WordPress plugin and service that drafts image alt text with AI, so you can spend your time reviewing instead of writing from scratch.",
    openGraph: {
        title: "About Alt Text Pro | AI Alt Text for WordPress Sites",
        description:
            "Alt Text Pro is a WordPress plugin and service that drafts image alt text with AI, so you can spend your time reviewing instead of writing from scratch.",
        url: "https://www.alt-text.pro/about",
        siteName: "Alt Text Pro",
        type: "website",
    },
};

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-yellow-tint">
            <Navbar />

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl border border-line shadow-notebook p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-ink mb-8">About Alt Text Pro</h1>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <p className="text-xl text-ink-muted leading-relaxed">
                                Alt Text Pro is a WordPress plugin and a small web service. Together they draft alt text for the images in your media library, so you spend your time checking descriptions instead of writing each one from scratch.
                            </p>
                            <p className="text-ink leading-relaxed mt-4">
                                New here? Start with{" "}
                                <Link href="/ai-alt-text-generator-for-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">how it works in WordPress</Link>{" "}
                                or the <Link href="/docs" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">setup guide</Link>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">What we are building</h2>
                            <p className="text-ink leading-relaxed">
                                Writing alt text matters, and it is slow. We want to take away the slow part and leave the decisions with you. The plugin works inside WordPress. The service runs the AI model (Google Gemini) and handles your account, credits, and billing.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">Why alt text matters</h2>
                            <p className="text-ink leading-relaxed">
                                People who use screen readers hear alt text in place of an image. When it is missing, they miss whatever the image was there to show. Search engines also read alt text to understand images. AI gives you a solid first draft, but the right description depends on why the image is on the page, so review the important ones.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">What we promise, and what we don&apos;t</h2>
                            <p className="text-ink leading-relaxed">
                                Generated text is always editable. Failed requests never use credits. Bulk runs can be stopped after the current image. Your API key is stored encrypted in WordPress. Alt Text Pro helps with accessibility work, but it does not make a site accessible on its own, and it cannot promise search rankings or perfect descriptions.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">Contact Us</h2>
                            <p className="text-ink leading-relaxed">
                                Questions, feedback, or a bug to report? Email us or use the contact form.
                            </p>
                            <p className="text-ink leading-relaxed mt-4">
                                <strong>Operator:</strong> Alt Text Pro, India<br />
                                <strong>Email:</strong> help@alt-text.pro<br />
                                <strong>Website:</strong> <Link href="/contact" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">www.alt-text.pro/contact</Link>
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
