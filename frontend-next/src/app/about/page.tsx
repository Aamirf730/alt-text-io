import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-8">About Alt Text Pro</h1>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <p className="text-xl text-gray-600 leading-relaxed">
                                Alt Text Pro helps WordPress site owners create editable alt-text drafts for images that are missing useful descriptions.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Our goal is to reduce the repetitive work of drafting image descriptions while keeping people in control of the final wording. The service combines an AI generation API, a WordPress plugin, bulk-processing controls, and a dashboard for credits and billing.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Why Accessibility Matters</h2>
                            <p className="text-gray-700 leading-relaxed">
                                People who use screen readers depend on useful text alternatives when an image carries meaning. AI can provide a starting point, but the right alt text depends on the image's purpose and page context. Important images should always be reviewed before publishing.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How the Product Is Designed</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Generated text stays editable, failed generation requests do not consume credits, and bulk runs can be stopped after the current image. Alt Text Pro supports accessibility work; it does not guarantee legal compliance, search rankings, or error-free AI output.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
                            <p className="text-gray-700 leading-relaxed">
                                We'd love to hear from you. Whether you have questions, feedback, or just want to say hello, please feel free to reach out.
                            </p>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                <strong>Email:</strong> help@alt-text.pro<br />
                                <strong>Website:</strong> <Link href="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
