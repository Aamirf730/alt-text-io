"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { getApiBase } from '@/lib/utils';
import { trackMarketingEvent } from '@/lib/analytics';
import { toast } from "sonner";
import {
  Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
  Chrome, Upload, Eye, EyeOff, Download, Check, X, Search,
  CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle,
  RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign,
  Wrench, Globe, LogOut, MessageCircle, Image as ImageIcon,
  Sparkles, Mail, BarChart3, Clock, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
// Polar.sh product IDs from environment variables
const POLAR_PRODUCTS = {
  tier1_monthly: process.env.NEXT_PUBLIC_POLAR_TIER1_MONTHLY || '',
  tier1_annual: process.env.NEXT_PUBLIC_POLAR_TIER1_ANNUAL || '',
  tier2_monthly: process.env.NEXT_PUBLIC_POLAR_TIER2_MONTHLY || '',
  tier2_annual: process.env.NEXT_PUBLIC_POLAR_TIER2_ANNUAL || '',
  tier3_monthly: process.env.NEXT_PUBLIC_POLAR_TIER3_MONTHLY || '',
  tier3_annual: process.env.NEXT_PUBLIC_POLAR_TIER3_ANNUAL || '',
  small_pack: process.env.NEXT_PUBLIC_POLAR_SMALL_PACK || '',
  credit_pack: process.env.NEXT_PUBLIC_POLAR_CREDIT_PACK || '',
};

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedAltText, setGeneratedAltText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');

  const router = useRouter();

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
            emailRedirectTo: window.location.origin + '/email-confirmed',
            data: {
              subscription_plan: 'free',
              credits_remaining: 30
            }
          }
        });
      }

      if (result.error) {
        toast.error(result.error.message);
      } else if (result.data.user) {
        if (!isLogin) {
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

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      console.error("Google auth error:", error);
      toast.error("Google sign-in failed: " + error.message);
    } finally {
      setIsGoogleLoading(false);
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
  const redirectToCheckout = (productId: string, userEmail?: string) => {
    if (!productId) {
      toast.error('Product not configured. Please contact support.');
      return;
    }

    let checkoutUrl = `/api/checkout?products=${productId}`;

    // Add customer email if user is logged in
    if (userEmail) {
      checkoutUrl += `&customerEmail=${encodeURIComponent(userEmail)}`;
    }

    trackMarketingEvent("checkout_started", {
      source: "landing_page",
      userId: user?.id,
      userEmail: userEmail || user?.email,
      properties: {
        product_id: productId,
        plan_id: selectedPlan?.id,
        billing_cycle: billingCycle,
      },
    });

    window.location.href = checkoutUrl;
  };

  // Get the correct Polar product ID based on plan and billing cycle
  const getPolarProductId = (planId: string, cycle: string): string => {
    if (planId === 'tier1') {
      return cycle === 'annual' ? POLAR_PRODUCTS.tier1_annual : POLAR_PRODUCTS.tier1_monthly;
    }
    if (planId === 'tier2') {
      return cycle === 'annual' ? POLAR_PRODUCTS.tier2_annual : POLAR_PRODUCTS.tier2_monthly;
    }
    if (planId === 'tier3') {
      return cycle === 'annual' ? POLAR_PRODUCTS.tier3_annual : POLAR_PRODUCTS.tier3_monthly;
    }
    if (planId === 'small_pack') {
      return POLAR_PRODUCTS.small_pack;
    }
    if (planId === 'credit_pack') {
      return POLAR_PRODUCTS.credit_pack;
    }
    return '';
  };

  // Handle purchase/upgrade
  const handlePurchase = async (planId: string) => {
    setIsLoading(true);
    try {
      if (planId === 'free') {
        setShowPaymentModal(false);
        setSelectedPlan(null);
        router.push("/dashboard");
        return;
      }

      const productId = getPolarProductId(planId, billingCycle);
      redirectToCheckout(productId, user?.email);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error("Failed to start purchase.");
    } finally {
      setIsLoading(true); // Keep loading state until redirect
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
      <div className="relative overflow-hidden">
        {/* Notebook-style Subtle Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[600px] bg-gradient-to-b from-notebook-blue/5 to-transparent blur-[120px] opacity-70 select-none pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <section className="pt-8 pb-20 lg:pt-12 lg:pb-32">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Side - Content */}
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="space-y-6">
                  <div className="inline-flex rounded-full px-4 py-1.5 bg-notebook-blue/5 border border-notebook-blue/10 backdrop-blur-md">
                    <span className="text-xs font-bold tracking-wider uppercase text-notebook-blue/80">WordPress Alt Text in Minutes</span>
                  </div>

                  <h1 className="text-6xl lg:text-8xl font-bold font-outfit text-notebook-slate leading-[1.05] tracking-tight mb-6">
                    Generate WordPress <br />
                    <span className="text-notebook-blue italic decoration-notebook-blue/10">Alt Text.</span>
                  </h1>

                  <p className="text-xl lg:text-2xl text-slate-500 leading-relaxed max-w-2xl mb-10 font-normal">
                    Install the plugin, connect your account, and generate accurate AI alt text for media-library, post, and product images.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-5">
                    <Button
                      size="lg"
                      className="h-14 px-10 text-lg font-bold rounded-full bg-notebook-blue hover:bg-notebook-blue/90 text-white shadow-notebook transition-all duration-300 transform hover:-translate-y-1"
                      onClick={() => {
                        setIsLogin(false);
                        setShowAuthForm(true);
                      }}
                    >
                      Get 30 Free Credits
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 px-10 text-lg font-semibold rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:text-notebook-blue transition-all duration-300 text-notebook-slate"
                      asChild
                    >
                      <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer">
                        Install WordPress Plugin
                      </a>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-8 mt-10">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-5 w-5 rounded-full bg-notebook-blue/10 flex items-center justify-center">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className="text-sm font-semibold text-slate-400">One-Click WordPress Integration</span>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <div className="h-5 w-5 rounded-full bg-notebook-blue/10 flex items-center justify-center">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className="text-sm font-semibold text-slate-400">Secure & Private Processing</span>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <div className="h-5 w-5 rounded-full bg-notebook-blue/10 flex items-center justify-center">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className="text-sm font-semibold text-slate-400">No Credit Card Required</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Premium Notebook Card */}
              <div className="lg:pl-8 animate-in fade-in zoom-in-95 duration-1000 delay-150">
                <div className="bg-white rounded-[2.5rem] p-10 relative z-10 border border-gray-100 shadow-notebook-lg">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-bold font-outfit text-notebook-slate">
                      Alt Text Generator
                    </h3>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-notebook-surface border border-gray-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-notebook-blue animate-pulse" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Online</span>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div
                    className="border border-notebook-blue/10 rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 bg-notebook-surface/50 hover:bg-white hover:border-notebook-blue/30 mb-8 relative overflow-hidden group/upload shadow-inner"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleDemoImageSelect(file);
                        }
                      }}
                    />
                    {selectedImage ? (
                      <div className="relative w-full h-52">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedImage}
                          alt="Selected"
                          className="h-full w-full object-contain rounded-2xl"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                            setGeneratedAltText("");
                          }}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-slate-50 border border-gray-100 transition-all hover:scale-110 active:scale-90"
                        >
                          <X className="h-4 w-4 text-slate-600" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 relative z-10">
                        <div className="bg-white rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover/upload:scale-110 transition-transform duration-500 shadow-notebook border border-gray-100">
                          <Upload className="h-8 w-8 text-notebook-blue" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-notebook-slate font-outfit">Optimize an image</p>
                          <p className="text-sm text-gray-400 font-normal">Drag & drop or <span className="text-notebook-blue hover:underline">browse files</span></p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generate Button */}
                  <Button
                    className="w-full h-14 text-white font-bold rounded-2xl transition-all duration-300 bg-notebook-blue hover:bg-notebook-blue/90 shadow-notebook group/btn"
                    disabled={!selectedImage || isGenerating}
                    onClick={generateDemoAltText}
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                        <span className="font-outfit text-sm">Analyzing Image...</span>
                      </div>
                    ) : (
                      <span className="font-outfit uppercase tracking-wider text-xs">Get Alt Text</span>
                    )}
                  </Button>

                  {/* Result Area */}
                  {generatedAltText && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                      <div className="bg-notebook-surface rounded-2xl p-6 border border-gray-100 relative group/result">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">
                            Smart Alt Text
                          </span>
                          <button
                            className="text-gray-400 hover:text-notebook-blue transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedAltText);
                              toast.success("Copied to clipboard!");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-notebook-slate text-sm leading-relaxed font-normal italic">"{generatedAltText}"</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* How It Works - Premium Design */}
        <section className="py-24 bg-white relative">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-24">
              <h2 className="text-4xl lg:text-6xl font-bold text-notebook-slate mb-6 tracking-tight font-outfit">
                First Alt Text
                <br />
                <span className="text-notebook-blue italic">Without Guesswork.</span>
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-xl font-normal">
                The setup path is built around one outcome: connect WordPress and generate your first useful image description fast.
              </p>
            </div>

            <div className="relative max-w-6xl mx-auto">
              {/* ===== LOCKED SECTION: Dotted connector images - DO NOT MODIFY POSITIONING ===== */}
              {/* These images are precisely positioned to connect the steps. Any changes should be made as a group. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dots1.png"
                alt=""
                className="hidden lg:block absolute pointer-events-none opacity-20 invert"
                style={{
                  top: '12%',
                  left: '33%',
                  width: '20%',
                  height: 'auto',
                  zIndex: 1,
                  objectFit: 'contain'
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dots2.png"
                alt=""
                className="hidden lg:block absolute pointer-events-none opacity-20 invert"
                style={{
                  top: '47%',
                  left: '22%',
                  width: '35%',
                  height: 'auto',
                  zIndex: 1,
                  objectFit: 'contain'
                }}
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
                      <div className="absolute -top-10 -left-12 font-extrabold text-notebook-blue/5 select-none pointer-events-none z-0 font-outfit" style={{ fontSize: '10rem', lineHeight: '1' }}>
                        01
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        <div className="w-10 h-10 rounded-2xl bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10 text-notebook-blue text-sm font-bold">01</div>
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
                      <div className="absolute -top-10 -left-12 font-extrabold text-notebook-blue/5 select-none pointer-events-none z-0 font-outfit" style={{ fontSize: '10rem', lineHeight: '1' }}>
                        02
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        <div className="w-10 h-10 rounded-2xl bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10 text-notebook-blue text-sm font-bold">02</div>
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
                        <div className="w-2 h-2 rounded-full bg-notebook-orange animate-ping" style={{ animationDelay: '0.5s' }}></div>
                      </div>
                      <div className="absolute top-1/2 right-0 w-1/2 h-0.5 bg-gradient-to-l from-transparent to-notebook-blue/30 -translate-y-1/2 flex items-center justify-start pl-14">
                        <div className="w-2 h-2 rounded-full bg-notebook-blue animate-ping" style={{ animationDelay: '1s' }}></div>
                      </div>
                      <div className="absolute bottom-0 left-1/2 w-0.5 h-1/2 bg-gradient-to-t from-transparent to-notebook-orange/30 -translate-x-1/2 flex items-center justify-start pt-14 flex-col">
                        <div className="w-2 h-2 rounded-full bg-notebook-orange animate-ping" style={{ animationDelay: '1.5s' }}></div>
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
                              <Sparkles className="w-3 h-3 text-notebook-orange" /> Optimized Alt Text
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
                          <div className="flex-1 bg-notebook-blue/5 rounded-lg border border-notebook-blue/10 py-2 px-3 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-notebook-blue" />
                            <span className="text-[10px] font-bold text-notebook-black/60 font-outfit uppercase">Accessibility Standards</span>
                          </div>
                          <div className="flex-1 bg-notebook-orange/5 rounded-lg border border-notebook-orange/10 py-2 px-3 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-notebook-orange" />
                            <span className="text-[10px] font-bold text-notebook-black/60 font-outfit uppercase">SEO Rank 1</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:order-2 relative max-w-sm flex items-center h-full">
                    <div>
                      {/* Large background number */}
                      <div className="absolute -top-10 -left-12 font-extrabold text-notebook-blue/5 select-none pointer-events-none z-0 font-outfit" style={{ fontSize: '10rem', lineHeight: '1' }}>
                        03
                      </div>
                      <h3 className="text-2xl font-bold text-notebook-slate mb-4 relative z-10 flex items-center gap-3 font-outfit uppercase tracking-wider">
                        <div className="w-10 h-10 rounded-2xl bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10 text-notebook-blue text-sm font-bold">03</div>
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

        {/* Powerful Features Section */}
        <section className="py-32 bg-notebook-paper relative overflow-hidden border-y border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-bold text-notebook-slate mb-6 font-outfit tracking-tight">
                Built for Reliability
              </h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto font-normal">
                Studio-grade tools for agencies and content teams who demand accessibility compliance with ranking authority.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 hover:border-notebook-blue/20 transition-all duration-500 group shadow-sm hover:shadow-notebook">
                <div className="w-14 h-14 bg-notebook-blue/5 border border-notebook-blue/10 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500">
                  <Brain className="h-7 w-7 text-notebook-blue" />
                </div>
                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">Advanced Technology</h3>
                <p className="text-slate-500 leading-relaxed font-normal text-sm">
                  Smart AI that understands your images. We don't just describe photos; we create SEO-friendly descriptions that rank.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 hover:border-notebook-blue/20 transition-all duration-500 group shadow-sm hover:shadow-notebook">
                <div className="w-14 h-14 bg-notebook-blue/5 border border-notebook-blue/10 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500">
                  <Globe className="h-7 w-7 text-notebook-blue" />
                </div>
                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">Global Reach</h3>
                <p className="text-slate-500 leading-relaxed font-normal text-sm">
                  Deploy accessibility in 130+ languages. Our AI maintains semantic precision across borders, ensuring global compliance.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 hover:border-notebook-blue/20 transition-all duration-500 group shadow-sm hover:shadow-notebook">
                <div className="w-14 h-14 bg-notebook-blue/5 border border-notebook-blue/10 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500">
                  <BarChart3 className="h-7 w-7 text-notebook-blue" />
                </div>
                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">Library Audit</h3>
                <p className="text-slate-500 leading-relaxed font-normal text-sm">
                  Live analytics on your media accessibility. Identify coverage gaps and monitor SEO performance gains in real-time.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 hover:border-notebook-blue/20 transition-all duration-500 group shadow-sm hover:shadow-notebook">
                <div className="w-14 h-14 bg-notebook-blue/5 border border-notebook-blue/10 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500">
                  <Zap className="h-7 w-7 text-notebook-blue" />
                </div>
                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">Bulk Generation</h3>
                <p className="text-slate-500 leading-relaxed font-normal text-sm">
                  Automate thousands of descriptions in minutes. Designed for massive media libraries needing rapid, consistent optimization.
                </p>
              </div>
            </div>
          </div>
        </section >

        {/* Social Proof Section */}
        <section className="py-24 bg-white border-t border-notebook-blue/5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-notebook-blue/5 border border-notebook-blue/10 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-notebook-blue animate-pulse" />
                <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Customer Love</span>
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-notebook-slate mb-4 tracking-tight font-outfit">Loved by early adopters</h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-normal">Join visionary teams building accessible, SEO-optimized experiences from day one.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <div className="bg-notebook-paper border border-notebook-blue/10 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300">
                <div className="flex gap-1 text-notebook-orange mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-notebook-black font-medium leading-relaxed mb-8 text-sm italic">
                  "This completely transformed our workflow. Manually writing alt text used to be a chore we dreaded. The AI generates perfect, SEO-rich descriptions instantly. It's like having an extra pair of hands."
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shadow-sm">
                    <Image src="/client_avatar_1.png" alt="Clara Vanni" fill sizes="40px" className="object-cover" />
                  </div>
                  <div>
                    <h4 className="text-notebook-black font-bold text-xs uppercase tracking-wider font-outfit">Clara Vanni</h4>
                    <p className="text-[10px] text-notebook-black/40 font-bold uppercase tracking-widest">Startup Founder</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-notebook-paper border border-notebook-orange/20 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300 relative transform md:-translate-y-4">
                <div className="absolute -top-3 -right-3 text-4xl text-notebook-orange/20 font-serif">"</div>
                <div className="flex gap-1 text-notebook-orange mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-notebook-black font-medium leading-relaxed mb-8 text-sm italic">
                  "As a small team, we didn't have the resources to manually tag every image. Alt Text AI integrated seamlessly and handled our entire media library in minutes. A huge time-saver."
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shadow-sm">
                    <Image src="/client_avatar_2.png" alt="Tariq Hasan" fill sizes="40px" className="object-cover" />
                  </div>
                  <div>
                    <h4 className="text-notebook-black font-bold text-xs uppercase tracking-wider font-outfit">Tariq Hasan</h4>
                    <p className="text-[10px] text-notebook-black/40 font-bold uppercase tracking-widest">Lead Developer</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-notebook-paper border border-notebook-blue/10 p-8 rounded-[2rem] hover:shadow-notebook transition-all duration-300">
                <div className="flex gap-1 text-notebook-orange mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-notebook-black font-medium leading-relaxed mb-8 text-sm italic">
                  "Accessibility matters, but it's hard to make time for it. This tool runs quietly in the background, ensuring our content is inclusive and SEO-friendly without adding to our workload."
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shadow-sm">
                    <Image src="/client_avatar_3.png" alt="Elena Rostova" fill sizes="40px" className="object-cover" />
                  </div>
                  <div>
                    <h4 className="text-notebook-black font-bold text-xs uppercase tracking-wider font-outfit">Elena Rostova</h4>
                    <p className="text-[10px] text-notebook-black/40 font-bold uppercase tracking-widest">Content Marketer</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-32 bg-notebook-paper relative overflow-hidden border-t border-notebook-blue/5">
          {/* Subtle Background Accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] bg-gradient-to-b from-notebook-blue/5 to-transparent blur-[100px] opacity-60 pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20 space-y-6">
              <div className="inline-flex px-4 py-2 rounded-full bg-notebook-blue/5 border border-notebook-blue/10">
                <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Subscription Management</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold text-notebook-slate tracking-tight font-outfit">
                Start Free, Then
                <br />
                <span className="text-notebook-blue italic">Scale Credits.</span>
              </h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto font-normal">
                Try the full WordPress flow with 30 free generations. Upgrade only when you are ready to process more images.
              </p>

              {/* Refined Billing Cycle Toggle */}
              <div className="flex flex-col items-center justify-center mt-12">
                <div className="flex items-center p-1.5 bg-white border border-gray-100 rounded-2xl shadow-notebook-sm">
                  <button
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 font-outfit ${billingCycle === 'monthly' ? 'bg-notebook-blue text-white shadow-notebook' : 'text-gray-400 hover:text-notebook-slate'}`}
                    onClick={() => setBillingCycle('monthly')}
                  >
                    Monthly Access
                  </button>
                  <button
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 font-outfit relative flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-notebook-blue text-white shadow-notebook' : 'text-gray-400 hover:text-notebook-slate'}`}
                    onClick={() => setBillingCycle('annual')}
                  >
                    Annual Billing
                    <span className={`static ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-lg bg-notebook-orange/10 text-notebook-orange border border-notebook-orange/20 whitespace-nowrap`}>
                      -20%
                    </span>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-gray-400 mt-6 flex items-center gap-1.5 uppercase tracking-widest leading-none">
                  <Info className="w-3 h-3" /> 1 Credit = 1 AI-Optimized Alt Text
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Free Plan */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 flex flex-col relative group hover:shadow-notebook transition-all duration-500">
                <div className="mb-10">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 font-outfit">Free Plan</h3>
                  <div className="flex items-baseline gap-1 text-notebook-slate mb-2">
                    <span className="text-4xl font-bold tracking-tight font-outfit">$0</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">/mo</span>
                  </div>
                  <p className="text-xs text-notebook-blue font-bold font-outfit tracking-wide italic">"Connect WordPress and test the workflow"</p>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                      <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-500 font-normal">30 free generations</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                      <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-500 font-normal">WordPress plugin included</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                      <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-500 font-normal">No credit card required</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePlanSelection('free', 'Free', '$0')}
                  className="w-full h-12 bg-notebook-paper border border-gray-100 text-notebook-slate hover:bg-white hover:text-notebook-blue hover:shadow-notebook transition-all duration-300 rounded-2xl font-bold font-outfit text-xs uppercase tracking-widest"
                >
                  Start with 30 Credits
                </Button>
              </div>

              {/* Lite */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 flex flex-col relative group hover:shadow-notebook transition-all duration-500">
                {billingCycle === 'annual' && (
                  <div className="absolute top-6 right-6">
                    <Badge className="bg-notebook-blue/5 text-notebook-blue border-notebook-blue/10 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                      BEST FOR SMALL BLOGS
                    </Badge>
                  </div>
                )}
                <div className="mb-10">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 font-outfit">Lite Plan</h3>
                  <div className="flex items-baseline gap-1 text-notebook-slate mb-2">
                    <span className="text-4xl font-bold tracking-tight font-outfit">${billingCycle === 'monthly' ? '3' : '30'}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {billingCycle === 'monthly' ? '/mo' : '/yr'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    `150 credits${billingCycle === 'annual' ? '/mo' : ''}`,
                    "Auto-generate on upload",
                    "Single image generation",
                    "Standard support"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className="text-sm text-slate-500 font-normal">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier1', 'Lite', billingCycle === 'monthly' ? '$3' : '$30')}
                  className="w-full h-12 bg-white border border-gray-100 text-notebook-slate hover:bg-slate-50 hover:text-notebook-blue transition-all duration-300 rounded-2xl font-bold font-outfit text-xs uppercase tracking-widest shadow-sm"
                >
                  Get Lite Plan
                </Button>
              </div>

              {/* Standard - Most Popular */}
              <div className="bg-white border-2 border-notebook-blue rounded-[2.5rem] p-10 flex flex-col relative transform lg:-translate-y-4 shadow-notebook-lg z-10 transition-all duration-500">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-notebook-blue text-white text-[9px] font-bold px-4 py-1.5 rounded-full shadow-notebook flex items-center gap-2 uppercase tracking-[0.2em] font-outfit">
                    <Star className="w-3 h-3 fill-current text-notebook-orange" /> Most Popular
                  </div>
                </div>

                <div className="mb-10 mt-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 font-outfit">Standard Plan</h3>
                  <div className="flex items-baseline gap-1 text-notebook-slate mb-2">
                    <span className="text-5xl font-bold tracking-tight font-outfit">${billingCycle === 'monthly' ? '5' : '48'}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {billingCycle === 'monthly' ? '/mo' : '/yr'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    `400 credits${billingCycle === 'annual' ? '/mo' : ''}`,
                    "Bulk media-library fixes",
                    "130+ language support",
                    "Post and page image workflows",
                    "Priority support"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className={`text-sm font-normal ${i === 4 ? 'text-notebook-slate font-bold' : 'text-slate-500'}`}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier2', 'Standard', billingCycle === 'monthly' ? '$5' : '$48')}
                  className="w-full h-14 bg-notebook-blue hover:bg-notebook-blue/90 text-white transition-all duration-300 rounded-2xl font-bold font-outfit text-xs uppercase tracking-[0.2em] shadow-notebook hover:-translate-y-1"
                >
                  Get Standard Plan
                </Button>
              </div>

              {/* Pro */}
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 flex flex-col relative group hover:shadow-notebook transition-all duration-500">
                <div className="mb-10">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 font-outfit">Pro Plan</h3>
                  <div className="flex items-baseline gap-1 text-notebook-slate mb-2">
                    <span className="text-4xl font-bold tracking-tight font-outfit">${billingCycle === 'monthly' ? '9' : '86'}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {billingCycle === 'monthly' ? '/mo' : '/yr'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    `1,000 credits${billingCycle === 'annual' ? '/mo' : ''}`,
                    "Context-aware generation",
                    "Large library processing",
                    "WooCommerce image workflows",
                    "Premium support"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-lg bg-notebook-blue/5 flex items-center justify-center border border-notebook-blue/10">
                        <Check className="h-3 w-3 text-notebook-blue" strokeWidth={3} />
                      </div>
                      <span className="text-sm text-slate-500 font-normal">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier3', 'Pro', billingCycle === 'monthly' ? '$9' : '$86')}
                  className="w-full h-12 bg-white border border-gray-100 text-notebook-slate hover:bg-slate-50 hover:text-notebook-blue transition-all duration-300 rounded-2xl font-bold font-outfit text-xs uppercase tracking-widest shadow-sm"
                >
                  Get Pro Plan
                </Button>
              </div>
            </div>

            {/* Pay As You Go Section - Refined */}
            <div className="mt-20 max-w-4xl mx-auto">
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 relative overflow-hidden group shadow-sm hover:shadow-notebook transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-notebook-blue/5 to-transparent opacity-50 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                  <div className="md:w-1/3 text-center md:text-left space-y-4">
                    <div className="inline-flex px-3 py-1.5 bg-notebook-orange/10 border border-notebook-orange/20 rounded-full">
                      <span className="text-[10px] font-bold text-notebook-orange uppercase tracking-widest font-outfit">Pay As You Go</span>
                    </div>
                    <h3 className="text-2xl font-bold text-notebook-slate font-outfit italic">Pay As You Go</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-normal">Need more credits? Buy them instantly without changing your subscription.</p>
                  </div>

                  <div className="md:w-2/3 grid sm:grid-cols-2 gap-5 w-full">
                    {/* Small Pack */}
                    <div
                      className="bg-notebook-paper rounded-[2rem] p-6 border border-gray-100 hover:border-notebook-blue/30 transition-all duration-500 group/pack cursor-pointer shadow-sm hover:shadow-notebook-sm"
                      onClick={() => handlePlanSelection('small_pack', 'Starter Pack', '$5')}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-2xl font-bold text-notebook-slate font-outfit">$5</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ONE-TIME</span>
                          </div>
                          <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">100 CREDITS</span>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover/pack:scale-110 transition-transform duration-500 border border-gray-100">
                          <ImageIcon className="w-5 h-5 text-gray-400 group-hover/pack:text-notebook-blue" />
                        </div>
                      </div>
                      <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest font-outfit text-gray-500 hover:text-notebook-blue hover:bg-white border border-transparent hover:border-notebook-blue/10">
                        Buy Credits
                      </Button>
                    </div>

                    {/* Credit Pack */}
                    <div
                      className="bg-notebook-paper rounded-[2rem] p-6 border border-notebook-orange/20 hover:border-notebook-orange/40 transition-all duration-500 group/pack cursor-pointer shadow-sm hover:shadow-notebook-sm relative"
                      onClick={() => handlePlanSelection('credit_pack', 'Value Pack', '$10')}
                    >
                      <div className="absolute -top-3 right-6 bg-notebook-orange text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-notebook font-outfit uppercase tracking-widest z-10">
                        Value Pack
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-2xl font-bold text-notebook-slate font-outfit">$10</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ONE-TIME</span>
                          </div>
                          <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">250 CREDITS</span>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover/pack:scale-110 transition-transform duration-500 border border-gray-100">
                          <Rocket className="w-5 h-5 text-gray-400 group-hover/pack:text-notebook-orange" />
                        </div>
                      </div>
                      <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest font-outfit text-gray-500 hover:text-notebook-orange hover:bg-white border border-transparent hover:border-notebook-orange/10">
                        Buy Credits
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center mt-10 border-t border-gray-100 pt-8">
                  {[
                    { icon: Clock, label: "Never expire" },
                    { icon: Layers, label: "Add to existing pool" },
                    { icon: CheckCircle, label: "All plan support" }
                  ].map((item, i) => (
                    <span key={i} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      {/* Simplified labels for space, assuming icons are added to imports if needed, or using check for simplicity */}
                      <div className="w-1.5 h-1.5 rounded-full bg-notebook-blue/30" />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-center mt-16 relative z-10">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Each successful generation uses 1 credit. Failed requests do not consume credits.
                <br className="hidden md:block" />
                <span className="mt-4 inline-block">Need agency or multi-site volume? <Link href="/contact" className="text-notebook-blue hover:underline">Contact us</Link></span>
              </p>
            </div>
          </div>
        </section >

        {/* Example Showcase Section - Warmer Research Hub Style */}
        <section id="showcase" className="py-32 bg-white relative overflow-hidden border-t border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20 space-y-4">
              <div className="inline-flex px-3 py-1 bg-notebook-blue/5 rounded-full border border-notebook-blue/10">
                <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Real-time Previews</span>
              </div>
              <h2 className="text-4xl lg:text-6xl font-bold text-notebook-slate tracking-tight font-outfit mb-6">
                See Results <span className="text-notebook-blue italic">in Action.</span>
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto font-normal">Preview the high-quality, SEO-optimized alt text generated by our AI.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Research Entry 1 */}
              <div className="bg-notebook-paper border border-notebook-blue/5 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/business-team.jpg"
	                    alt="Alt Text Preview"
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
                    <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">SEO Optimized</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Group of diverse professionals collaborating around a light-filled office table, emphasizing teamwork and shared digital strategy."
                  </p>
                  <div className="pt-6 border-t border-notebook-blue/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-notebook-blue" />
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">98% Accuracy</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 2 */}
              <div className="bg-notebook-paper border border-notebook-orange/10 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col md:-translate-y-4">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/fresh-vegetables.jpg"
	                    alt="Alt Text Preview"
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
                    <span className="text-[10px] font-bold text-notebook-orange uppercase tracking-widest font-outfit">SEO Optimized</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Fresh organic vegetables and fruits colorfully arranged at farmers market, capturing natural textures and vibrant agricultural diversity."
                  </p>
                  <div className="pt-6 border-t border-notebook-orange/10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-notebook-orange" />
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">96% Accuracy</span>
                  </div>
                </div>
              </div>

              {/* Research Entry 3 */}
              <div className="bg-notebook-paper border border-notebook-blue/5 rounded-[2.5rem] overflow-hidden group hover:shadow-notebook transition-all duration-500 flex flex-col">
                <div className="relative h-64 overflow-hidden">
                  <Image
                    src="/mountain-landscape.jpg"
	                    alt="Alt Text Preview"
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
                    <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">SEO Optimized</span>
                  </div>
                  <p className="text-notebook-slate font-medium leading-relaxed mb-8 italic text-sm flex-1">
                    "Snow-capped mountain peaks reflecting in pristine alpine lake during golden hour, showcasing atmospheric depth and natural clarity."
                  </p>
                  <div className="pt-6 border-t border-notebook-blue/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-notebook-blue" />
                      <span className="text-[10px] font-bold text-notebook-slate uppercase tracking-widest font-outfit">Generated Alt Text</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">94% Accuracy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section - Research Protocol Initiation */}
        <section className="py-32 bg-notebook-paper relative overflow-hidden border-t border-notebook-blue/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-white border border-notebook-blue/10 rounded-[3rem] p-12 md:p-20 text-center shadow-notebook-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-notebook-blue/5 blur-[100px] rounded-full pointer-events-none"></div>

              <div className="relative z-10 space-y-10">
                <div className="inline-flex px-4 py-2 bg-notebook-blue/5 rounded-full">
                  <span className="text-xs font-bold text-notebook-blue uppercase tracking-widest font-outfit">WordPress Ready</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-bold text-notebook-slate tracking-tight font-outfit leading-[1.1]">
                  Connect Your Site <br />
                  <span className="text-notebook-blue italic">And Generate One.</span>
                </h2>
                <p className="text-xl text-slate-500 font-normal max-w-2xl mx-auto leading-relaxed">
                  Start with 30 free AI-powered alt text generations. No credit card required, and the plugin can connect automatically from WordPress.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                  <Button
                    size="lg"
                    className="h-16 px-12 bg-notebook-blue hover:bg-notebook-blue/90 text-white rounded-2xl font-bold font-outfit text-sm uppercase tracking-widest shadow-notebook hover:-translate-y-1 transition-all duration-300"
                    onClick={() => { setIsLogin(false); setShowAuthForm(true); }}
                  >
                    Get 30 Free Credits
                  </Button>
                  <Link href="/docs#installation" className="text-xs font-bold text-notebook-slate/60 hover:text-notebook-blue uppercase tracking-widest transition-colors font-outfit group border-b border-transparent hover:border-notebook-blue pb-1">
                    View Install Guide
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        < Footer />

        {/* Auth Modal - Focused Depth Look */}
        {showAuthForm && (
          <div className="fixed inset-0 bg-notebook-slate/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-500">
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-notebook-blue/5 animate-in fade-in zoom-in-95 duration-300">
              <button
                onClick={() => setShowAuthForm(false)}
                className="absolute top-6 right-6 text-slate-300 hover:text-notebook-slate transition-colors p-2 hover:bg-slate-50 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-5 mt-2">
                <h3 className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit mb-1.5">
                  {isLogin ? "Welcome Back" : "Create Your Account"}
                </h3>
                <p className="text-sm text-slate-500 font-normal leading-relaxed">
                  {isLogin ? "Log in to your dashboard." : "Sign up for Alt Text Pro."}
                </p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-notebook-slate/40 uppercase tracking-widest ml-1">Work Email</label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-notebook-paper border-none text-notebook-slate placeholder:text-slate-300 rounded-2xl focus:ring-2 focus:ring-notebook-blue/20 transition-all font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-notebook-slate/40 uppercase tracking-widest ml-1">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 bg-notebook-paper border-none text-notebook-slate placeholder:text-slate-300 rounded-2xl focus:ring-2 focus:ring-notebook-blue/20 transition-all font-medium"
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

              <Button
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                variant="outline"
                className="w-full h-12 border-notebook-blue/10 bg-notebook-paper hover:bg-white hover:text-notebook-blue text-notebook-slate rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 font-bold font-outfit text-xs uppercase tracking-widest"
              >
                {isGoogleLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-notebook-blue"></div>
                ) : (
                  <>
                    <Chrome className="w-4 h-4 text-notebook-blue" />
                    Google Sign In
                  </>
                )}
              </Button>

              <div className="text-center mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[10px] font-bold text-notebook-slate/40 hover:text-notebook-blue uppercase tracking-widest transition-colors font-outfit"
                >
                  {isLogin
                    ? "Need an account? Sign up here"
                    : "Already have an account? Log in"}
                </button>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(false)}
                    className="text-[10px] font-bold text-slate-300 hover:text-notebook-orange uppercase tracking-widest transition-colors"
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
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-notebook-lg relative overflow-y-auto max-h-[95vh] border border-notebook-blue/5 animate-in fade-in zoom-in-95 duration-300">
              <button
                onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); }}
                className="absolute top-6 right-6 text-slate-300 hover:text-notebook-slate transition-colors p-2 hover:bg-slate-50 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-5 mt-2">
                <h3 className="text-2xl font-bold text-notebook-slate tracking-tight font-outfit mb-1.5">
                  Upgrade Your Subscription
                </h3>
                <p className="text-sm text-slate-500 font-normal leading-relaxed">
                  Selected Plan: <span className="text-notebook-blue font-bold">{selectedPlan.name}</span>
                </p>
              </div>

              <div className="bg-notebook-paper rounded-xl p-4 mb-6 text-center border border-notebook-blue/5">
                <div className="text-3xl font-bold text-notebook-slate font-outfit mb-0.5">
                  {selectedPlan.price}
                </div>
                {selectedPlan.id !== 'free' && selectedPlan.id !== 'pay_as_go' && (
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
                    onClick={() => { setShowPaymentModal(false); setSelectedPlan(null); window.location.href = "/dashboard"; }}
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
                      {(selectedPlan.id === 'tier1' ? [
                        "150 Monthly Credits", "Auto-Pilot Analysis", "High-Fidelity AI", "Standard Support"
                      ] : selectedPlan.id === 'tier2' ? [
                        "400 Monthly Credits", "Bulk Library Optimization", "Multi-Language (130+)", "SEO Compliance", "Priority Support"
                      ] : selectedPlan.id === 'tier3' ? [
                        "1,000 Monthly Credits", "Context-Aware Generation", "Full Auto-Pilot Suite", "Custom API Access", "24/7 Strategic Support"
                      ] : selectedPlan.id === 'small_pack' ? [
                        "100 Credit Injection", "On-Demand Resource", "Never Expires", "Immediate Utility"
                      ] : [
                        "250 Credit Injection", "Efficiency Pack Bonus", "Never Expires", "Strategic Utility"
                      ]).map((item, i) => (
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
    </div >
  );
}
