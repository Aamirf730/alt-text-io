import React from 'react';
import { Link } from 'react-router-dom';

const AboutPage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Navigation Header */}
            <nav className="sticky top-0 z-50 py-4">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div className="flex items-center justify-between h-12">
                            <div className="flex items-center">
                                <Link to="/" className="flex items-center space-x-3">
                                    <img
                                        src="/logo-alt-text-pro.png"
                                        alt="Alt Text Pro Logo"
                                        className="h-10 w-10 object-contain"
                                    />
                                    <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                                </Link>
                            </div>
                            <div className="hidden lg:flex items-center space-x-12">
                                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

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
                                <strong>Email:</strong> help@wpgeared.com<br />
                                <strong>Website:</strong> <Link to="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
