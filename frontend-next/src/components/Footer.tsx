import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="relative py-20 bg-white border-t border-line overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col items-center text-center space-y-12">
                    {/* Logo & Company Info */}
                    <div className="flex flex-col items-center space-y-6">
                        <div className="flex items-center gap-3">
                            <Image
                                src="/brand/logo-mark.svg"
                                alt=""
                                width={48}
                                height={48}
                                unoptimized
                                className="h-12 w-12 shrink-0"
                            />
                            <span className="text-3xl font-bold leading-none text-ink tracking-tight font-outfit">Alt Text Pro</span>
                        </div>
                        <p className="text-ink-muted text-lg max-w-lg leading-relaxed">
                            Generate useful, editable image descriptions inside WordPress, then review each result before saving it.
                        </p>
                    </div>

                    {/* Verified platform information */}
                    <div className="flex flex-col items-center space-y-6">
                        <span className="label-caps">Platform information</span>
                        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                            <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-line-strong hover:bg-yellow-tint">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-tint p-1">
                                    <Image src="/logos/wordpress-w.png" alt="WordPress" width={44} height={44} className="h-10 w-10 object-contain" />
                                </span>
                                <span>
                                    <span className="label-caps block">Available on</span>
                                    <span className="block text-sm font-semibold text-ink group-hover:underline underline-offset-4">WordPress.org</span>
                                </span>
                            </a>
                            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-yellow-tint p-0.5">
                                    <Image src="/logos/polar-app-icon.png" alt="Polar" width={46} height={46} className="h-11 w-11 rounded-lg object-contain" />
                                </span>
                                <span>
                                    <span className="label-caps block">Payments by</span>
                                    <span className="block text-sm font-semibold text-ink">Polar.sh</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-soft text-ink">
                                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="label-caps block">Protected</span>
                                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />Secure connection</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-base font-medium text-ink-muted">
                        <Link href="/ai-alt-text-generator-for-wordpress" className="hover:text-ink hover:underline underline-offset-4 transition-colors">AI Alt Text Guide</Link>
                        <Link href="/woocommerce-product-image-alt-text" className="hover:text-ink hover:underline underline-offset-4 transition-colors">WooCommerce Guide</Link>
                        <Link href="/bulk-generate-alt-text-wordpress" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Bulk Alt Text Guide</Link>
                        <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline underline-offset-4 transition-colors">WordPress Plugin</a>
                        <Link href="/contact" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Contact</Link>
                        <Link href="/alt-text-simulator" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Simulator</Link>
                        <Link href="/terms" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Privacy</Link>
                        <Link href="/docs" className="hover:text-ink hover:underline underline-offset-4 transition-colors">Documentation</Link>
                    </div>

                    {/* Copyright */}
                    <div className="pt-12 border-t border-line w-full max-w-4xl flex flex-col items-center">
                        <p className="text-ink-muted text-sm">
                            © {new Date().getFullYear()} Alt Text Pro. Built for accessibility.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
