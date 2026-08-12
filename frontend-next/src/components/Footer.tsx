import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = () => {
    return (
        <footer className="relative py-20 bg-notebook-paper border-t border-gray-100 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col items-center text-center space-y-12">
                    {/* Logo & Company Info */}
                    <div className="flex flex-col items-center space-y-6">
                        <div className="flex items-center space-x-3">
                            <div className="relative w-14 h-14 flex items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-notebook">
                                <Image
                                    src="/logo-alt-text-pro.png"
                                    alt="Alt Text Pro Logo"
                                    width={36}
                                    height={36}
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-3xl font-bold text-notebook-slate tracking-tight font-outfit">Alt Text Pro</span>
                        </div>
                        <p className="text-gray-500 text-lg max-w-lg leading-relaxed">
                            Generate useful, editable image descriptions inside WordPress, then review each result before saving it.
                        </p>
                    </div>

                    {/* Verified platform information */}
                    <div className="flex flex-col items-center space-y-6">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Platform information</span>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-notebook-blue/30 hover:text-notebook-blue">
                                Available on WordPress.org
                            </a>
                            <span className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
                                Checkout processed by Polar.sh
                            </span>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-base font-medium text-gray-500">
                        <Link href="/ai-alt-text-generator-for-wordpress" className="hover:text-notebook-blue transition-colors">AI Alt Text Guide</Link>
                        <Link href="/woocommerce-product-image-alt-text" className="hover:text-notebook-blue transition-colors">WooCommerce Guide</Link>
                        <Link href="/bulk-generate-alt-text-wordpress" className="hover:text-notebook-blue transition-colors">Bulk Alt Text Guide</Link>
                        <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer" className="hover:text-notebook-blue transition-colors">WordPress Plugin</a>
                        <Link href="/contact" className="hover:text-notebook-blue transition-colors">Contact</Link>
                        <Link href="/alt-text-simulator" className="hover:text-notebook-blue transition-colors">Simulator</Link>
                        <Link href="/terms" className="hover:text-notebook-blue transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-notebook-blue transition-colors">Privacy</Link>
                        <Link href="/docs" className="hover:text-notebook-blue transition-colors">Documentation</Link>
                    </div>

                    {/* Copyright */}
                    <div className="pt-12 border-t border-gray-100 w-full max-w-4xl flex flex-col items-center">
                        <p className="text-gray-400 text-sm">
                            © {new Date().getFullYear()} Alt Text Pro. Built for accessibility.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
