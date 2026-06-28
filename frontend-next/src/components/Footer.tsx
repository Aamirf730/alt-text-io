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
                            Automatically generate accurate descriptions for your images. Improve accessibility and SEO in seconds.
                        </p>
                    </div>

                    {/* Trust Signals */}
                    <div className="flex flex-col items-center space-y-6">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Trusted & Secure</span>
                        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
                            {/* AWS Logo */}
                            <div className="flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
                                <img src="/logos/aws.svg" alt="AWS" className="h-8 max-w-[80px] object-contain" />
                            </div>

                            {/* Stripe Logo */}
                            <div className="flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
                                <img src="/logos/stripe.svg" alt="Stripe" className="h-8 max-w-[80px] object-contain" />
                            </div>

                            {/* SOC2 Compliant Badge */}
                            <div className="flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-slate-800 bg-white shadow-sm">
                                    <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-[8px] tracking-wider leading-none">SOC2</span>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm tracking-wide leading-none">COMPLIANT</span>
                                </div>
                            </div>

                            {/* WordPress Logo */}
                            <div className="flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
                                <img src="/logos/wordpress.svg" alt="WordPress" className="h-9 max-w-[120px] object-contain" />
                            </div>
                        </div>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-base font-medium text-gray-500">
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
