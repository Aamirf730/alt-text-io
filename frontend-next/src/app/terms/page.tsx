import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
                    <p className="text-gray-600 mb-8">Last updated: November 2024</p>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction and Acceptance</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Welcome to Alt Text Pro ("we," "our," or "us"). These Terms & Conditions ("Terms") govern your access to and use of our AI-powered alt-text generation service, including our website, API, and WordPress plugin (collectively, the "Service").
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                By accessing or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Alt Text Pro is an AI-powered service that automatically generates descriptive alt text for images using advanced AI technology. Our Service includes:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Web-based alt-text generation tool</li>
                                <li>RESTful API for programmatic access</li>
                                <li>WordPress plugin for automated alt-text generation</li>
                                <li>Support for over 130 languages</li>
                                <li>Bulk processing capabilities</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration and User Responsibilities</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                To use our Service, you must:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mb-4">
                                <li>Create an account with a valid email address</li>
                                <li>Provide accurate and complete information</li>
                                <li>Maintain the security of your account credentials</li>
                                <li>Be at least 18 years old or have parental consent</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed">
                                You are responsible for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription Plans and Pricing</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We offer the following subscription plans:
                            </p>
                            <div className="bg-gray-50 rounded-lg p-6 mb-4">
                                <ul className="space-y-3 text-gray-700">
                                    <li><strong>Free Plan:</strong> $0/month - 30 credits per month</li>
                                    <li><strong>Lite:</strong> $3/month ($30/year) - 150 images per month</li>
                                    <li><strong>Standard:</strong> $5/month ($48/year) - 400 images per month</li>
                                    <li><strong>Pro:</strong> $9/month ($86/year) - 1,000 images per month</li>
                                    <li><strong>Pay as you go:</strong> $5 for 100 images or $10 for 250 images (never expire)</li>
                                </ul>
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                                All prices are in USD. Subscription plans renew automatically on a monthly basis unless cancelled. Credits reset at the beginning of each billing cycle for subscription plans. One-time credit packs do not expire.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Payments are processed securely through Polar.sh. By subscribing, you authorize us to charge your payment method for the subscription fee on a recurring basis.
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Subscription fees are charged in advance for each billing period</li>
                                <li>One-time payments are charged immediately upon purchase</li>
                                <li>All fees are non-refundable except as required by law</li>
                                <li>If payment fails, your account may be suspended until payment is received</li>
                                <li>We reserve the right to change our pricing with 30 days' notice</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Cancellation and Refund Policy</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                You may cancel your subscription at any time through your dashboard or by contacting us. Cancellation will take effect at the end of your current billing period.
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>No refunds are provided for partial billing periods</li>
                                <li>Unused credits expire at the end of the billing period for subscription plans</li>
                                <li>One-time credit packs are non-refundable</li>
                                <li>Refunds may be provided at our sole discretion in exceptional circumstances</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. API Usage Terms</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                If you use our API:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>You must keep your API key secure and confidential</li>
                                <li>You are responsible for all API usage under your account</li>
                                <li>You must not share your API key with third parties</li>
                                <li>You must comply with rate limits and usage restrictions</li>
                                <li>We reserve the right to revoke API access for violations of these Terms</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. WordPress Plugin Usage</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Our WordPress plugin is provided "as is" for use with WordPress websites. By using the plugin:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>You must have a valid Alt Text Pro account with active credits</li>
                                <li>You are responsible for ensuring the plugin is compatible with your WordPress installation</li>
                                <li>We are not responsible for any issues arising from plugin conflicts or WordPress updates</li>
                                <li>The plugin may be updated or discontinued at any time</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Prohibited Uses</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                You agree not to:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Use the Service for any illegal or unauthorized purpose</li>
                                <li>Violate any laws in your jurisdiction</li>
                                <li>Infringe upon the intellectual property rights of others</li>
                                <li>Attempt to reverse engineer or extract source code from the Service</li>
                                <li>Use automated systems to abuse or overload our Service</li>
                                <li>Share your account credentials with others</li>
                                <li>Use the Service to generate alt text for illegal, harmful, or offensive content</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Intellectual Property Rights</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                The Service, including all content, features, and functionality, is owned by Alt Text Pro and protected by international copyright, trademark, and other intellectual property laws.
                            </p>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Generated alt text is provided for your use, but you acknowledge that:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Alt text is generated using AI technology and may not always be accurate</li>
                                <li>You are responsible for reviewing and editing generated alt text as needed</li>
                                <li>We do not claim ownership of the alt text generated for your images</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Limitation of Liability</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALT TEXT PRO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                Our total liability for any claims arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim. We are not responsible for the accuracy, quality, or appropriateness of AI-generated alt text.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Service Modifications and Termination</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We reserve the right to:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Modify, suspend, or discontinue the Service at any time</li>
                                <li>Change features, pricing, or availability without prior notice</li>
                                <li>Terminate or suspend your account for violations of these Terms</li>
                                <li>Refuse service to anyone for any reason</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law and Disputes</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                Any disputes arising from these Terms or the Service shall be resolved through binding arbitration or in the courts of the United States.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
                            <p className="text-gray-700 leading-relaxed">
                                If you have any questions about these Terms, please contact us at:
                            </p>
                            <p className="text-gray-700 leading-relaxed mt-2">
                                <strong>Email:</strong> help@alt-text.pro<br />
                                <strong>Website:</strong> <Link href="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Changes to Terms</h2>
                            <p className="text-gray-700 leading-relaxed">
                                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
