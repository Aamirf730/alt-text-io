import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = () => {
    return (
        <footer className="text-white py-12" style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center text-center space-y-6">
                    {/* Logo & Company Info */}
                    <div className="flex items-center space-x-2">
                        <img
                            src="/logo-alt-text-pro.png"
                            alt="Alt Text Pro Logo"
                            width={40}
                            height={40}
                            className="h-10 w-10 object-contain"
                        />
                        <span className="text-2xl font-bold text-white">Alt Text Pro</span>
                    </div>

                    <p className="text-gray-200 text-sm max-w-md">
                        Automatically generate alt text for images in over 130 languages.
                    </p>

                    {/* Links */}
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-200">
                        <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
                        <Link href="/alt-text-simulator" className="hover:text-white transition-colors">Alt Text Simulator</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                    </div>

                    {/* Copyright */}
                    <p className="text-gray-300 text-sm pt-4 border-t border-white/20 w-full">
                        © 2024 Alt Text Pro. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
