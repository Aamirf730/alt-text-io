"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { getApiBase } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { getPolarProductId } from '@/lib/polar-products';
import { savePendingCheckout } from '@/lib/pending-checkout';
import { SUBSCRIPTION_EXISTS_CODE } from '@/lib/subscription-status';
import { EXISTING_ACCOUNT_MESSAGE, isExistingAccountSignUp } from '@/lib/auth-redirect';
import { toast } from "sonner";
import {
  Brain, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
  Upload, Eye, EyeOff, Download, Check, X, Search,
  CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle,
  RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign,
  Wrench, LogOut, MessageCircle, Image as ImageIcon,
  Mail, BarChart3, Clock, Layers, Loader2, ChevronDown
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { HOME_FAQS } from '@/lib/home-faqs';

const HERO_SAMPLE_ALT_TEXT = "Turquoise alpine lake reflecting sunlit mountain peaks and pine trees under a clear sky.";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  // Email waiting for confirmation; shows an inline notice with a resend link.
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
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

  // Sign-in and sign-up links on other pages send visitors to /?auth=…; open
  // the dialog for them and drop the parameter from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authMode = params.get("auth");
    if (authMode !== "signin" && authMode !== "signup") return;

    params.delete("auth");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);

    const timer = window.setTimeout(() => {
      setIsLogin(authMode === "signin");
      setShowAuthForm(true);
    }, 0);
    return () => window.clearTimeout(timer);
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
          toast.success("Alt text generated.");
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
        if (isLogin && /email not confirmed/i.test(result.error.message)) {
          setPendingConfirmationEmail(email.trim());
        }
        toast.error(result.error.message);
      } else if (!isLogin && isExistingAccountSignUp(result.data.user, Boolean(result.data.session))) {
        // Supabase sends no email for an address that already has an account.
        setIsLogin(true);
        setPendingConfirmationEmail(null);
        toast.error(EXISTING_ACCOUNT_MESSAGE, { duration: 8000 });
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
          setPendingConfirmationEmail(email.trim());
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

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: { emailRedirectTo: window.location.origin + '/email-confirmed' },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("We sent a new confirmation email. Check your inbox and spam folder.");
    } catch (error) {
      console.error("Resend confirmation error:", error);
      toast.error("Could not resend the confirmation email. Please try again.");
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
      // User not logged in, show auth form first. The choice is kept so the
      // dashboard can reopen it after sign-up, email confirmation or sign-in.
      savePendingCheckout(planId, billingCycle);
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

    if (data.code === SUBSCRIPTION_EXISTS_CODE) {
      toast.info(data.error);
      setShowPaymentModal(false);
      router.push("/dashboard");
      return false;
    }

    if (!response.ok || !data.url) {
      toast.error(data.error || 'Could not start checkout. Please try again.');
      return false;
    }

    // Recorded only once a checkout exists, so a refused request never
    // triggers checkout-recovery emails.
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
    <div className="min-h-screen bg-white">
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[600px] bg-gradient-to-b from-yellow-tint to-transparent blur-[120px] opacity-70 select-none pointer-events-none"></div>

        <div className="relative mx-auto w-full max-w-[1800px] px-5 sm:px-[47px] lg:px-[calc(2vw+15px)] z-10">
          <section className="pt-8 pb-20 lg:pt-12 lg:pb-28">
            <div className="grid items-center gap-6 lg:grid-cols-[0.94fr_1.06fr] lg:gap-4 xl:grid-cols-[1fr_1fr]">
              {/* Left Side - Content */}
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 min-[1800px]:-translate-y-6">
                <div className="flex flex-col">
                  <h1 className="max-w-[900px] text-[clamp(3.4rem,7.5vw,10rem)] font-bold font-outfit leading-[0.92] tracking-[-0.075em] text-ink">
                    <span className="block text-[0.42em] leading-none tracking-[-0.05em]">Alt Text Pro for WordPress</span>{" "}
                    <span className="mt-3 block">Describe <br />
                      <span className="text-ink">every image</span>
                    </span>
                  </h1>

                  <p className="mt-6 max-w-2xl text-lg font-normal leading-[1.2] text-ink-muted sm:text-xl lg:text-[1.7rem] min-[1800px]:mt-10 min-[1800px]:max-w-[900px] min-[1800px]:text-[2.15rem]">
                    AI drafts the alt text for images in your media library. You review it, edit it if needed, and save. One image at a time or in bulk.
                  </p>

                  <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center min-[1800px]:mt-20">
                    <Button
                      onClick={() => {
                        if (user) {
                          router.push("/dashboard");
                          return;
                        }
                        setIsLogin(false);
                        setShowAuthForm(true);
                      }}
                    >
                      {user ? "Go to your dashboard" : "Start with 150 free credits"}
                    </Button>
                    <Button
                      variant="secondary"
                      asChild
                    >
                      <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer">
                        Install the WordPress plugin
                      </a>
                    </Button>
                  </div>

                  <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-muted sm:text-sm min-[1800px]:mt-12">
                    <span className="font-semibold text-ink">1 credit per image</span>
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
                  className="absolute right-[7%] top-3 z-10 block w-[83%] rotate-[2deg] rounded-[2.6rem] border border-line bg-white p-3 text-left shadow-notebook-lg transition-transform duration-500 hover:rotate-0 sm:right-[8%] sm:top-4 lg:right-[29%] lg:w-[56%] min-[1800px]:right-[32%] min-[1800px]:w-[59%]"
                  onClick={() => document.getElementById("image-upload")?.click()}
                  aria-label="Choose an image to generate alt text"
                >
                  <div className="relative aspect-[1.14] overflow-hidden rounded-[2.1rem] bg-yellow-tint">
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
                    <span className="absolute left-5 top-5 inline-flex h-9 items-center rounded-xl bg-brand-yellow px-4 text-sm font-semibold tracking-wide text-ink">
                      {selectedImage ? "YOUR_IMAGE" : "IMG_4821.jpg"}
                    </span>
                    <span className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-brand-yellow font-serif text-4xl font-bold leading-none text-ink shadow-notebook" aria-hidden="true">
                      W
                    </span>
                  </div>
                </button>

                <div className="absolute bottom-0 right-0 z-20 w-[79%] rounded-[2rem] border border-line bg-white p-7 text-left shadow-notebook-lg sm:p-6 lg:w-[58%] min-[1800px]:bottom-[-72px] min-[1800px]:w-[60%] min-[1800px]:p-8">
                  <div className="flex items-center gap-3 border-b border-line pb-4 min-[1800px]:pb-5">
                    <h2 className="text-lg font-bold text-ink">Generated alt text</h2>
                  </div>
                  <p className="min-h-[96px] py-5 text-lg leading-7 text-ink-muted min-[1800px]:min-h-[116px] min-[1800px]:py-7 min-[1800px]:text-xl min-[1800px]:leading-8">
                    {generatedAltText || HERO_SAMPLE_ALT_TEXT}
                  </p>
                  <div className="flex items-center justify-between border-t border-line pt-4 min-[1800px]:pt-5">
                    {selectedImage && !generatedAltText ? (
                      <button
                        type="button"
                        onClick={generateDemoAltText}
                        disabled={isGenerating}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isGenerating ? "Generating…" : "Generate alt text"}
                      </button>
                    ) : (
                      <span className="inline-flex h-9 items-center gap-2 text-base font-semibold text-ink">Ready to review</span>
                    )}
                    <button
                      type="button"
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      onClick={() => {
                        navigator.clipboard.writeText(generatedAltText || HERO_SAMPLE_ALT_TEXT);
                        toast.success("Copied to clipboard.");
                      }}
                      aria-label="Copy generated alt text"
                    >
                      <Copy />
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
              <h2 className="text-4xl lg:text-6xl font-bold text-ink mb-6 tracking-tight font-outfit">
                From install to saved alt text
                <br />
                <span className="text-ink italic">in three steps.</span>
              </h2>
              <p className="text-ink-muted max-w-2xl mx-auto text-xl font-normal">
                Connect the plugin, try it on one image, then work through the rest of your library.
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
                    <div className="rounded-3xl p-8 border border-line relative w-full max-w-sm bg-white shadow-notebook group hover:border-line-strong transition-all duration-500">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-yellow-tint border border-line group-hover:scale-110 transition-transform duration-500">
                        <Upload className="h-8 w-8 text-ink" />
                      </div>
                      <p className="text-ink text-sm mb-2 text-center font-outfit font-medium">Drag your file(s) or <span className="text-ink cursor-pointer hover:underline">browse</span></p>
                      <p className="text-xs text-ink-muted mb-6 text-center italic">Max 10 MB files are allowed</p>

                      {/* Blue file badge */}
                      <div className="absolute -top-4 right-6">
                        <div className="inline-flex h-8 items-center gap-2 rounded-full bg-brand-yellow px-4 text-xs font-semibold text-ink font-outfit whitespace-nowrap">
                          <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          marketing-asset-v2.webp
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:order-2 relative z-10 max-w-sm flex items-center h-full">
                    <div>
                      {/* Large background number */}
                        <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-ink/[0.07] select-none pointer-events-none z-0 font-outfit" aria-hidden="true">
                        01
                      </div>
                      <h3 className="text-2xl font-bold text-ink mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Install + Connect
                      </h3>
                      <p className="text-ink-muted text-lg leading-relaxed relative z-10 font-normal">
                        Create a free account, install the plugin from WordPress.org, and click Connect. Your API key is saved for you and stored encrypted.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 - AI Analysis: Text Left, Image Right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                  <div className="lg:order-1 relative flex justify-center lg:justify-end items-center h-full">
                    <div className="max-w-sm relative pr-8">
                      {/* Large background number */}
                      <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-ink/[0.07] select-none pointer-events-none z-0 font-outfit" aria-hidden="true">
                        02
                      </div>
                      <h3 className="text-2xl font-bold text-ink mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Generate
                      </h3>
                      <p className="text-ink-muted text-lg leading-relaxed relative z-10 font-normal">
                        Start with one image in the media editor. When you like the results, use{" "}
                        <Link href="/bulk-generate-alt-text-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">bulk processing</Link>{" "}
                        for images missing alt text, or Add Alt Text on any post or page.
                      </p>
                    </div>
                  </div>

                  <div className="lg:order-2 flex justify-center lg:justify-start">
                    {/* Glassmorphic AI Circuit Diagram */}
                    <div className="relative w-full max-w-sm h-64 rounded-3xl p-4 bg-white border border-line shadow-notebook overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-tint to-white rounded-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>

                      {/* Central AI Chip */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-28 h-28 bg-white border border-line rounded-[2rem] flex items-center justify-center shadow-notebook relative overflow-hidden group-hover:border-line-strong transition-colors duration-500">
                          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-tint to-transparent animate-pulse"></div>
                          <Brain className="w-12 h-12 text-ink relative z-10" />
                        </div>
                      </div>

                      {/* Animated Data Pulses */}
                      <div className="absolute top-1/2 left-0 w-1/2 h-0.5 bg-gradient-to-r from-transparent to-line-strong -translate-y-1/2 flex items-center justify-end pr-14">
                        <div className="w-2 h-2 rounded-full bg-brand-yellow animate-ping"></div>
                      </div>
                      <div className="absolute top-0 left-1/2 w-0.5 h-1/2 bg-gradient-to-b from-transparent to-line-strong -translate-x-1/2 flex items-center justify-end pb-14 flex-col">
                        <div className="w-2 h-2 rounded-full bg-brand-yellow animate-ping landing-pulse-delay-500"></div>
                      </div>
                      <div className="absolute top-1/2 right-0 w-1/2 h-0.5 bg-gradient-to-l from-transparent to-line-strong -translate-y-1/2 flex items-center justify-start pl-14">
                        <div className="w-2 h-2 rounded-full bg-brand-yellow animate-ping landing-pulse-delay-1000"></div>
                      </div>
                      <div className="absolute bottom-0 left-1/2 w-0.5 h-1/2 bg-gradient-to-t from-transparent to-line-strong -translate-x-1/2 flex items-center justify-start pt-14 flex-col">
                        <div className="w-2 h-2 rounded-full bg-brand-yellow animate-ping landing-pulse-delay-1500"></div>
                      </div>

                      {/* Decorative nodes */}
                      <div className="absolute top-8 left-8 w-12 h-12 rounded-xl bg-white border border-line flex items-center justify-center shadow-notebook">
                        <Search className="w-5 h-5 text-ink-muted" />
                      </div>
                      <div className="absolute bottom-8 right-8 w-12 h-12 rounded-xl bg-white border border-line flex items-center justify-center shadow-notebook">
                        <BarChart3 className="w-5 h-5 text-ink-muted" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 - Get Alt Text: Image Left, Text Right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                  <div className="lg:order-1 flex justify-center lg:justify-end">
                    {/* Results preview */}
                    <div className="bg-white rounded-3xl border border-line p-6 w-full max-w-sm shadow-notebook relative group">
                      <div className="w-full h-40 rounded-2xl flex items-end justify-center mb-6 relative overflow-hidden bg-white border border-line">
                        <Image src="/red-fox.png" alt="Sample" fill sizes="(min-width: 1024px) 384px, 100vw" className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>

                      {/* Generated Result UI */}
                      <div className="space-y-4 relative z-10">
                        <div className="bg-white rounded-xl p-4 border border-line shadow-notebook">
                          <div className="flex items-center justify-between mb-3">
                            <span className="label-caps">
                              Generated alt text
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-tint text-ink">
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            </div>
                          </div>
                          <p className="text-ink text-sm font-medium leading-relaxed">
                            Close-up of a red fox standing on a sandy beach during a golden hour sunset, with calm ocean waves.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex h-9 flex-1 items-center justify-center rounded-lg border border-line bg-yellow-tint px-3">
                            <span className="text-[11px] font-semibold text-ink font-outfit uppercase tracking-[0.04em]">Editable draft</span>
                          </div>
                          <div className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-yellow px-3">
                            <span className="text-[11px] font-semibold text-ink font-outfit uppercase tracking-[0.04em]">Ready to review</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:order-2 relative max-w-sm flex items-center h-full">
                    <div className="relative">
                      {/* Large background number */}
                      <div className="absolute -top-10 -left-12 text-[10rem] leading-none font-extrabold text-ink/[0.07] select-none pointer-events-none z-0 font-outfit" aria-hidden="true">
                        03
                      </div>
                      <h3 className="text-2xl font-bold text-ink mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        Review + Save
                      </h3>
                      <p className="text-ink-muted text-lg leading-relaxed relative z-10 font-normal">
                        Check the wording, add details the AI could not know, and save. Every description stays editable in WordPress.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product proof section */}
        <section className="py-24 bg-white border-t border-line relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex h-8 items-center gap-2 px-3 rounded-full bg-yellow-soft mb-6">
                <span className="h-2 w-2 rounded-full bg-yellow-strong" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">Product facts</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-ink mb-4 tracking-tight font-outfit">You decide what gets saved</h2>
              <p className="text-ink-muted text-xl max-w-2xl mx-auto font-normal">Alt Text Pro suggests the wording. You stay in charge of what appears on your site.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              <div className="h-full bg-white border border-line p-6 rounded-2xl shadow-notebook">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-soft">
                  <Eye className="h-6 w-6 text-ink" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-ink">Review before saving</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-muted">In the media editor, the draft appears first and is saved only when you apply it. Add product names or page details the AI cannot see.</p>
              </div>

              <div className="h-full bg-white border border-line p-6 rounded-2xl shadow-notebook">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-soft">
                  <Layers className="h-6 w-6 text-ink" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-ink">Bulk runs you can stop</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-muted">Pick missing, all or selected images, choose whether existing alt text can be replaced, and stop after the current image at any time.</p>
              </div>

              <div className="h-full bg-white border border-line p-6 rounded-2xl shadow-notebook">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-soft">
                  <CheckCircle className="h-6 w-6 text-ink" aria-hidden="true" />
                </div>
                <h3 className="font-outfit text-xl font-bold text-ink">Credits only for results</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-muted">A credit is used only when an image gets alt text. If a request fails, you are not charged for it.</p>
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
        <section id="showcase" className="py-24 bg-white relative overflow-hidden border-t border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20 space-y-4">
              <div className="inline-flex h-8 items-center px-3 bg-yellow-soft rounded-full">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">Examples</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold text-ink tracking-tight font-outfit mb-6">
                What the drafts <span className="text-ink italic">look like.</span>
              </h2>
              <p className="text-ink-muted max-w-2xl mx-auto font-normal">Example drafts for three common kinds of image. Results vary with the image and the context you add.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Research Entry 1 */}
              <div className="bg-white border border-line rounded-2xl overflow-hidden group shadow-notebook flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/business-team.jpg"
                    alt="Eight coworkers meet around a table with laptops and charts in a glass-walled office."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                                    <div className="absolute top-4 left-4">
                    <Badge className="h-7 rounded-lg border-none bg-white/95 px-2.5 text-xs font-semibold text-ink shadow-notebook">ENTRY #1024</Badge>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 rounded-full bg-yellow-strong" aria-hidden="true" />
                    <span className="label-caps">AI Draft</span>
                  </div>
                  <p className="text-ink font-medium leading-relaxed mb-6 italic text-base flex-1">
                    "Eight coworkers meet around a table with laptops and charts in a glass-walled office."
                  </p>
                  <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">Generated Alt Text</span>
                    </div>
                    <span className="label-caps">Example output</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 2 */}
              <div className="bg-white border border-line rounded-2xl overflow-hidden group shadow-notebook flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/fresh-vegetables.jpg"
                    alt="Carrots, tomatoes, berries, and leafy greens arranged at a busy farmers market."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                                    <div className="absolute top-4 left-4">
                    <Badge className="h-7 rounded-lg border-none bg-white/95 px-2.5 text-xs font-semibold text-ink shadow-notebook">ENTRY #1025</Badge>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 rounded-full bg-yellow-strong" aria-hidden="true" />
                    <span className="label-caps">AI Draft</span>
                  </div>
                  <p className="text-ink font-medium leading-relaxed mb-6 italic text-base flex-1">
                    "Carrots, tomatoes, berries, and leafy greens arranged at a busy farmers market."
                  </p>
                  <div className="pt-4 border-t border-line flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">Generated Alt Text</span>
                    </div>
                    <span className="label-caps">Example output</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 3 */}
              <div className="bg-white border border-line rounded-2xl overflow-hidden group shadow-notebook flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/mountain-landscape.jpg"
                    alt="Snow-covered mountain peaks and pine trees reflected in a calm lake at sunset."
	                    fill
	                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
	                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                                    <div className="absolute top-4 left-4">
                    <Badge className="h-7 rounded-lg border-none bg-white/95 px-2.5 text-xs font-semibold text-ink shadow-notebook">ENTRY #1026</Badge>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2 w-2 rounded-full bg-yellow-strong" aria-hidden="true" />
                    <span className="label-caps">AI Draft</span>
                  </div>
                  <p className="text-ink font-medium leading-relaxed mb-6 italic text-base flex-1">
                    "Snow-covered mountain peaks and pine trees reflected in a calm lake at sunset."
                  </p>
                  <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">Generated Alt Text</span>
                    </div>
                    <span className="label-caps">Example output</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-line bg-white py-24">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-10">
            <div>
              <p className="label-caps">Questions</p>
              <h2 className="mt-8 max-w-xl font-outfit text-6xl font-bold leading-[0.96] tracking-[-0.07em] text-ink sm:text-7xl">
                Questions
                <br />
                before you
                <br />
                <span className="italic">start.</span>
              </h2>
              <p className="mt-10 max-w-md text-lg leading-7 text-ink-muted">
                Still deciding? Try it on your own images with 150 free credits. No credit card needed. Setup steps are in the{" "}
                <Link href="/docs" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">docs</Link>.
              </p>
              <Button
                className="mt-10"
                onClick={() => { setIsLogin(false); setShowAuthForm(true); }}
              >
                Get 150 free credits
              </Button>
            </div>

            <div className="border-t border-line-strong">
              {HOME_FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="border-b border-line-strong">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-6 py-7 text-left"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    >
                      <span className="font-outfit text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-ink transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {isOpen && <p className="max-w-3xl pb-7 pr-8 text-lg leading-7 text-ink-muted">{faq.answer}</p>}
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
            className="fixed inset-0 bg-ink/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-500"
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
              className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-line animate-in fade-in zoom-in-95 duration-300"
            >
              <button
                type="button"
                onClick={() => setShowAuthForm(false)}
                className={`absolute top-4 right-4 ${buttonVariants({ variant: "ghost", size: "icon-sm" })}`}
                aria-label="Close authentication dialog"
              >
                <X aria-hidden="true" />
              </button>
              <div className="text-center mb-6 mt-2 px-8">
                <h3 id="auth-dialog-title" className="text-2xl font-bold text-ink tracking-tight font-outfit mb-1.5">
                  {isLogin ? "Welcome Back" : "Create Your Account"}
                </h3>
                <p id="auth-dialog-description" className="text-sm text-ink-muted font-normal leading-relaxed">
                  {isLogin ? "Log in to your dashboard." : "Sign up for Alt Text Pro."}
                </p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="auth-email" className="label-caps">Work Email</label>
                  <Input
                    ref={emailInputRef}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="auth-password" className="label-caps">Password</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => void handlePasswordReset()}
                        disabled={isLoading}
                        className="text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="font-medium"
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    isLogin ? "Log In" : "Create Account"
                  )}
                </Button>
              </form>

              {pendingConfirmationEmail && (
                <div className="mt-4 rounded-xl border border-line bg-yellow-tint p-4 text-sm text-ink-muted" role="status">
                  <p>
                    Confirm <span className="font-semibold text-ink">{pendingConfirmationEmail}</span> using the link we emailed you.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleResendConfirmation()}
                    disabled={isLoading}
                    className="mt-2 text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Resend confirmation email
                  </button>
                </div>
              )}

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="label-caps px-4 bg-white">Google Sign In</span>
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
                className="rounded-xl"
              />

              <div className="mt-6 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className={buttonVariants({ variant: "link", size: "sm" })}
                >
                  {isLogin
                    ? "Need an account? Sign up here"
                    : "Already have an account? Log in"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthForm(false)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal - Focused Depth Look */}
        {showPaymentModal && selectedPlan && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-500">
            <div role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-line animate-in fade-in zoom-in-95 duration-300">
              <button
                type="button"
                onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); }}
                className={`absolute top-4 right-4 ${buttonVariants({ variant: "ghost", size: "icon-sm" })}`}
                aria-label="Close checkout dialog"
              >
                <X aria-hidden="true" />
              </button>
              <div className="text-center mb-6 mt-2 px-8">
                <h3 id="payment-dialog-title" className="text-2xl font-bold text-ink tracking-tight font-outfit mb-1.5">
                  {CREDIT_PACKS.some((pack) => pack.id === selectedPlan.id) ? 'Buy Credits' : 'Upgrade Your Subscription'}
                </h3>
                <p className="text-sm text-ink-muted font-normal leading-relaxed">
                  Selected Plan: <span className="text-ink font-bold">{selectedPlan.name}</span>
                </p>
              </div>

              <div className="bg-yellow-tint rounded-xl p-4 mb-6 text-center border border-line">
                <div className="text-3xl font-bold text-ink font-outfit mb-0.5">
                  {selectedPlan.price}
                </div>
                {!['free', 'pay_as_go', 'small_pack', 'credit_pack', 'bulk_pack'].includes(selectedPlan.id) && (
                  <div className="label-caps mt-1">
                    BILLED MONTHLY / ANNUALLY
                  </div>
                )}
              </div>

              {selectedPlan.id === 'free' ? (
                <div className="text-center">
                  <p className="text-sm text-ink-muted mb-6 font-normal">
                    You are currently on the free plan.
                  </p>
                  <Button
                    onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); router.push("/dashboard"); }}
                    className="w-full"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="label-caps">What's Included</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlanFeatures.map((item, i) => (
                        <div key={i} className="flex h-8 items-center gap-2 rounded-full bg-yellow-soft px-3">
                          <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                          <span className="text-sm font-medium text-ink">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePurchase(selectedPlan.id)}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : CREDIT_PACKS.some((pack) => pack.id === selectedPlan.id) ? (
                        `Buy ${selectedPlan.name}`
                      ) : (
                        `Upgrade to ${selectedPlan.name}`
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); }}
                      className={`w-full ${buttonVariants({ variant: "ghost" })}`}
                    >
                      Cancel
                    </button>

                    <div className="flex items-center justify-center gap-2 text-ink-muted">
                      <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs font-medium">Secure checkout by Polar.sh</span>
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
