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
        try {
            // Only this browser; other devices stay signed in.
            const { error } = await supabase.auth.signOut({ scope: "local" });
            if (error) {
                toast.error(`Sign out failed: ${error.message}`);
                return;
            }
        } catch {
            toast.error("Sign out failed. Please try again.");
            return;
        }
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
                <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-notebook border border-line pl-4 pr-3 py-2">
                    <div className="flex items-center justify-between h-12 gap-4">
                        <div className="flex items-center">
                            <Link href="/" className="flex items-center gap-3 rounded-full">
                                <Image
                                    src="/brand/logo-mark.svg"
                                    alt=""
                                    width={40}
                                    height={40}
                                    unoptimized
                                    className="h-10 w-10 shrink-0"
                                />
                                <span className="text-2xl font-bold leading-none text-ink tracking-tight font-outfit">Alt Text Pro</span>
                            </Link>
                        </div>

                        {/* Centered Navigation Links */}
                        <div className="hidden lg:flex items-center gap-10">
                            <Link href="/#pricing" className="text-ink-muted hover:text-ink font-medium transition-colors">Pricing</Link>
                            <Link href="/contact" className="text-ink-muted hover:text-ink font-medium transition-colors">Contact</Link>
                            <Link href="/docs" className="text-ink-muted hover:text-ink font-medium transition-colors">Docs</Link>
                        </div>

                        {/* Right Side Buttons */}
                        <div className="hidden lg:flex items-center gap-2">
                            {user ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={handleSignOut}
                                    >
                                        Sign Out
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            router.push("/dashboard");
                                        }}
                                    >
                                        Dashboard
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={handleSignIn}
                                    >
                                        Sign In
                                    </Button>
                                    <Button
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
                                className="inline-flex size-11 items-center justify-center rounded-xl text-ink hover:bg-yellow-tint transition-colors"
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
                        className="lg:hidden fixed inset-0 bg-ink/60 backdrop-blur-sm z-40 top-20"
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>
                    {/* Menu */}
                    <div id="mobile-navigation-menu" className="lg:hidden fixed inset-x-4 top-24 z-50 bg-white/95 backdrop-blur-xl border border-line rounded-2xl shadow-notebook-lg overflow-hidden mobile-menu-container">
                        <div className="px-4 py-6 space-y-4">
                            {/* Navigation Links */}
                            <div className="space-y-1">
                                <Link
                                    href="/#pricing"
                                    className="flex h-11 items-center rounded-xl px-3 text-ink font-medium transition-colors hover:bg-yellow-tint"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Pricing
                                </Link>
                                <Link
                                    href="/contact"
                                    className="flex h-11 items-center rounded-xl px-3 text-ink font-medium transition-colors hover:bg-yellow-tint"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Contact
                                </Link>
                                <Link
                                    href="/docs"
                                    className="flex h-11 items-center rounded-xl px-3 text-ink font-medium transition-colors hover:bg-yellow-tint"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Docs
                                </Link>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-line my-4"></div>

                            {/* Auth Buttons */}
                            <div className="space-y-3">
                                {user ? (
                                    <>
                                        <Button
                                            className="w-full"
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                router.push("/dashboard");
                                            }}
                                        >
                                            Dashboard
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            onClick={handleSignOut}
                                        >
                                            Sign Out
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            onClick={handleSignIn}
                                        >
                                            Sign In
                                        </Button>
                                        <Button
                                            className="w-full"
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
