"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";
import {
  Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket,
  Chrome, Upload, Eye, EyeOff, Download, Check, X, Search,
  CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle,
  RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign,
  Wrench, Globe, LogOut, MessageCircle, Image as ImageIcon, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { PAYPAL_PLAN_IDS, paypalOptions } from '@/lib/paypal';
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton';

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

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (selectedImage && selectedImage.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImage);
      }
    };
  }, [selectedImage]);

  const handleDemoImageSelect = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setGeneratedAltText("");
  };

  const generateDemoAltText = async () => {
    if (!selectedImage) {
      toast.error("Please select an image first");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];

        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          toast.error("Please sign up or sign in to generate alt text");
          setIsGenerating(false);
          setShowAuthForm(true);
          return;
        }

        let apiBase;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
        } else {
          apiBase = '/.netlify/functions';
        }

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

        setIsGenerating(false);
      };

      reader.onerror = () => {
        toast.error("Failed to process image");
        setIsGenerating(false);
      };

      reader.readAsDataURL(blob);

    } catch (error) {
      console.error("Error generating alt text:", error);
      toast.error("Failed to generate alt text.");
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
              credits_remaining: 50
            }
          }
        });
      }

      if (result.error) {
        toast.error(result.error.message);
      } else if (result.data.user) {
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

  // Handle PayPal subscription creation (for subscriptions using SDK)
  const createPayPalSubscription = async (data: any, actions: any) => {
    // Logic handled in PayPalSubscriptionButton component
    return;
  };

  // Handle PayPal payment creation (for one-time payments)
  const createPayPalOrder = async (data: any, actions: any) => {
    try {
      if (!selectedPlan) {
        throw new Error('No plan selected');
      }

      // Create order directly using PayPal SDK
      return actions.order.create({
        purchase_units: [{
          description: `${selectedPlan.name} - 300 Credits`,
          amount: {
            currency_code: 'USD',
            value: '5.00'
          }
        }],
        application_context: {
          brand_name: 'Alt Text Pro',
          shipping_preference: 'NO_SHIPPING'
        }
      });
    } catch (error) {
      console.error('PayPal order creation error:', error);
      toast.error('Failed to create payment. Please try again.');
      throw error;
    }
  };

  // Handle PayPal payment approval (for one-time payments)
  const onPayPalApprove = async (data: any, actions: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // Send order to backend for capture and completion
      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          paymentId: data.orderID,
          planId: selectedPlan.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment completion failed');
      }

      toast.success(`Successfully purchased ${selectedPlan.name}!`);
      setShowPaymentModal(false);
      setSelectedPlan(null);

      // Refresh user data or redirect to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);

    } catch (error) {
      console.error('PayPal approval error:', error);
      toast.error('Payment failed. Please try again.');
    }
  };

  // Handle PayPal payment error
  const onPayPalError = (error: any) => {
    console.error('PayPal error:', error);
    toast.error('Payment failed. Please try again.');
  };

  // Handle PayPal payment cancel
  const onPayPalCancel = (data: any) => {
    console.log('PayPal payment cancelled:', data);
    toast.info('Payment cancelled');
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

      {/* Hero Section */}
      <section className="py-16" style={{ background: 'linear-gradient(135deg, rgba(13, 79, 94, 0.05) 0%, rgba(0, 73, 83, 0.05) 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="text-sm font-medium rounded-full px-3 py-1 inline-block" style={{ color: '#0D4F5E', backgroundColor: 'rgba(13, 79, 94, 0.1)' }}>
                  World's Best AI Tool Accessibility
                </div>

                <h1 className="text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
                  AI Alt Text Generator
                </h1>

                <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl mb-10">
                  Automatically generate accurate, SEO-optimized alt text for your images in over 130 languages with our advanced AI technology.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="text-white px-8 py-4 text-lg font-semibold rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                    onClick={() => {
                      setIsLogin(false);
                      setShowAuthForm(true);
                    }}
                  >
                    Start Free Trial
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold rounded-lg"
                    asChild
                  >
                    <a href="https://wordpress.org/plugins/alt-text-pro/" target="_blank" rel="noopener noreferrer">
                      Get Plugin
                    </a>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>50 free credits</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>130+ languages</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Instant results</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>SEO optimized</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Media Upload Card */}
            <div className="lg:pl-8">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Media Upload</h3>

                {/* Upload Area */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 relative"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#004953';
                    e.currentTarget.style.backgroundColor = 'rgba(13, 79, 94, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
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
                        const imageUrl = URL.createObjectURL(file);
                        handleDemoImageSelect(imageUrl);
                      }
                    }}
                  />
                  {selectedImage ? (
                    <div className="relative w-full h-48">
                      <Image
                        src={selectedImage}
                        alt="Selected"
                        fill
                        className="object-contain rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(null);
                          setGeneratedAltText("");
                        }}
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-gray-50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">Click to upload image</p>
                      <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full h-12 text-white font-semibold rounded-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  disabled={!selectedImage || isGenerating}
                  onClick={generateDemoAltText}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Generate Alt Text
                    </>
                  )}
                </Button>

                {/* Result Area */}
                {generatedAltText && (
                  <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated Alt Text</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedAltText);
                            toast.success("Copied to clipboard!");
                          }}
                        >
                          <Copy className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                      <p className="text-gray-800 text-sm leading-relaxed">{generatedAltText}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - New Visual Design */}
      <section className="py-20" style={{ background: 'linear-gradient(to bottom, rgba(13, 79, 94, 0.05), white)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-sm font-medium mb-2" style={{ color: '#003a42' }}>How It Works .</p>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Let AI Write Your Alt Text
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D4F5E] to-[#004953]">Automatically.</span>
            </h2>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* ===== LOCKED SECTION: Dotted connector images - DO NOT MODIFY POSITIONING ===== */}
            {/* These images are precisely positioned to connect the steps. Any changes should be made as a group. */}
            <img
              src="/dots1.png"
              alt=""
              className="hidden lg:block absolute pointer-events-none"
              style={{
                top: '12%',
                left: '33%',
                width: '20%',
                height: 'auto',
                zIndex: 1,
                objectFit: 'contain'
              }}
            />
            <img
              src="/dots2.png"
              alt=""
              className="hidden lg:block absolute pointer-events-none"
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

            <div className="space-y-20">
              {/* Step 1 - Upload Image: Image Left, Text Right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                <div className="lg:order-1 relative z-10 flex justify-center lg:justify-end">
                  <div className="rounded-2xl p-8 border-2 border-dashed relative w-full max-w-sm" style={{ backgroundColor: 'rgba(13, 79, 94, 0.05)', borderColor: 'rgba(13, 79, 94, 0.3)' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(13, 79, 94, 0.1)' }}>
                      <Upload className="h-8 w-8" style={{ color: '#0D4F5E' }} />
                    </div>
                    <p className="text-gray-600 text-sm mb-1">Drag your file(s) or <span className="underline" style={{ color: '#0D4F5E' }}>browse</span></p>
                    <p className="text-xs text-gray-500 mb-4">Max 10 MB files are allowed</p>

                    {/* Blue file badge */}
                    <div className="absolute -top-3 right-6">
                      <div className="text-white px-3 py-1 rounded-full text-xs font-medium flex items-center" style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}>
                        📎 theprojekts-image.jpg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:order-2 relative z-10 max-w-sm">
                  {/* Large background number */}
                  <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{ fontSize: '6rem', lineHeight: '1' }}>
                    1
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">Upload Image 📁</h3>
                  <p className="text-gray-600 text-sm relative z-10">
                    Use one of our CMS integrations, browser extension, API,
                    or web interface. Optionally include SEO keywords you
                    want to use.
                  </p>
                </div>
              </div>

              {/* Step 2 - AI Analysis: Text Left, Image Right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                <div className="lg:order-1 relative flex justify-center lg:justify-end">
                  <div className="max-w-sm relative pr-8">
                    {/* Large background number */}
                    <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{ fontSize: '6rem', lineHeight: '1' }}>
                      2
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">AI Analysis ⚡</h3>
                    <p className="text-gray-600 text-sm relative z-10">
                      It only takes a second for our technology to examine the
                      image and work its magic.
                    </p>
                  </div>
                </div>

                <div className="lg:order-2 flex justify-center lg:justify-start">
                  {/* Complex AI Circuit Diagram */}
                  <div className="relative w-full max-w-sm h-60 rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(13, 79, 94, 0.1) 0%, rgba(0, 73, 83, 0.15) 100%)' }}>
                    {/* Central AI Chip */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-16 bg-white rounded-lg border-2 flex items-center justify-center shadow-sm" style={{ borderColor: 'rgba(13, 79, 94, 0.4)' }}>
                        <span className="text-xl font-bold" style={{ color: '#003a42' }}>AI</span>
                      </div>
                    </div>

                    {/* Circuit board elements */}
                    {/* Top connections */}
                    <div className="absolute top-4 left-8 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute top-4 left-20 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute top-4 right-20 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute top-4 right-8 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>

                    {/* Side connections */}
                    <div className="absolute left-4 top-16 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute left-4 bottom-16 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute right-4 top-16 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute right-4 bottom-16 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>

                    {/* Bottom connections */}
                    <div className="absolute bottom-4 left-8 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute bottom-4 left-20 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute bottom-4 right-20 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>
                    <div className="absolute bottom-4 right-8 w-3 h-3 rounded-full" style={{ backgroundColor: '#004953' }}></div>

                    {/* Circuit lines */}
                    <div className="absolute top-6 left-11 w-20 h-px" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute top-6 right-11 w-20 h-px" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute bottom-6 left-11 w-20 h-px" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute bottom-6 right-11 w-20 h-px" style={{ backgroundColor: '#0D4F5E' }}></div>

                    {/* Vertical lines */}
                    <div className="absolute left-6 top-8 w-px h-12" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute right-6 top-8 w-px h-12" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute left-6 bottom-8 w-px h-12" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute right-6 bottom-8 w-px h-12" style={{ backgroundColor: '#0D4F5E' }}></div>

                    {/* Corner elements */}
                    <div className="absolute top-6 left-6 w-2 h-2 rounded-full" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute top-6 right-6 w-2 h-2 rounded-full" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute bottom-6 left-6 w-2 h-2 rounded-full" style={{ backgroundColor: '#0D4F5E' }}></div>
                    <div className="absolute bottom-6 right-6 w-2 h-2 rounded-full" style={{ backgroundColor: '#0D4F5E' }}></div>

                    {/* Small icons around the chip */}
                    <div className="absolute top-2 left-16">
                      <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'rgba(13, 79, 94, 0.2)' }}>
                        <span className="text-xs" style={{ color: '#003a42' }}>G</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-16">
                      <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: 'rgba(13, 79, 94, 0.2)' }}>
                        <span className="text-xs" style={{ color: '#003a42' }}>AWS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 - Get Alt Text: Image Left, Text Right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                <div className="lg:order-1 flex justify-center lg:justify-end">
                  {/* Image with mountain scene */}
                  <div className="bg-white rounded-xl border-2 p-4 w-full max-w-sm" style={{ borderColor: 'rgba(13, 79, 94, 0.3)' }}>
                    <div className="w-full h-32 rounded-lg flex items-end justify-center mb-3 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom, rgba(13, 79, 94, 0.3), rgba(0, 73, 83, 0.15), rgba(34, 197, 94, 0.15))' }}>
                      {/* Simple mountain silhouette */}
                      <div className="absolute bottom-0 left-0 w-full h-16 bg-green-200"></div>
                      <div className="absolute bottom-8 left-8 w-20 h-12 bg-gray-400 transform -skew-x-12"></div>
                      <div className="absolute bottom-8 right-8 w-16 h-8 bg-gray-300 transform skew-x-12"></div>
                    </div>

                    {/* Alt text tooltip */}
                    <div className="bg-black text-white px-3 py-2 rounded text-xs relative mb-4">
                      &lt;img ...alt = "alternative text" /&gt;
                      <div className="absolute -top-1 left-6 w-2 h-2 bg-black transform rotate-45"></div>
                    </div>

                    {/* Three options with proper spacing */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg p-3 text-center border" style={{ backgroundColor: 'rgba(13, 79, 94, 0.05)', borderColor: 'rgba(13, 79, 94, 0.3)' }}>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border" style={{ borderColor: 'rgba(13, 79, 94, 0.4)' }}>
                          <Eye className="h-4 w-4" style={{ color: '#003a42' }} />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Screen readers</p>
                      </div>

                      <div className="rounded-lg p-3 text-center border" style={{ backgroundColor: 'rgba(13, 79, 94, 0.05)', borderColor: 'rgba(13, 79, 94, 0.3)' }}>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border" style={{ borderColor: 'rgba(13, 79, 94, 0.4)' }}>
                          <Search className="h-4 w-4" style={{ color: '#003a42' }} />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Search engines</p>
                      </div>

                      <div className="rounded-lg p-3 text-center border" style={{ backgroundColor: 'rgba(13, 79, 94, 0.05)', borderColor: 'rgba(13, 79, 94, 0.3)' }}>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border" style={{ borderColor: 'rgba(13, 79, 94, 0.4)' }}>
                          <X className="h-4 w-4" style={{ color: '#003a42' }} />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Broken images</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:order-2 relative max-w-sm">
                  {/* Large background number */}
                  <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{ fontSize: '6rem', lineHeight: '1' }}>
                    3
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">Get Alt Text 📋</h3>
                  <p className="text-gray-600 text-sm relative z-10">
                    We generate an accurate description of the image, ready to be
                    used on your site.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use Our Alt Text Generator Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Why Use Our Alt Text
                <br />
                Generator?
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Our AI-powered tool ensures your images are accessible to everyone while
                improving your website's SEO performance. Save time and create better
                content with our intelligent alt text generation.
              </p>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Alt Text Generation</h3>
                    <p className="text-gray-600">
                      Our advanced AI understands your image content and creates
                      contextually accurate and SEO-optimized descriptions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Eye className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">SEO Optimization</h3>
                    <p className="text-gray-600">
                      Boost your search engine rankings with properly optimized alt text
                      that helps search engines understand your visual content.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(13, 79, 94, 0.1)' }}>
                    <Zap className="h-6 w-6" style={{ color: '#003a42' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Batch Processing & Automation</h3>
                    <p className="text-gray-600">
                      Process multiple images at once and integrate with your
                      workflow for seamless content creation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Demo Image */}
            <div className="relative">
              <div className="bg-gray-100 rounded-2xl p-8">
                <div className="aspect-w-4 aspect-h-3 rounded-lg mb-6 overflow-hidden relative h-64">
                  <Image
                    src="/red-fox.png"
                    alt="Red fox standing on sandy beach during golden hour sunset with ocean waves in background"
                    fill
                    className="object-cover rounded-lg"
                  />
                </div>
                <div className="text-sm text-gray-600 mb-2">Sample Image (fox on the beach):</div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-gray-800 italic">
                    "Young fox standing on sandy beach during golden hour sunset with ocean waves in background"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 mb-4">Choose the plan that fits your needs</p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <span className={`text-sm font-medium transition-colors min-w-[60px] text-right ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${billingCycle === 'annual'
                  ? 'bg-teal-600 focus:ring-teal-400'
                  : 'bg-gray-300 focus:ring-gray-400'
                  }`}
                style={billingCycle === 'annual'
                  ? { background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }
                  : {}
                }
                role="switch"
                aria-checked={billingCycle === 'annual'}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-9' : 'translate-x-1'
                    }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors min-w-[50px] text-left ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
                Annual
              </span>
              <span className={`text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded transition-opacity duration-300 min-w-[70px] text-center ${billingCycle === 'annual' ? 'opacity-100' : 'opacity-0'
                }`}>
                Save 10%
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 transition-colors"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(13, 79, 94, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f3f4f6'}>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  $0
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    {billingCycle === 'monthly' ? 'per Month' : 'per Year'}
                  </span>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">50 Credits</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Basic support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">API access</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePlanSelection('free', 'Free', '$0')}
                  className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Get Started
                </Button>
              </div>
            </div>

            {/* Tier 1 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 transition-colors"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(13, 79, 94, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f3f4f6'}>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 1</h3>
                <div className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  ${billingCycle === 'monthly' ? '12' : '129'}
                  <span className="text-xl text-gray-600 font-normal ml-1">USD</span>
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    {billingCycle === 'monthly' ? 'per Month' : 'per Year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-2">$10.75/month billed annually</p>
                )}

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">1,000 Credits{billingCycle === 'annual' ? '/Month' : ''}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Priority support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">API access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Bulk processing</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier1', 'Tier 1', billingCycle === 'monthly' ? '$12' : '$129')}
                  className="w-full text-white"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                >
                  Choose Plan
                </Button>
              </div>
            </div>

            {/* Tier 2 - Most Popular */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 relative transform scale-105" style={{ borderColor: '#0D4F5E' }}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="text-white px-4 py-1 rounded-full text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}>Most Popular</span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 2</h3>
                <div className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  ${billingCycle === 'monthly' ? '20' : '216'}
                  <span className="text-xl text-gray-600 font-normal ml-1">USD</span>
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    {billingCycle === 'monthly' ? 'per Month' : 'per Year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-2">$18/month billed annually</p>
                )}

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">2,400 Credits{billingCycle === 'annual' ? '/Month' : ''}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Premium support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">API Access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Priority processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Bulk processing</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier2', 'Tier 2', billingCycle === 'monthly' ? '$20' : '$216')}
                  className="w-full text-white"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                >
                  Choose Plan
                </Button>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 transition-colors"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(13, 79, 94, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f3f4f6'}>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 3</h3>
                <div className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  ${billingCycle === 'monthly' ? '40' : '432'}
                  <span className="text-xl text-gray-600 font-normal ml-1">USD</span>
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    {billingCycle === 'monthly' ? 'per Month' : 'per Year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-2">$36/month billed annually</p>
                )}

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">5,000 Credits{billingCycle === 'annual' ? '/Month' : ''}</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Premium support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">API Access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Priority processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">Bulk Processing</span>
                  </div>
                </div>

                <Button
                  onClick={() => handlePlanSelection('tier3', 'Tier 3', billingCycle === 'monthly' ? '$40' : '$432')}
                  className="w-full text-white"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                >
                  Choose Plan
                </Button>
              </div>
            </div>
          </div>

          {/* Pay As You Go Section */}
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl shadow-lg p-8 border-2 border-teal-100">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <DollarSign className="h-6 w-6 text-[#0D4F5E]" />
                    <h3 className="text-2xl font-bold text-gray-900">Pay As You Go</h3>
                  </div>
                  <p className="text-gray-600 mb-2">Need extra credits? Top up anytime!</p>
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <span className="text-3xl font-bold" style={{ color: '#003a42' }}>$5</span>
                    <span className="text-gray-500">for</span>
                    <span className="text-2xl font-semibold text-[#0D4F5E]">300 Credits</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">Never expire</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Add to existing credits</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Works with any plan</span>
                  </div>
                </div>
                <Button
                  onClick={() => handlePlanSelection('pay_as_go', 'Pay As You Go', '$5')}
                  className="text-white px-8 py-3 text-lg whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                >
                  Buy Credits
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600">
              All plans include our advanced AI alt-text generation and multi-language support.
              <br />
              Need a custom plan? <Link href="/contact" className="font-medium transition-colors" style={{ color: '#0D4F5E' }} onMouseEnter={(e) => e.currentTarget.style.color = '#003a42'} onMouseLeave={(e) => e.currentTarget.style.color = '#0D4F5E'}>Contact us</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Example Alt Text Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Example Alt Text</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Example 1 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-w-4 aspect-h-3 relative h-48">
                <Image
                  src="/business-team.jpg"
                  alt="Business team collaborating around conference table"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-sm leading-relaxed italic mb-4">
                  "Business team collaborating around conference table in modern office
                  with laptops and documents"
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    ✓ Approved
                  </Badge>
                  <span className="text-xs text-gray-500">92% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Example 2 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-w-4 aspect-h-3 relative h-48">
                <Image
                  src="/fresh-vegetables.jpg"
                  alt="Fresh organic vegetables and fruits"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-sm leading-relaxed italic mb-4">
                  "Fresh organic vegetables and fruits colorfully arranged at farmers market"
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    ✓ Approved
                  </Badge>
                  <span className="text-xs text-gray-500">96% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Example 3 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-w-4 aspect-h-3 relative h-48">
                <Image
                  src="/mountain-landscape.jpg"
                  alt="Snow-capped mountain peaks"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-sm leading-relaxed italic mb-4">
                  &quot;Snow-capped mountain peaks reflecting in pristine alpine lake during golden hour&quot;
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    ✓ Approved
                  </Badge>
                  <span className="text-xs text-gray-500">94% Accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Start your free trial today
          </h2>
          <p className="text-xl mb-8" style={{ color: 'rgba(255, 255, 255, 0.95)' }}>
            First 100 images alt text. No credit card required.
          </p>

          <Button
            size="lg"
            className="bg-white hover:bg-gray-50 font-semibold px-8 py-4 text-lg rounded-lg transition-colors"
            style={{ color: '#003a42' }}
            onClick={() => {
              setIsLogin(false);
              setShowAuthForm(true);
            }}
          >
            Start Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Auth Modal */}
      {showAuthForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {isLogin ? "Sign In" : "Get Started"}
              </h3>
              <p className="text-gray-600">
                {isLogin ? "Welcome back! Sign in to your account" : "Sign up for your free trial"}
              </p>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder={isLogin ? "Enter your password" : "Create a password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : (
                  isLogin ? "Sign In" : "Start Free Trial"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">or</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
              variant="outline"
              className="w-full h-12 text-base font-semibold border-2 transition-colors"
              style={{
                borderColor: '#003a42',
                color: '#003a42',
                backgroundColor: 'transparent'
              }}
            >
              {isGoogleLoading ? (
                <>
                  <Chrome className="mr-2 h-5 w-5" style={{ color: '#003a42' }} />
                  Connecting...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5" style={{ color: '#003a42' }} />
                  Continue with Google
                </>
              )}
            </Button>

            <div className="text-center mt-6 space-y-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium transition-colors"
                style={{ color: '#0D4F5E' }}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Complete Your Purchase
              </h3>
              <p className="text-gray-600 mb-4">
                You selected: {selectedPlan.name}
              </p>
              <div className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>
                {selectedPlan.price}
                {selectedPlan.id !== 'free' && selectedPlan.id !== 'pay_as_go' && (
                  <span className="text-lg text-gray-500">/month</span>
                )}
              </div>
            </div>

            {selectedPlan.id === 'free' ? (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  You already have access to the free plan!
                </p>
                <Button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedPlan(null);
                    window.location.href = "/dashboard";
                  }}
                  className="w-full text-white"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Plan includes:</h4>
                  <div className="space-y-2">
                    {selectedPlan.id === 'tier1' && (
                      <>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">1,000 Credits per month</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Priority support</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">API access</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Bulk processing</span>
                        </div>
                      </>
                    )}
                    {selectedPlan.id === 'tier2' && (
                      <>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">2,500 Credits per month</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Premium support</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">API access</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Bulk processing</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Custom integrations</span>
                        </div>
                      </>
                    )}
                    {selectedPlan.id === 'pay_as_go' && (
                      <>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">300 Credits (one-time)</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">No monthly commitment</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">API access</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-sm text-gray-700">Standard support</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  {/* For subscriptions, use PayPal SDK subscription button */}
                  {(selectedPlan.id === 'tier1' || selectedPlan.id === 'tier2' || selectedPlan.id === 'tier3') ? (
                    <>
                      {(() => {
                        const planIdKey = billingCycle === 'annual' ? 'annual' : 'monthly';
                        const paypalPlanId = PAYPAL_PLAN_IDS[selectedPlan.id]?.[planIdKey];
                        console.log('Selected Plan:', selectedPlan.id);
                        console.log('Billing Cycle:', billingCycle);
                        console.log('Plan ID Key:', planIdKey);
                        console.log('PayPal Plan ID:', paypalPlanId);
                        console.log('All Plan IDs:', PAYPAL_PLAN_IDS);
                        return null;
                      })()}
                      <PayPalSubscriptionButton
                        planId={billingCycle === 'annual' ? `${selectedPlan.id}_annual` : selectedPlan.id}
                        planName={`${selectedPlan.name}${billingCycle === 'annual' ? ' (Annual)' : ''}`}
                        paypalPlanId={PAYPAL_PLAN_IDS[selectedPlan.id]?.[billingCycle === 'annual' ? 'annual' : 'monthly']}
                        onSuccess={() => {
                          toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
                          setShowPaymentModal(false);
                          setSelectedPlan(null);
                          setTimeout(() => {
                            window.location.href = "/dashboard";
                          }, 1500);
                        }}
                        onError={(error: any) => {
                          console.error('PayPal subscription error:', error);
                          toast.error(error.message || 'Subscription failed. Please try again.');
                        }}
                      />
                    </>
                  ) : (
                    <PayPalScriptProvider options={paypalOptions}>
                      <PayPalButtons
                        createOrder={createPayPalOrder}
                        onApprove={onPayPalApprove}
                        onError={onPayPalError}
                        onCancel={onPayPalCancel}
                        style={{
                          layout: "vertical",
                          color: "blue",
                          shape: "rect",
                          label: "paypal"
                        }}
                      />
                    </PayPalScriptProvider>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedPlan(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
