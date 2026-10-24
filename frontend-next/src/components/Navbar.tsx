"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';

interface NavbarProps {
    onSignInClick?: () => void;
    onSignUpClick?: () => void;
}

const Navbar = ({ onSignInClick, onSignUpClick }: NavbarProps) => {
    const [user, setUser] = useState<any>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Check authentication state
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUser({
                        email: session.user.email,
                        id: session.user.id
                    });
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                setUser(null);
            }
        };

        checkAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUser({
                    email: session.user.email,
                    id: session.user.id
                });
            } else {
                setUser(null);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        const timer = window.setTimeout(() => setIsMobileMenuOpen(false), 0);
        return () => window.clearTimeout(timer);
    }, [pathname]);

    // Handle Sign In Click
    const handleSignIn = () => {
        if (onSignInClick) {
            onSignInClick();
        } else {
            // The homepage opens its sign-in dialog for this parameter.
            router.push("/?auth=signin");
        }
        setIsMobileMenuOpen(false);
    };

    // Handle account creation CTA clicks.
    const handleSignUp = () => {
        if (onSignUpClick) {
            onSignUpClick();
        } else {
            router.push("/?auth=signup");
        }
        setIsMobileMenuOpen(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        toast.success("Signed out successfully");
        setIsMobileMenuOpen(false);
        if (pathname !== '/') {
            router.push("/");
        }
    };

    return (
        <nav className="sticky top-0 z-50 py-4">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-lg border border-gray-200 px-6 py-3">
                    <div className="flex items-center justify-between h-12">
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center space-x-3 group">
                                <Image
                                    src="/logo-alt-text-pro.png"
                                    alt="Alt Text Pro Logo"
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 object-contain transition-transform group-hover:rotate-12"
                                />
                                <span className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit">Alt Text Pro</span>
                            </Link>
                        </div>

                        {/* Centered Navigation Links */}
                        <div className="hidden lg:flex items-center space-x-12">
                            <Link href="/#pricing" className="text-gray-600 hover:text-notebook-blue font-medium transition-colors">Pricing</Link>
                            <Link href="/contact" className="text-gray-600 hover:text-notebook-blue font-medium transition-colors">Contact</Link>
                            <Link href="/docs" className="text-gray-600 hover:text-notebook-blue font-medium transition-colors">Docs</Link>
                        </div>

                        {/* Right Side Buttons */}
                        <div className="hidden lg:flex items-center space-x-3">
                            {user ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        className="text-gray-700 font-medium px-6 py-2.5 rounded-full hover:bg-gray-100 hover:text-notebook-blue transition-all duration-300"
                                        onClick={() => {
                                            router.push("/dashboard");
                                        }}
                                    >
                                        Dashboard
                                    </Button>
                                    <Button
                                        className="bg-notebook-teal text-notebook-black hover:bg-notebook-teal/90 font-semibold px-6 py-2.5 rounded-full shadow-notebook transition-all duration-300"
                                        onClick={handleSignOut}
                                    >
                                        Sign Out
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        className="text-gray-700 font-medium px-6 py-2.5 rounded-full hover:bg-gray-100 hover:text-notebook-blue transition-all duration-300"
                                        onClick={handleSignIn}
                                    >
                                        Sign In
                                    </Button>
                                    <Button
                                        className="bg-notebook-teal text-notebook-black hover:bg-notebook-teal/90 font-semibold px-6 py-2.5 rounded-full shadow-notebook transition-all duration-300 flex items-center gap-2"
                                        onClick={handleSignUp}
                                    >
                                        Get 150 Free Credits
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <div className="lg:hidden">
                            <button
                                type="button"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                                aria-expanded={isMobileMenuOpen}
                                aria-controls="mobile-navigation-menu"
                            >
                                {isMobileMenuOpen ? (
                                    <X className="w-6 h-6" />
                                ) : (
                                    <Menu className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile menu dropdown */}
            {isMobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 top-20"
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>
                    {/* Menu */}
                    <div id="mobile-navigation-menu" className="lg:hidden fixed inset-x-4 top-24 z-50 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl overflow-hidden mobile-menu-container">
                        <div className="px-4 py-6 space-y-4">
                            {/* Navigation Links */}
                            <div className="space-y-3">
                                <Link
                                    href="/#pricing"
                                    className="block text-gray-700 hover:text-primary font-medium transition-colors py-2"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Pricing
                                </Link>
                                <Link
                                    href="/contact"
                                    className="block text-gray-700 hover:text-primary font-medium transition-colors py-2"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Contact
                                </Link>
                                <Link
                                    href="/docs"
                                    className="block text-gray-700 hover:text-primary font-medium transition-colors py-2"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Docs
                                </Link>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-200 my-4"></div>

                            {/* Auth Buttons */}
                            <div className="space-y-3">
                                {user ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            className="w-full text-gray-700 font-medium px-6 py-2.5 rounded-full hover:bg-gray-100 hover:text-notebook-blue"
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                router.push("/dashboard");
                                            }}
                                        >
                                            Dashboard
                                        </Button>
                                        <Button
                                            className="w-full bg-notebook-teal text-notebook-black hover:bg-notebook-teal/90 font-semibold px-6 py-2.5 rounded-full"
                                            onClick={handleSignOut}
                                        >
                                            Sign Out
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="ghost"
                                            className="w-full text-gray-700 font-medium px-6 py-2.5 rounded-full hover:bg-gray-100 hover:text-notebook-blue"
                                            onClick={handleSignIn}
                                        >
                                            Sign In
                                        </Button>
                                        <Button
                                            className="w-full bg-notebook-teal text-notebook-black hover:bg-notebook-teal/90 font-semibold px-6 py-2.5 rounded-full"
                                            onClick={handleSignUp}
                                        >
                                            Get 150 Free Credits
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </nav>
    );
};

export default Navbar;
