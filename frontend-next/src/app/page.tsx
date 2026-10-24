"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { getApiBase } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { getPolarProductId } from '@/lib/polar-products';
import { toast } from "sonner";
import {
  Brain, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
  Upload, Eye, EyeOff, Download, Check, X, Search,
  CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle,
  RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign,
  Wrench, LogOut, MessageCircle, Image as ImageIcon,
  Mail, BarChart3, Clock, Layers, Loader2, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MediaLibraryShowcase from '@/components/MediaLibraryShowcase';
import BenefitsStrip from '@/components/BenefitsStrip';
import PricingSection, { pricingPlans } from '@/components/PricingSection';
import GoogleIdentityButton from '@/components/GoogleIdentityButton';
import { CREDIT_PACKS } from '@/lib/pricing-catalog';

const HERO_SAMPLE_ALT_TEXT = "Turquoise alpine lake reflecting sunlit mountain peaks and pine trees under a clear sky.";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedAltText, setGeneratedAltText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(0);
  const authDialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useEffect(() => {
    if (!showAuthForm) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => emailInputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [showAuthForm]);

  useEffect(() => {
    trackMarketingEvent("page_viewed", {
      source: "landing_page",
      properties: {
        page: "home",
      },
    });
  }, []);

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

  const handleDemoImageSelect = (file: File) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        toast.error("Could not read that image. Please try another file.");
        return;
      }

      setSelectedImage(reader.result);
      setGeneratedAltText("");
    };

    reader.onerror = () => {
      toast.error("Could not read that image. Please try another file.");
    };

    reader.readAsDataURL(file);
  };

  const generateDemoAltText = async () => {
    if (!selectedImage) {
      toast.error("Please select an image first");
      return;
    }

    setIsGenerating(true);

    try {
      const base64Data = selectedImage.includes(',')
        ? selectedImage.split(',')[1]
        : selectedImage;

      if (!base64Data) {
        toast.error("Could not process image data. Please try another image.");
        setIsGenerating(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign up or sign in to generate alt text");
        setIsGenerating(false);
        setShowAuthForm(true);
        return;
      }

      const apiBase = getApiBase();

      const endpoint = `${apiBase}/generate-alt-text`;

      try {
        const apiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            image_base64: base64Data,
            context: "Landing page demo"
          })
        });

        let data;
        try {
          const responseText = await apiResponse.text();
          if (!responseText) throw new Error('Empty response');
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          toast.error("Invalid response from server.");
          setIsGenerating(false);
          return;
        }

        if (apiResponse.ok) {
          setGeneratedAltText(data.alt_text || data.altText);
          trackMarketingEvent("demo_used", {
            source: "landing_page",
            userId: user?.id,
            userEmail: user?.email,
            properties: {
              context: "landing_page_demo",
              credits_remaining: data.credits_remaining,
            },
          });
          toast.success("Alt text generated successfully!");
        } else {
          if (apiResponse.status === 401) {
            toast.error("Session expired. Please sign in again.");
            setShowAuthForm(true);
          } else if (apiResponse.status === 402) {
            toast.error("No credits remaining. Please upgrade your plan.");
          } else {
            toast.error(data.error || "Failed to generate alt text.");
          }
        }
      } catch (fetchError: any) {
        console.error("API fetch error:", fetchError);
        toast.error("Failed to connect to the server.");
      }
    } catch (error) {
      console.error("Error generating alt text:", error);
      toast.error("Failed to generate alt text.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      let result;

      if (isLogin) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + '/email-confirmed'
          }
        });
      }

      if (result.error) {
        toast.error(result.error.message);
      } else if (result.data.user) {
        if (!isLogin && result.data.session) {
          trackMarketingEvent("signup_created", {
            source: "landing_page",
            userId: result.data.user.id,
            userEmail: result.data.user.email,
            properties: {
              signup_method: "email",
              selected_plan: selectedPlan?.id || "free",
            },
          });
        }

        if (!isLogin && !result.data.session) {
          toast.success("Please check your email to confirm your account.");
        } else {
          toast.success("Welcome back!");
          router.push("/dashboard");
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      toast.error("Enter your email address first.");
      emailInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("If an account exists for that email, a reset link is on its way.");
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("Could not send the password reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle plan selection
  const handlePlanSelection = (planId: string, planName: string, planPrice: string) => {
    if (!user) {
      // User not logged in, show auth form first
      setIsLogin(false); // Set to signup mode
      setShowAuthForm(true);
      setSelectedPlan({ id: planId, name: planName, price: planPrice });
      return;
    }

    // User is logged in, show payment modal
    setSelectedPlan({ id: planId, name: planName, price: planPrice });
    setShowPaymentModal(true);
  };

  // Redirect to Polar.sh checkout
  const redirectToCheckout = async (productId: string): Promise<boolean> => {
    if (!productId) {
      toast.error('Product not configured. Please contact support.');
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      toast.error('Please sign in again before starting checkout.');
      return false;
    }

    trackMarketingEvent("checkout_started", {
      source: "landing_page",
      userId: user?.id,
      userEmail: session.user.email || user?.email,
      properties: {
        product_id: productId,
        plan_id: selectedPlan?.id,
        billing_cycle: billingCycle,
      },
    });

    const response = await fetch(
      `/api/checkout?products=${encodeURIComponent(productId)}&format=json`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
      },
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      toast.error(data.error || 'Could not start checkout. Please try again.');
      return false;
    }

    window.location.href = data.url;
    return true;
  };

  // Handle purchase/upgrade
  const handlePurchase = async (planId: string) => {
    setIsLoading(true);
    let redirecting = false;
    try {
      if (planId === 'free') {
        setShowPaymentModal(false);
        setSelectedPlan(null);
        router.push("/dashboard");
        return;
      }

      const productId = getPolarProductId(planId, billingCycle);
      redirecting = await redirectToCheckout(productId);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error("Failed to start purchase.");
    } finally {
      if (!redirecting) setIsLoading(false);
    }
  };

  const selectedPlanFeatures = selectedPlan
    ? pricingPlans.find((plan) => plan.id === selectedPlan.id)?.features
      || CREDIT_PACKS.find((pack) => pack.id === selectedPlan.id)?.features
      || []
    : [];

  const handleAuthDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setShowAuthForm(false);
      return;
    }

    if (event.key !== 'Tab' || !authDialogRef.current) return;

    const focusableElements = Array.from(
      authDialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden'));

    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="min-h-screen bg-notebook-paper">
      <Navbar
        onSignInClick={() => {
          setIsLogin(true);
          setShowAuthForm(true);
        }}
        onSignUpClick={() => {
          setIsLogin(false);
          setShowAuthForm(true);
        }}
      />
      <main className="relative overflow-hidden">
        {/* Notebook-style Subtle Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[600px] bg-gradient-to-b from-notebook-blue/5 to-transparent blur-[120px] opacity-70 select-none pointer-events-none"></div>

        <div className="relative mx-auto w-full max-w-[1800px] px-5 sm:px-[47px] lg:px-[calc(2vw+15px)] z-10">
          <section className="pt-8 pb-20 lg:pt-12 lg:pb-28">
            <div className="grid items-center gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-4 xl:grid-cols-[1fr_1fr]">
              {/* Left Side - Content */}
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 min-[1800px]:-translate-y-6">
                <div className="flex flex-col">
                  <h1 className="max-w-[900px] text-[clamp(3.4rem,7.5vw,10rem)] font-bold font-outfit leading-[0.92] tracking-[-0.075em] text-black">
                    <span className="block text-[0.42em] leading-none tracking-[-0.05em]">Alt Text Pro</span>
                    <span className="mt-3 block">Make Every <br />
                      <span className="text-black">Image Speak</span>
                    </span>
                  </h1>

                  <p className="mt-6 max-w-2xl text-lg font-normal leading-[1.2] text-slate-500 sm:text-xl lg:text-[1.7rem] min-[1800px]:mt-10 min-[1800px]:max-w-[900px] min-[1800px]:text-[2.15rem]">
                    Generate useful, context-aware alt text drafts across your WordPress media library.
                  </p>

                  <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center min-[1800px]:mt-20">
                    <Button
                      size="lg"
                      className="h-16 rounded-full bg-notebook-teal px-9 text-base font-bold text-notebook-black shadow-[0_16px_32px_rgba(254,225,28,0.28)] transition-all duration-300 hover:-translate-y-1 hover:bg-notebook-teal/90 sm:text-lg"
                      onClick={() => {
                        setIsLogin(false);
                        setShowAuthForm(true);
                      }}
                    >
                      Start with 150 free credits
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-16 rounded-full border-slate-200 bg-white px-9 text-base font-semibold text-black shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:text-black sm:text-lg"
                      asChild
                    >
                      <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer">
                        Install the WordPress plugin
                      </a>
                    </Button>
                  </div>

                  <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 sm:text-sm min-[1800px]:mt-12">
                    <span className="font-semibold text-slate-600">1 credit per image</span>
                    <span>No credit card required</span>
                  </p>
                </div>
              </div>

              {/* Right Side - Reference hero visual */}
              <div className="relative min-h-[570px] animate-in fade-in zoom-in-95 delay-150 duration-1000 sm:min-h-[500px] lg:ml-[-2.5rem] lg:min-h-[470px] min-[1800px]:ml-[-4rem] min-[1800px]:min-h-[670px] min-[1800px]:-translate-y-12">
                <input
                  type="file"
                  id="image-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDemoImageSelect(file);
                  }}
                />

                <button
                  type="button"
                  className="absolute right-[7%] top-3 z-10 block w-[83%] rotate-[2deg] rounded-[2.6rem] border border-slate-200 bg-white p-3 text-left shadow-[0_28px_60px_rgba(15,23,42,0.12)] transition-transform duration-500 hover:rotate-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FEE11C]/45 sm:right-[8%] sm:top-4 lg:right-[29%] lg:w-[56%] min-[1800px]:right-[32%] min-[1800px]:w-[59%]"
                  onClick={() => document.getElementById("image-upload")?.click()}
                  aria-label="Choose an image to generate alt text"
                >
                  <div className="relative aspect-[1.14] overflow-hidden rounded-[2.1rem] bg-slate-100">
                    {selectedImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedImage} alt="Selected image" className="h-full w-full object-cover" />
                    ) : (
                      <Image
                        src="/mountain-landscape.jpg"
                        alt="Mountain peaks reflected in an alpine lake"
                        fill
                        sizes="(min-width: 1024px) 42vw, 90vw"
                        className="object-cover"
                        priority
                      />
                    )}
                    <span className="absolute left-5 top-5 rounded-xl bg-slate-900/95 px-4 py-2 text-sm font-bold tracking-wide text-white shadow-lg">
                      {selectedImage ? "YOUR_IMAGE" : "IMG_4821.jpg"}
                    </span>
                    <span className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-[#1976A8] font-serif text-4xl font-bold leading-none text-white shadow-xl" aria-hidden="true">
                      W
                    </span>
                  </div>
                </button>

                <div className="absolute bottom-0 right-0 z-20 w-[79%] rounded-[2rem] border border-slate-200 bg-white p-7 text-left shadow-[0_28px_70px_rgba(15,23,42,0.14)] sm:p-6 lg:w-[58%] min-[1800px]:bottom-[-72px] min-[1800px]:w-[60%] min-[1800px]:p-8">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-4 min-[1800px]:pb-5">
                    <h2 className="text-lg font-bold text-black">Generated alt text</h2>
                  </div>
                  <p className="min-h-[96px] py-5 text-lg leading-7 text-slate-600 min-[1800px]:min-h-[116px] min-[1800px]:py-7 min-[1800px]:text-xl min-[1800px]:leading-8">
                    {generatedAltText || HERO_SAMPLE_ALT_TEXT}
                  </p>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4 min-[1800px]:pt-5">
                    {selectedImage && !generatedAltText ? (
                      <button
                        type="button"
                        onClick={generateDemoAltText}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded-full bg-notebook-teal px-4 py-2 text-sm font-bold text-notebook-black transition hover:bg-notebook-teal/90 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isGenerating ? "Generating…" : "Generate alt text"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-base font-semibold text-black">Ready to use</span>
                    )}
                    <button
                      type="button"
                      className="rounded-lg p-2 text-black transition hover:bg-slate-100"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedAltText || HERO_SAMPLE_ALT_TEXT);
                        toast.success("Copied to clipboard!");
                      }}
                      aria-label="Copy generated alt text"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <BenefitsStrip />
        <MediaLibraryShowcase />

        {/* How It Works - Premium Design */}
        <section className="py-24 bg-white relative">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-24">
              <h2 className="text-4xl lg:text-6xl font-bold text-notebook-slate mb-6 tracking-tight font-outfit">
                From Upload to Alt Text
                <br />
                <span className="text-notebook-blue italic">Without Guesswork.</span>
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-xl font-normal">
                Connect WordPress, generate editable descriptions, and review every important image before publishing.
              </p>
            </div>

            <div className="relative max-w-6xl mx-auto">
              {/* ===== LOCKED SECTION: Dotted connector images - DO NOT MODIFY POSITIONING ===== */}
              {/* These images are precisely positioned to connect the steps. Any changes should be made as a group. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dots1.png"
                alt=""
                className="landing-dots landing-dots-one hidden lg:block absolute pointer-events-none opacity-20 invert"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dots2.png"
                alt=""
                className="landing-dots landing-dots-two hidden lg:block absolute pointer-events-none opacity-20 invert"
              />
              {/* ===== END LOCKED SECTION ===== */}

              <div className="space-y-24">
                {/* Step 1 - Upload Image: Image Left, Text Right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                  <div className="lg:order-1 relative z-10 flex justify-center lg:justify-end">
                    <div className="rounded-3xl p-8 border border-notebook-blue/10 relative w-full max-w-sm bg-notebook-paper shadow-notebook group hover:border-notebook-blue/30 transition-all duration-500">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-notebook-blue/5 border border-notebook-blue/10 group-hover:scale-110 transition-transform duration-500">
                        <Upload className="h-8 w-8 text-notebook-blue" />
                      </div>
                      <p className="text-notebook-black/80 text-sm mb-2 text-center font-outfit font-medium">Drag your file(s) or <span className="text-notebook-blue cursor-pointer hover:underline">browse</span></p>
                      <p className="text-xs text-notebook-black/40 mb-6 text-center font-light italic">Max 10 MB files are allowed</p>

                      {/* Blue file badge */}
                      <div className="absolute -top-4 right-6">
                        <div className="text-white px-4 py-2 rounded-full text-xs font-bold flex items-center bg-notebook-blue shadow-notebook font-outfit whitespace-nowrap">
                          <ImageIcon className="w-3.5 h-3.5 mr-2" />
                          marketing-asset-v2.webp
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:order-2 relative z-10 max-w-sm flex items-center h-full">
                    <div>
                      {/* Large background number */}
                        <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-[#FEE11C]/20 select-none pointer-events-none z-0 font-outfit">
                        01
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Install + Connect
                      </h3>
                      <p className="text-slate-500 text-lg leading-relaxed relative z-10 font-normal">
                        Create a free account, install the WordPress plugin, and click Connect to save your API key automatically.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 - AI Analysis: Text Left, Image Right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                  <div className="lg:order-1 relative flex justify-center lg:justify-end items-center h-full">
                    <div className="max-w-sm relative pr-8">
                      {/* Large background number */}
                      <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-[#FEE11C]/20 select-none pointer-events-none z-0 font-outfit">
                        02
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Generate With Context
                      </h3>
                      <p className="text-slate-500 text-lg leading-relaxed relative z-10 font-normal">
                        Generate one image first, then use page context or bulk processing when you are ready to fix more of the media library.
                      </p>
                    </div>
                  </div>

                  <div className="lg:order-2 flex justify-center lg:justify-start">
                    {/* Glassmorphic AI Circuit Diagram */}
                    <div className="relative w-full max-w-sm h-64 rounded-3xl p-4 bg-notebook-paper border border-notebook-blue/10 shadow-notebook overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-notebook-blue/5 to-notebook-orange/5 rounded-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>

                      {/* Central AI Chip */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-28 h-28 bg-white border border-gray-100 rounded-[2rem] flex items-center justify-center shadow-notebook relative overflow-hidden group-hover:border-notebook-blue/30 transition-colors duration-500">
                          <div className="absolute inset-0 bg-gradient-to-tr from-notebook-blue/5 to-transparent animate-pulse"></div>
                          <Brain className="w-12 h-12 text-notebook-slate relative z-10" />
                        </div>
                      </div>

                      {/* Animated Data Pulses */}
                      <div className="absolute top-1/2 left-0 w-1/2 h-0.5 bg-gradient-to-r from-transparent to-notebook-blue/30 -translate-y-1/2 flex items-center justify-end pr-14">
                        <div className="w-2 h-2 rounded-full bg-notebook-blue animate-ping"></div>
                      </div>
                      <div className="absolute top-0 left-1/2 w-0.5 h-1/2 bg-gradient-to-b from-transparent to-notebook-orange/30 -translate-x-1/2 flex items-center justify-end pb-14 flex-col">
                        <div className="w-2 h-2 rounded-full bg-notebook-orange animate-ping landing-pulse-delay-500"></div>
                      </div>
                      <div className="absolute top-1/2 right-0 w-1/2 h-0.5 bg-gradient-to-l from-transparent to-notebook-blue/30 -translate-y-1/2 flex items-center justify-start pl-14">
                        <div className="w-2 h-2 rounded-full bg-notebook-blue animate-ping landing-pulse-delay-1000"></div>
                      </div>
                      <div className="absolute bottom-0 left-1/2 w-0.5 h-1/2 bg-gradient-to-t from-transparent to-notebook-orange/30 -translate-x-1/2 flex items-center justify-start pt-14 flex-col">
                        <div className="w-2 h-2 rounded-full bg-notebook-orange animate-ping landing-pulse-delay-1500"></div>
                      </div>

                      {/* Decorative nodes */}
                      <div className="absolute top-8 left-8 w-12 h-12 rounded-xl bg-white border border-notebook-blue/5 flex items-center justify-center shadow-sm">
                        <Search className="w-5 h-5 text-notebook-blue/40" />
                      </div>
                      <div className="absolute bottom-8 right-8 w-12 h-12 rounded-xl bg-white border border-notebook-blue/5 flex items-center justify-center shadow-sm">
                        <BarChart3 className="w-5 h-5 text-notebook-blue/40" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 - Get Alt Text: Image Left, Text Right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                  <div className="lg:order-1 flex justify-center lg:justify-end">
                    {/* Results preview */}
                    <div className="bg-notebook-paper rounded-3xl border border-notebook-blue/10 p-6 w-full max-w-sm shadow-notebook relative group">
                      <div className="w-full h-40 rounded-2xl flex items-end justify-center mb-6 relative overflow-hidden bg-notebook-pearl border border-notebook-blue/5">
                        <Image src="/red-fox.png" alt="Sample" fill sizes="(min-width: 1024px) 384px, 100vw" className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>

                      {/* Generated Result UI */}
                      <div className="space-y-4 relative z-10">
                        <div className="bg-white rounded-xl p-4 border border-notebook-blue/5 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-[0.2em] flex items-center gap-1.5 font-outfit">
                              Optimized Alt Text
                            </span>
                            <div className="h-5 w-5 rounded-full bg-notebook-blue/5 flex items-center justify-center hover:bg-notebook-blue/10 cursor-pointer transition-colors">
                              <Copy className="w-3 h-3 text-notebook-blue" />
                            </div>
                          </div>
                          <p className="text-notebook-black text-sm font-medium leading-relaxed">
                            Close-up of a red fox standing on a sandy beach during a golden hour sunset, with calm ocean waves.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1 bg-notebook-blue/5 rounded-lg border border-notebook-blue/10 py-2 px-3 flex items-center">
                            <span className="text-[10px] font-bold text-notebook-black/70 font-outfit uppercase">Accessibility Standards</span>
                          </div>
                          <div className="flex-1 bg-[#FEE11C] rounded-lg border border-[#E8C900] py-2 px-3 flex items-center">
                            <span className="text-[10px] font-bold text-black font-outfit uppercase">Ready to review</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:order-2 relative max-w-sm flex items-center h-full">
                    <div className="relative">
                      {/* Large background number */}
                      <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-[#FEE11C]/20 select-none pointer-events-none z-0 font-outfit">
                        03
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Review + Save
                      </h3>
                      <p className="text-slate-500 text-lg leading-relaxed relative z-10 font-normal">
                        Review the generated text, edit when the page needs more context, and save it directly into WordPress.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product proof section */}
        <section className="py-24 bg-white border-t border-notebook-blue/5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-notebook-blue/5 border border-notebook-blue/10 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-notebook-blue animate-pulse" />
                <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Product facts</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-notebook-slate mb-4 tracking-tight font-outfit">A workflow you can inspect and control</h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-normal">Generate suggestions, review the wording, and save approved alt text without leaving WordPress.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-notebook-paper border border-notebook-blue/10 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-notebook-blue/10">
                  <Eye className="h-6 w-6 text-notebook-blue" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-notebook-black">Review before saving</h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">Generated text remains editable, so you can add page-specific context before it reaches the media library.</p>
              </div>

              <div className="bg-notebook-paper border border-notebook-orange/20 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300 relative transform md:-translate-y-4">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-notebook-orange/20">
                  <Layers className="h-6 w-6 text-notebook-orange" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-notebook-black">Controlled bulk processing</h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">Choose a batch size and whether existing alt text may be replaced before a media-library run begins.</p>
              </div>

              <div className="bg-notebook-paper border border-notebook-blue/10 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-notebook-blue/10">
                  <CheckCircle className="h-6 w-6 text-notebook-blue" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-notebook-black">Credits debit on success</h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">A successful image generation uses one credit. Failed generation requests release their reservation.</p>
              </div>
            </div>
          </div>
        </section>

        <PricingSection
          billingCycle={billingCycle}
          onBillingCycleChange={setBillingCycle}
          onSelectPlan={handlePlanSelection}
        />

        {/* Example Showcase Section - Warmer Research Hub Style */}
        <section id="showcase" className="py-24 bg-white relative overflow-hidden border-t border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20 space-y-4">
              <div className="inline-flex px-3 py-1 bg-notebook-blue/5 rounded-full border border-notebook-blue/10">
                <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Real-time Previews</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold text-notebook-slate tracking-tight font-outfit mb-6">
                See Results <span className="text-notebook-blue italic">in Action.</span>
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto font-normal">See concise example drafts, then review each one against its page context before publishing.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Research Entry 1 */}
              <div className="bg-notebook-paper border border-notebook-blue/5 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/business-team.jpg"
                    alt="Eight coworkers meet around a table with laptops and charts in a glass-walled office."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-notebook-slate/10 group-hover:bg-transparent transition-colors duration-500"></div>
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 backdrop-blur-sm text-notebook-slate border-none text-[9px] font-bold px-2 py-1 rounded-lg shadow-sm">ENTRY #1024</Badge>
                  </div>
                </div>
                <div className="p-10 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-notebook-blue animate-pulse"></div>
                    <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">AI Draft</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Eight coworkers meet around a table with laptops and charts in a glass-walled office."
                  </p>
                  <div className="pt-6 border-t border-notebook-blue/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Example output</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 2 */}
              <div className="bg-notebook-paper border border-notebook-orange/10 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col md:-translate-y-4">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/fresh-vegetables.jpg"
                    alt="Carrots, tomatoes, berries, and leafy greens arranged at a busy farmers market."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-notebook-slate/10 group-hover:bg-transparent transition-colors duration-500"></div>
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 backdrop-blur-sm text-notebook-slate border-none text-[9px] font-bold px-2 py-1 rounded-lg shadow-sm">ENTRY #1025</Badge>
                  </div>
                </div>
                <div className="p-10 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-notebook-orange animate-pulse"></div>
                    <span className="text-[10px] font-bold text-notebook-orange uppercase tracking-widest font-outfit">AI Draft</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Carrots, tomatoes, berries, and leafy greens arranged at a busy farmers market."
                  </p>
                  <div className="pt-6 border-t border-notebook-orange/10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Example output</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 3 */}
              <div className="bg-notebook-paper border border-notebook-blue/5 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/mountain-landscape.jpg"
                    alt="Snow-covered mountain peaks and pine trees reflected in a calm lake at sunset."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-notebook-slate/10 group-hover:bg-transparent transition-colors duration-500"></div>
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 backdrop-blur-sm text-notebook-slate border-none text-[9px] font-bold px-2 py-1 rounded-lg shadow-sm">ENTRY #1026</Badge>
                  </div>
                </div>
                <div className="p-10 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-notebook-blue animate-pulse"></div>
                    <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">AI Draft</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Snow-covered mountain peaks and pine trees reflected in a calm lake at sunset."
                  </p>
                  <div className="pt-6 border-t border-notebook-blue/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Example output</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-slate-200 bg-white py-24">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-10">
            <div>
              <p className="text-sm font-semibold text-black">Questions</p>
              <h2 className="mt-8 max-w-xl font-outfit text-6xl font-bold leading-[0.96] tracking-[-0.07em] text-black sm:text-7xl">
                Good answers,
                <br />
                before you
                <br />
                <span className="italic">start.</span>
              </h2>
              <p className="mt-10 max-w-md text-lg leading-7 text-slate-500">
                Still deciding? Start free and test the complete WordPress workflow.
              </p>
              <Button
                size="lg"
                className="mt-10 h-14 rounded-full bg-[#FEE11C] px-10 text-base font-bold text-black shadow-[0_14px_28px_rgba(254,225,28,0.25)] transition hover:-translate-y-0.5 hover:bg-[#FEE11C]"
                onClick={() => { setIsLogin(false); setShowAuthForm(true); }}
              >
                Get 150 free credits
              </Button>
            </div>

            <div className="border-t border-slate-300">
              {[
                {
                  question: "What counts as one credit?",
                  answer: "One successful alt text generation uses one credit. Failed requests do not consume credits.",
                },
                {
                  question: "Can I process an entire WordPress media library?",
                  answer: "Yes. Every plan, including Free, supports bulk media-library fixes. For a large backlog, a one-time credit pack is usually the cheapest option.",
                },
                {
                  question: "Does it work with WooCommerce images?",
                  answer: "Yes. Alt Text Pro works with WooCommerce product images and the rest of your WordPress media library.",
                },
                {
                  question: "Do unused subscription credits roll over?",
                  answer: "Plan credits reset each billing cycle. Purchased and bonus credits remain available for future generations.",
                },
              ].map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="border-b border-slate-300">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-6 py-7 text-left"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    >
                      <span className="font-outfit text-xl font-semibold tracking-[-0.03em] text-black sm:text-2xl">{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-black transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {isOpen && <p className="max-w-3xl pb-7 pr-8 text-lg leading-7 text-slate-500">{faq.answer}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <Footer />

        {/* Auth Modal - Focused Depth Look */}
        {showAuthForm && (
          <div
            className="fixed inset-0 bg-notebook-slate/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-500"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setShowAuthForm(false);
            }}
          >
            <div
              ref={authDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-dialog-title"
              aria-describedby="auth-dialog-description"
              onKeyDown={handleAuthDialogKeyDown}
              className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-300"
            >
              <button
                type="button"
                onClick={() => setShowAuthForm(false)}
                className="absolute top-6 right-6 text-slate-500 hover:text-notebook-slate transition-colors p-2 hover:bg-slate-100 rounded-xl"
                aria-label="Close authentication dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="text-center mb-5 mt-2">
                <h3 id="auth-dialog-title" className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit mb-1.5">
                  {isLogin ? "Welcome Back" : "Create Your Account"}
                </h3>
                <p id="auth-dialog-description" className="text-sm text-slate-600 font-normal leading-relaxed">
                  {isLogin ? "Log in to your dashboard." : "Sign up for Alt Text Pro."}
                </p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="auth-email" className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Work Email</label>
                  <Input
                    ref={emailInputRef}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-notebook-paper border border-slate-200 text-notebook-slate placeholder:text-slate-400 rounded-2xl focus:ring-2 focus:ring-notebook-blue/30 transition-all font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="auth-password" className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Password</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => void handlePasswordReset()}
                        disabled={isLoading}
                        className="text-[10px] font-bold text-notebook-blue hover:text-notebook-slate disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 bg-notebook-paper border border-slate-200 text-notebook-slate placeholder:text-slate-400 rounded-2xl focus:ring-2 focus:ring-notebook-blue/30 transition-all font-medium"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-notebook-blue hover:bg-notebook-blue/90 text-white font-bold rounded-2xl shadow-notebook transition-all duration-300 hover:-translate-y-1 uppercase tracking-widest text-xs font-outfit"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    isLogin ? "Log In" : "Create Account"
                  )}
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-notebook-blue/5"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="px-4 text-slate-400 bg-white">Google Sign In</span>
                </div>
              </div>

              <GoogleIdentityButton
                text={isLogin ? "signin_with" : "signup_with"}
                disabled={isLoading}
                onSuccess={() => {
                  toast.success("Signed in with Google.");
                  setShowAuthForm(false);
                  router.push("/dashboard");
                }}
                onError={(message) => toast.error(message)}
                className="rounded-2xl"
              />

              <div className="text-center mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[10px] font-bold text-slate-600 hover:text-notebook-blue uppercase tracking-widest transition-colors font-outfit"
                >
                  {isLogin
                    ? "Need an account? Sign up here"
                    : "Already have an account? Log in"}
                </button>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(false)}
                    className="text-[10px] font-bold text-slate-500 hover:text-notebook-orange uppercase tracking-widest transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal - Focused Depth Look */}
        {showPaymentModal && selectedPlan && (
          <div className="fixed inset-0 bg-notebook-slate/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-500">
            <div role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-notebook-blue/5 animate-in fade-in zoom-in-95 duration-300">
              <button
                type="button"
                onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); }}
                className="absolute top-6 right-6 text-slate-300 hover:text-notebook-slate transition-colors p-2 hover:bg-slate-50 rounded-xl"
                aria-label="Close checkout dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="text-center mb-5 mt-2">
                <h3 id="payment-dialog-title" className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit mb-1.5">
                  {CREDIT_PACKS.some((pack) => pack.id === selectedPlan.id) ? 'Buy Credits' : 'Upgrade Your Subscription'}
                </h3>
                <p className="text-sm text-slate-500 font-normal leading-relaxed">
                  Selected Plan: <span className="text-notebook-blue font-bold">{selectedPlan.name}</span>
                </p>
              </div>

              <div className="bg-notebook-paper rounded-xl p-4 mb-6 text-center border border-notebook-blue/5">
                <div className="text-3xl font-bold text-notebook-slate font-outfit mb-0.5">
                  {selectedPlan.price}
                </div>
                {!['free', 'pay_as_go', 'small_pack', 'credit_pack', 'bulk_pack'].includes(selectedPlan.id) && (
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    BILLED MONTHLY / ANNUALLY
                  </div>
                )}
              </div>

              {selectedPlan.id === 'free' ? (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-6 font-normal">
                    You are currently on the free plan.
                  </p>
                  <Button
                    onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); router.push("/dashboard"); }}
                    className="w-full h-12 bg-notebook-blue hover:bg-notebook-blue/90 text-white font-bold rounded-2xl shadow-notebook transition-all duration-300 uppercase tracking-widest text-xs font-outfit"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-notebook-slate/40 uppercase tracking-widest ml-1">What's Included</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlanFeatures.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 bg-notebook-paper/50 px-3 py-2 rounded-xl border border-notebook-blue/5">
                          <Check className="h-3.5 w-3.5 text-notebook-blue" />
                          <span className="text-[10px] font-bold text-notebook-slate/80 uppercase tracking-widest">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePurchase(selectedPlan.id)}
                      disabled={isLoading}
                      className="w-full h-12 sm:h-14 bg-notebook-blue hover:bg-notebook-blue/90 text-white font-bold rounded-2xl shadow-notebook transition-all duration-300 hover:-translate-y-1 uppercase tracking-widest text-xs font-outfit"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        `Upgrade to ${selectedPlan.name}`
                      )}
                    </Button>

                    <button
                      onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); }}
                      className="w-full text-[10px] font-bold text-slate-400 hover:text-notebook-slate uppercase tracking-widest transition-colors py-2"
                    >
                      Cancel Upgrade
                    </button>

                    <div className="text-center flex items-center justify-center gap-2 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                      <Shield className="h-3 w-3" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Secure checkout by Polar.sh</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div >
  );
}
