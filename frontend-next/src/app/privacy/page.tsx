import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
    title: "Privacy Policy | Alt Text Pro",
    description:
        "What Alt Text Pro collects when you use the website, plugin and API, how images are processed, who processes data for us, and your rights.",
    openGraph: {
        title: "Privacy Policy | Alt Text Pro",
        description:
            "What Alt Text Pro collects when you use the website, plugin and API, how images are processed, who processes data for us, and your rights.",
        url: "https://www.alt-text.pro/privacy",
        siteName: "Alt Text Pro",
        type: "website",
    },
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-yellow-tint">
            <Navbar />

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="bg-white backdrop-blur-xl border border-line rounded-2xl p-8 md:p-16 shadow-notebook-lg relative overflow-hidden group">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-brand-yellow/5 rounded-full blur-3xl transition-all duration-700 group-hover:bg-brand-yellow/10"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-brand-yellow/5 rounded-full blur-3xl transition-all duration-700 group-hover:bg-brand-yellow/10"></div>

                    <div className="relative z-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4 tracking-tight">Privacy Policy</h1>
                        <p className="text-ink-muted mb-12 font-medium tracking-wide">Last updated: October 29, 2026</p>

                        <div className="prose prose-slate max-w-none space-y-12">
                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">1. Introduction</h2>
                                <p className="text-ink-muted leading-relaxed">
                                    Alt Text Pro ("we," "our," or "us"), based in India, is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered alt-text generation service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">2. Information We Collect</h2>
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">2.1 Account Information</h3>
                                        <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                            <li>Email address (required for account creation)</li>
                                            <li>Password (stored in encrypted/hashed format)</li>
                                            <li>Account creation date and last login information</li>
                                            <li>If you sign in with Google: the name, email address, profile picture link and Google account ID that Google shares with your permission</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">2.2 Payment Information</h3>
                                        <p className="text-ink-muted leading-relaxed mb-4">
                                            Payment processing is handled by Polar.sh, our payment provider. We do not store your credit card or payment account details. Polar.sh may share transaction information with us, including:
                                        </p>
                                        <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                            <li>Payment amount and currency</li>
                                            <li>Transaction date and status</li>
                                            <li>Subscription plan information</li>
                                            <li>Transaction IDs</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">2.3 Usage Data</h3>
                                        <p className="text-ink-muted leading-relaxed mb-4">
                                            We collect information about how you use our Service:
                                        </p>
                                        <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                            <li>Number of images processed</li>
                                            <li>Credits used and remaining</li>
                                            <li>API usage statistics</li>
                                            <li>Subscription plan and status</li>
                                            <li>Website and dashboard events such as page views, demo usage, signup, checkout, purchase, plugin download clicks, first web app image generation, and low-credit notices</li>
                                            <li>WordPress plugin connection status when an API key is successfully validated by our service</li>
                                        </ul>
                                        <p className="text-ink-muted leading-relaxed mt-4">
                                            The WordPress plugin does not send non-essential wp-admin marketing or funnel telemetry. It contacts Alt Text Pro only for service functions such as API key validation, alt text generation, credit checks, and subscription-related requests that are required to provide the service. When API key validation succeeds, Alt Text Pro may record that the account connected the plugin.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">2.4 Technical Information</h3>
                                        <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                            <li>IP address</li>
                                            <li>Browser type and version</li>
                                            <li>Device information</li>
                                            <li>API credentials and validation records used to authenticate service requests</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">3. How We Use Your Information</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    We use the information we collect to:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li>Provide, maintain, and improve our Service</li>
                                    <li>Process payments and manage subscriptions</li>
                                    <li>Send service-related communications (account updates, billing notices)</li>
                                    <li>Respond to your inquiries and provide customer support</li>
                                    <li>Monitor and analyze usage patterns to improve our Service</li>
                                    <li>Send lifecycle and onboarding emails related to account setup, checkout recovery, purchases, and credit status</li>
                                    <li>Detect, prevent, and address technical issues or security threats</li>
                                    <li>Comply with legal obligations</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">4. Data Storage</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    Account, billing, usage, and service records are stored using Supabase, a cloud database and authentication platform. We use:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li>Secure authentication and authorization</li>
                                    <li>Database access controls</li>
                                    <li>Managed backups and service availability features</li>
                                </ul>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    Data may be stored or processed in regions used by Supabase and our other service providers. See the international-transfer section below.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">5. Third-Party Services</h2>
                                <p className="text-ink-muted leading-relaxed mb-6">
                                    We use the following third-party services that may process your data:
                                </p>

                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.1 Supabase</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            We use Supabase for user authentication, database storage, and user management. Supabase's privacy policy applies to data stored in their systems.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.2 Polar.sh</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            Payment processing is handled by Polar.sh. When you make a payment, Polar.sh collects and processes your payment information according to their privacy policy. We receive transaction details but not your full payment credentials.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.3 Netlify</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            We use Netlify to host the website and run server-side service functions. Netlify may process request metadata, logs, and network information needed to deliver and protect the Service.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.4 Google Gemini</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            We use Google's Gemini service to generate alt text. When you request a generation, the submitted image and any optional context are sent to Google for processing under Google's applicable service terms and privacy commitments. Alt Text Pro does not intentionally store the submitted image binary in its application database after the request completes.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.5 Upstash</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            When configured, Upstash provides distributed request-rate limiting. It receives short-lived quota keys derived from request or credential identifiers and the timing needed to enforce service limits; raw API keys are not used as Redis keys.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.6 Sentry</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            When error monitoring is enabled, Sentry receives technical error details needed to diagnose service failures. Authorization headers, cookies, request bodies, query strings, user identity, and IP tags are removed from the events we send.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.7 Email delivery</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            We send email through Google (Gmail), which processes recipient addresses and message content for account, lifecycle, support, and service communications. This includes the confirmation and password reset emails that Supabase sends for us. Our emails are sent from help@alt-text.pro, and Google&apos;s privacy policy applies to their delivery.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-ink mb-3">5.8 Google Sign-In</h3>
                                        <p className="text-ink-muted leading-relaxed">
                                            If you choose to sign in with Google, Google confirms your identity and shares the account details listed in section 2.1 with us. Google&apos;s privacy policy applies to the sign-in itself. We do not receive your Google password.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">6. Data Security</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    We implement appropriate technical and organizational measures to protect your personal information:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                                    <li>Secure password hashing (passwords are never stored in plain text)</li>
                                    <li>Access controls and authentication requirements</li>
                                    <li>API key security and rotation</li>
                                </ul>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">7. Your Rights and Choices</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    Depending on your location, you may have the following rights regarding your personal information:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                                    <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                                    <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
                                    <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                                    <li><strong>Objection:</strong> Object to certain processing of your information</li>
                                    <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
                                </ul>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    To exercise these rights, please contact us at help@alt-text.pro. We will respond to your request within 30 days.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">8. Data Retention</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    We retain your personal information for as long as necessary to:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li>Provide our Service to you</li>
                                    <li>Comply with legal obligations</li>
                                    <li>Resolve disputes and enforce our agreements</li>
                                </ul>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or legitimate business purposes.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">9. Cookies and Tracking</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    We use cookies and similar tracking technologies to:
                                </p>
                                <ul className="list-disc list-inside text-ink-muted space-y-2 ml-4">
                                    <li>Maintain your login session</li>
                                    <li>Remember your preferences</li>
                                    <li>Analyze website and dashboard usage and performance</li>
                                </ul>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    Website, dashboard, and service-side connection events may include an anonymous browser identifier where applicable, account email or user ID when you are signed in or validating an API key, page path, referrer, event timestamp, browser user agent, and IP address. These events are used for product analytics, onboarding, lifecycle emails, abuse prevention, and service improvement.
                                </p>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    The WordPress plugin itself does not send connect, bulk-processing, or other non-essential wp-admin marketing events.
                                </p>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    The website does not load Meta Pixel or another third-party advertising pixel. Product events described above are sent to Alt Text Pro's own service endpoint.
                                </p>
                                <p className="text-ink-muted leading-relaxed mt-4">
                                    You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our Service.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">10. Children's Privacy</h2>
                                <p className="text-ink-muted leading-relaxed">
                                    Our Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately, and we will delete such information.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">11. International Data Transfers</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
                                </p>
                                <p className="text-ink-muted leading-relaxed">
                                    Our providers may rely on contractual or other transfer mechanisms available to them. The transfer terms and safeguards that apply to the operator should be reviewed for the jurisdictions in which the Service is offered.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">12. Changes to This Privacy Policy</h2>
                                <p className="text-ink-muted leading-relaxed mb-4">
                                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                                </p>
                                <p className="text-ink-muted leading-relaxed">
                                    You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-ink mb-4 tracking-tight">13. Contact Us</h2>
                                <div className="bg-yellow-tint/50 rounded-2xl p-8 border border-line">
                                    <p className="text-ink-muted leading-relaxed">
                                        If you have any questions about this Privacy Policy, please contact us at:
                                    </p>
                                    <p className="text-ink-muted leading-relaxed mt-6 flex flex-col gap-2">
                                        <span className="flex items-center gap-2">
                                            <strong className="text-ink">Operator:</strong>
                                            Alt Text Pro, India
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <strong className="text-ink">Email:</strong>
                                            <a href="mailto:help@alt-text.pro" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink transition-colors">help@alt-text.pro</a>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <strong className="text-ink">Website:</strong>
                                            <Link href="/contact" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink transition-colors">www.alt-text.pro/contact</Link>
                                        </span>
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
