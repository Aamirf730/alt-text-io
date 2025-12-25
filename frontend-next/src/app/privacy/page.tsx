import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                    <p className="text-gray-600 mb-8">Last updated: November 2024</p>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Alt Text Pro ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered alt-text generation service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.1 Account Information</h3>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Email address (required for account creation)</li>
                                <li>Password (stored in encrypted/hashed format)</li>
                                <li>Account creation date and last login information</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.2 Payment Information</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Payment processing is handled by PayPal. We do not store your credit card or PayPal account details. PayPal may share transaction information with us, including:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Payment amount and currency</li>
                                <li>Transaction date and status</li>
                                <li>Subscription plan information</li>
                                <li>PayPal transaction IDs</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.3 Usage Data</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We collect information about how you use our Service:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Number of images processed</li>
                                <li>Credits used and remaining</li>
                                <li>API usage statistics</li>
                                <li>Subscription plan and status</li>
                                <li>Feature usage patterns</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.4 Technical Information</h3>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>IP address</li>
                                <li>Browser type and version</li>
                                <li>Device information</li>
                                <li>API keys (for authenticated API access)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We use the information we collect to:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Provide, maintain, and improve our Service</li>
                                <li>Process payments and manage subscriptions</li>
                                <li>Send service-related communications (account updates, billing notices)</li>
                                <li>Respond to your inquiries and provide customer support</li>
                                <li>Monitor and analyze usage patterns to improve our Service</li>
                                <li>Detect, prevent, and address technical issues or security threats</li>
                                <li>Comply with legal obligations</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Storage</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Your data is stored securely using Supabase, a cloud-based database platform. Supabase provides:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Encrypted data storage</li>
                                <li>Secure authentication and authorization</li>
                                <li>Regular backups and data redundancy</li>
                                <li>Compliance with industry security standards</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                Data is stored in the United States, but may be processed in other jurisdictions as part of Supabase's global infrastructure.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Third-Party Services</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We use the following third-party services that may process your data:
                            </p>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.1 Supabase</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We use Supabase for user authentication, database storage, and user management. Supabase's privacy policy applies to data stored in their systems.
                            </p>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.2 PayPal</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Payment processing is handled by PayPal. When you make a payment, PayPal collects and processes your payment information according to their privacy policy. We receive transaction details but not your full payment credentials.
                            </p>

                            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.3 AI Technology</h3>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We use advanced AI technology to generate alt text for your images. When you submit an image for processing, it is sent to our AI service providers. Their privacy policies apply to data processed by their services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We implement appropriate technical and organizational measures to protect your personal information:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Encryption of data in transit (HTTPS/TLS)</li>
                                <li>Encryption of sensitive data at rest</li>
                                <li>Secure password hashing (passwords are never stored in plain text)</li>
                                <li>Regular security audits and updates</li>
                                <li>Access controls and authentication requirements</li>
                                <li>API key security and rotation</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Depending on your location, you may have the following rights regarding your personal information:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                                <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
                                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                                <li><strong>Objection:</strong> Object to certain processing of your information</li>
                                <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                To exercise these rights, please contact us at help@wpgeared.com. We will respond to your request within 30 days.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We retain your personal information for as long as necessary to:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Provide our Service to you</li>
                                <li>Comply with legal obligations</li>
                                <li>Resolve disputes and enforce our agreements</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or legitimate business purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We use cookies and similar tracking technologies to:
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                                <li>Maintain your login session</li>
                                <li>Remember your preferences</li>
                                <li>Analyze Service usage and performance</li>
                            </ul>
                            <p className="text-gray-700 leading-relaxed mt-4">
                                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
                            <p className="text-gray-700 leading-relaxed">
                                Our Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately, and we will delete such information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. International Data Transfers</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                By using our Service, you consent to the transfer of your information to the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place for such transfers.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to This Privacy Policy</h2>
                            <p className="text-gray-700 leading-relaxed mb-4">
                                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                            </p>
                            <p className="text-gray-700 leading-relaxed">
                                You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contact Us</h2>
                            <p className="text-gray-700 leading-relaxed">
                                If you have any questions about this Privacy Policy, please contact us at:
                            </p>
                            <p className="text-gray-700 leading-relaxed mt-2">
                                <strong>Email:</strong> help@wpgeared.com<br />
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
