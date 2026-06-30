import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-8">About Us</h1>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <p className="text-xl text-gray-600 leading-relaxed">
                                Alt Text Pro is dedicated to making the web more accessible for everyone. Our mission is to help website owners, developers, and content creators ensure their images are properly described for screen readers and search engines.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
                            <p className="text-gray-700 leading-relaxed">
                                We believe that accessibility shouldn't be an afterthought or a difficult technical hurdle. By leveraging advanced AI technology, we automate the process of generating accurate, descriptive alternative text for images, saving time while improving web accessibility compliance (WCAG) and SEO performance.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Why Accessibility Matters</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Millions of people rely on screen readers to navigate the web. Without proper alt text, images are invisible to these users. We are committed to bridging this gap by providing tools that make it effortless to add high-quality descriptions to every image on your website.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">The Team</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Alt Text Pro is built by a team of passionate developers and accessibility advocates. We are constantly refining our AI models and plugins to provide the best possible experience for our users and, ultimately, for the users of the websites we help improve.
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
            </div>
            <Footer />
        </div>
    );
}
