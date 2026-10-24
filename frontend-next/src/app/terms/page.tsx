import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@/lib/pricing-catalog';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-yellow-tint">
            <Navbar />

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl border border-line shadow-notebook p-8 md:p-12">
                    <h1 className="text-4xl font-bold text-ink mb-2">Terms & Conditions</h1>
                    <p className="text-ink-muted mb-8">Last updated: August 11, 2026</p>

                    <div className="prose prose-lg max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">1. Introduction and Acceptance</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                Welcome to Alt Text Pro ("we," "our," or "us"). These Terms & Conditions ("Terms") govern your access to and use of our AI-powered alt-text generation service, including our website, API, and WordPress plugin (collectively, the "Service").
                            </p>
                            <p className="text-ink leading-relaxed">
                                By accessing or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">2. Service Description</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                Alt Text Pro is an AI-assisted service that generates editable alt-text drafts for images. Our Service includes:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>Web-based alt-text generation tool</li>
                                <li>RESTful API for programmatic access</li>
                                <li>WordPress plugin for automated alt-text generation</li>
                                <li>Review and editing controls for generated suggestions</li>
                                <li>Bulk processing capabilities</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">3. Account Registration and User Responsibilities</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                To use our Service, you must:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4 mb-4">
                                <li>Create an account with a valid email address</li>
                                <li>Provide accurate and complete information</li>
                                <li>Maintain the security of your account credentials</li>
                                <li>Be at least 18 years old</li>
                            </ul>
                            <p className="text-ink leading-relaxed">
                                You are responsible for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">4. Subscription Plans and Pricing</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                We offer the following subscription plans:
                            </p>
                            <div className="bg-yellow-tint rounded-lg p-6 mb-4">
                                <ul className="space-y-3 text-ink">
                                    {SUBSCRIPTION_PLANS.map((plan) => (
                                        <li key={plan.id}>
                                            <strong>{plan.name}:</strong>{' '}
                                            {plan.id === 'free'
                                                ? '$0/month — 15 credits per month, plus a one-time 150-credit signup bonus that does not expire'
                                                : `${plan.monthlyPrice}/month (${plan.annualPrice}/year) — ${plan.creditCount.toLocaleString()} credits per month`}
                                        </li>
                                    ))}
                                    {CREDIT_PACKS.map((pack) => (
                                        <li key={pack.id}>
                                            <strong>{pack.name}:</strong> {pack.price} for {pack.creditCount.toLocaleString()} credits (one-time; available on every plan; credits do not expire)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-ink leading-relaxed">
                                All prices are in USD. Subscriptions renew automatically on the monthly or annual billing schedule selected at checkout unless cancelled. Subscription credit allowances refresh monthly, including on annual plans. Existing subscribers keep the price and monthly credit allowance of the plan they purchased for as long as that subscription remains active. Signup bonus credits and purchased credit packs never expire and are not reset by a subscription credit refresh.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">5. Payment Terms</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                Payments are processed securely through Polar.sh. By subscribing, you authorize us to charge your payment method for the subscription fee on a recurring basis.
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>Subscription fees are charged in advance for each billing period</li>
                                <li>One-time payments are charged immediately upon purchase</li>
                                <li>All fees are non-refundable except as required by law</li>
                                <li>If payment fails, your account may be suspended until payment is received</li>
                                <li>We reserve the right to change our pricing with 30 days' notice</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">6. Cancellation and Refund Policy</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                You may cancel your subscription at any time through your dashboard or by contacting us. Cancellation will take effect at the end of your current billing period.
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>No refunds are provided for partial billing periods</li>
                                <li>Unused monthly subscription credits reset at the next monthly credit refresh</li>
                                <li>One-time credit packs are generally non-refundable after credits are used, except where required by law or an approved refund is issued</li>
                                <li>Approved refunds may revoke the related unused credits or subscription benefits</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">7. API Usage Terms</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                If you use our API:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>You must keep your API key secure and confidential</li>
                                <li>You are responsible for all API usage under your account</li>
                                <li>You must not share your API key with third parties</li>
                                <li>You must comply with rate limits and usage restrictions</li>
                                <li>We reserve the right to revoke API access for violations of these Terms</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">8. WordPress Plugin Usage</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                Our WordPress plugin is provided "as is" for use with WordPress websites. By using the plugin:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>You must have a valid Alt Text Pro account with active credits</li>
                                <li>You are responsible for ensuring the plugin is compatible with your WordPress installation</li>
                                <li>We are not responsible for any issues arising from plugin conflicts or WordPress updates</li>
                                <li>The plugin may be updated or discontinued at any time</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">9. Prohibited Uses</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                You agree not to:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>Use the Service for any illegal or unauthorized purpose</li>
                                <li>Violate any laws in your jurisdiction</li>
                                <li>Infringe upon the intellectual property rights of others</li>
                                <li>Attempt to bypass or reverse engineer the hosted Service, except where applicable law or an open-source license expressly permits it</li>
                                <li>Use automated systems to abuse or overload our Service</li>
                                <li>Share your account credentials with others</li>
                                <li>Use the Service to generate alt text for illegal, harmful, or offensive content</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">10. Intellectual Property Rights</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                The Service, including all content, features, and functionality, is owned by Alt Text Pro and protected by international copyright, trademark, and other intellectual property laws.
                            </p>
                            <p className="text-ink leading-relaxed mb-4">
                                Generated alt text is provided for your use, but you acknowledge that:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>Alt text is generated using AI technology and may not always be accurate</li>
                                <li>You are responsible for reviewing and editing generated alt text as needed</li>
                                <li>We do not claim ownership of the alt text generated for your images</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">11. Limitation of Liability</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALT TEXT PRO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
                            </p>
                            <p className="text-ink leading-relaxed">
                                Our total liability for any claims arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim. We are not responsible for the accuracy, quality, or appropriateness of AI-generated alt text.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">12. Service Modifications and Termination</h2>
                            <p className="text-ink leading-relaxed mb-4">
                                We reserve the right to:
                            </p>
                            <ul className="list-disc list-inside text-ink space-y-2 ml-4">
                                <li>Modify, suspend, or discontinue the Service at any time</li>
                                <li>Change features, pricing, or availability prospectively, with notice where required by law or these Terms</li>
                                <li>Terminate or suspend your account for violations of these Terms</li>
                                <li>Restrict service when reasonably necessary for security, abuse prevention, legal compliance, or enforcement of these Terms</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">13. Contact Information</h2>
                            <p className="text-ink leading-relaxed">
                                If you have any questions about these Terms, please contact us at:
                            </p>
                            <p className="text-ink leading-relaxed mt-2">
                                <strong>Email:</strong> help@alt-text.pro<br />
                                <strong>Website:</strong> <Link href="/contact" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">www.alt-text.pro/contact</Link>
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-ink mb-4">14. Changes to Terms</h2>
                            <p className="text-ink leading-relaxed">
                                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
