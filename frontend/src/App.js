import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Separator } from "./components/ui/separator";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket, Mail, Chrome, Upload, Eye, EyeOff, Download, Check, X, Search, CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle, RefreshCw } from "lucide-react";

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

// Debug Supabase configuration
console.log('🔧 Supabase Configuration:');
console.log('  - URL:', supabaseUrl);
console.log('  - Anon Key:', supabaseAnonKey ? (supabaseAnonKey.substring(0, 20) + '...') : 'NOT SET');
console.log('  - Env URL:', process.env.REACT_APP_SUPABASE_URL || 'NOT SET');
console.log('  - Env Key:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

// Check if using placeholder values
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('⚠️ WARNING: Supabase is using placeholder values! Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    site: window.location.origin === 'http://localhost:3000' 
      ? 'http://localhost:3000' 
      : 'https://www.alt-text.pro'
  }
});

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test';
const paypalOptions = {
  "client-id": PAYPAL_CLIENT_ID,
  currency: "USD",
  intent: "capture",
  "enable-funding": "venmo",
  "disable-funding": "paylater,card"
};

// Landing Page Component
const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [generatedAltText, setGeneratedAltText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState(null); // Track logged-in user
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'annual'

  // Check authentication state on mount and when auth changes
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
      subscription.unsubscribe();
    };
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedImage && selectedImage.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImage);
      }
    };
  }, [selectedImage]);

  const sampleImages = [
    {
      url: "/api/placeholder/300/200",
      alt: "Business team collaborating around conference table in modern office with laptop and documents"
    },
    {
      url: "/api/placeholder/300/200", 
      alt: "Fresh organic vegetables and fruits colorful display at farmers market"
    },
    {
      url: "/api/placeholder/300/200",
      alt: "Snow-capped mountain peaks reflecting in pristine alpine lake during golden hour"
    }
  ];

  // Handle demo image selection
  const handleDemoImageSelect = (imageUrl) => {
    setSelectedImage(imageUrl);
    setGeneratedAltText("");
  };

  // Demo alt text generation - calls real API
  const generateDemoAltText = async () => {
    if (!selectedImage) {
      toast.error("Please select an image first");
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Convert blob URL to base64
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        
        // Check for Supabase session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          toast.error("Please sign up or sign in to generate alt text");
          setIsGenerating(false);
          setShowAuthForm(true);
          return;
        }
        
        // Determine API endpoint - use local development or production
        // For localhost, try Netlify Dev server first, fallback to production
        let apiBase;
        if (window.location.hostname === 'localhost') {
          // Check if we're running with Netlify Dev (port 8888)
          // If not available, use production API
          apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
        } else {
          // Production - use relative path
          apiBase = '/.netlify/functions';
        }
        
        const endpoint = `${apiBase}/generate-alt-text`;
        
        // Prepare headers with Supabase auth token
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        };
        
        console.log('🔍 Generating alt-text from homepage:', {
          endpoint,
          hasImage: !!base64Data,
          imageSize: base64Data?.length,
          hasToken: !!session.access_token
        });
        
        // Call the real API
        try {
          const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
              image_base64: base64Data,
              context: "Landing page demo"
            })
          });
          
          // Check if response is OK before parsing JSON
          let data;
          try {
            const responseText = await apiResponse.text();
            if (!responseText) {
              throw new Error('Empty response from server');
            }
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            toast.error("Invalid response from server. Please try again.");
            setIsGenerating(false);
            return;
          }
          
          if (apiResponse.ok) {
            setGeneratedAltText(data.alt_text || data.altText);
            
            // Refresh profile to get updated credits (for display if user stays on page)
            // Note: This is for homepage - credits will be correct when user goes to dashboard
            try {
              const { data: { user: authUser } } = await supabase.auth.getUser();
              if (authUser) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('credits_remaining')
                  .eq('id', authUser.id)
                  .single();
                
                if (profile) {
                  console.log('📊 Updated credits after generation:', profile.credits_remaining);
                }
              }
            } catch (err) {
              console.error('Error refreshing credits:', err);
            }
            
            toast.success("Alt text generated successfully!");
          } else {
            if (apiResponse.status === 401) {
              toast.error("Session expired. Please sign in again.");
              setShowAuthForm(true);
            } else if (apiResponse.status === 402) {
              toast.error("No credits remaining. Please upgrade your plan.");
            } else {
              toast.error(data.error || "Failed to generate alt text. Please try again.");
            }
          }
        } catch (fetchError) {
          console.error("API fetch error:", fetchError);
          if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
            toast.error("Cannot connect to the API server. If running locally, make sure Netlify Dev is running or use the production site.");
          } else {
            toast.error("Failed to connect to the server. Please check your connection.");
          }
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
      toast.error("Failed to generate alt text. Please try again.");
      setIsGenerating(false);
    }
  };

  // Handle email/password authentication
  const handleEmailAuth = async (e) => {
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
            emailRedirectTo: window.location.origin + '/dashboard',
            data: {
              subscription_plan: 'free_trial',
              credits_remaining: 100
            }
          }
        });
        
        // Debug signup result
        console.log('🔧 Signup Result:', {
          user: result.data?.user?.id,
          session: result.data?.session?.access_token ? 'Present' : 'Missing',
          error: result.error?.message,
          emailConfirmed: result.data?.user?.email_confirmed_at ? 'Yes' : 'No'
        });
      }

      if (result.error) {
        console.error('🔧 Auth Error:', result.error);
        if (result.error.message.includes('Email not confirmed')) {
          toast.success("Please check your email and click the confirmation link!");
        } else if (result.error.message.includes('already registered') || result.error.message.includes('User already registered')) {
          toast.error("This email is already registered. Please sign in instead.");
          setIsLogin(true);
        } else {
          toast.error(result.error.message || "Authentication failed. Please try again.");
        }
      } else if (result.data.user) {
        // Check if email confirmation is required
        const requiresEmailConfirmation = !result.data.session;
        const emailConfirmed = result.data.user.email_confirmed_at !== null;
        
        console.log('🔧 User Status:', {
          requiresEmailConfirmation,
          emailConfirmed,
          email: result.data.user.email
        });
        
        if (!isLogin && requiresEmailConfirmation && !emailConfirmed) {
          toast.success(
            "Account created! Please check your email (" + email + ") and click the confirmation link. Didn't receive it? Check spam folder.",
            { duration: 8000 }
          );
          
          // Log for debugging
          console.log('📧 Email confirmation required for:', email);
          console.log('📧 Supabase URL:', supabaseUrl);
          
          // Show warning if Supabase not configured
          if (supabaseUrl === 'https://placeholder.supabase.co') {
            toast.error("⚠️ Supabase is not configured! Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY", { duration: 10000 });
          }
        } else {
          // Ensure profile exists with credits for both signup and login
          if (result.data.session) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('credits_remaining, id')
                .eq('id', result.data.user.id)
                .single();
              
              // If profile doesn't exist, create it with default credits
              if (profileError || !profile) {
                console.log('Profile not found, creating profile with default credits');
                const { error: insertError } = await supabase
                  .from('profiles')
                  .insert({
                    id: result.data.user.id,
                    email: result.data.user.email,
                    subscription_plan: 'free_trial',
                    credits_remaining: 100,
                    total_processed: 0
                  });
                
                if (insertError) {
                  console.error('Error creating profile:', insertError);
                  // Continue anyway, the trigger might create it
                }
              } else if (profile.credits_remaining === null || profile.credits_remaining === undefined) {
                // Profile exists but no credits, update it
                console.log('Profile exists but has no credits, updating');
                await supabase
                  .from('profiles')
                  .update({
                    credits_remaining: 100,
                    subscription_plan: 'free_trial'
                  })
                  .eq('id', result.data.user.id);
              }
            } catch (profileCreateError) {
              console.error('Error ensuring profile exists:', profileCreateError);
              // Continue anyway
            }
          }
          
          // Update user state before redirect
          if (result.data.session?.user) {
            setUser({
              email: result.data.session.user.email,
              id: result.data.session.user.id
            });
          }
          
          toast.success(isLogin ? "Welcome back!" : "Welcome to Alt Text Pro!");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    
    try {
      // Dynamic redirect URL based on environment
      const redirectUrl = window.location.origin + '/dashboard';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (error) {
        console.error('OAuth Error:', error);
        toast.error("Google sign-in failed: " + error.message);
      } else {
        toast.success("Redirecting to Google...");
      }
    } catch (error) {
      console.error("Google auth error:", error);
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle plan selection
  const handlePlanSelection = (planId, planName, planPrice) => {
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

  // Handle PayPal payment creation
  const createPayPalOrder = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          planId: selectedPlan.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment creation failed');
      }

      return result.paymentId;
    } catch (error) {
      console.error('PayPal order creation error:', error);
      toast.error('Failed to create payment. Please try again.');
      throw error;
    }
  };

  // Handle PayPal payment approval
  const onPayPalApprove = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          paymentId: data.orderID,
          planId: selectedPlan.id,
          isSubscription: selectedPlan.id === 'tier1' || selectedPlan.id === 'tier2' || selectedPlan.id === 'tier3'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment completion failed');
      }

      toast.success(`Successfully upgraded to ${selectedPlan.name}!`);
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
  const onPayPalError = (error) => {
    console.error('PayPal error:', error);
    toast.error('Payment failed. Please try again.');
  };

  // Handle PayPal payment cancel
  const onPayPalCancel = (data) => {
    console.log('PayPal payment cancelled:', data);
    toast.info('Payment cancelled');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg transform -rotate-12" style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  <Zap className="h-5 w-5 text-white transform rotate-12" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
              </div>
            </div>

            {/* Centered Navigation Links */}
            <div className="hidden lg:flex items-center space-x-12">
              <a href="#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
              <a href="#support" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Support</a>
              <a href="#blog" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Blog</a>
            </div>

            {/* Right Side Buttons */}
            <div className="hidden lg:flex items-center space-x-3">
              {user ? (
                <>
                  <Button 
                    variant="ghost" 
                    className="text-white bg-blue-600 hover:bg-blue-700 font-medium px-6 py-2.5 rounded-full"
                    onClick={() => {
                      window.location.href = "/dashboard";
                    }}
                  >
                    Dashboard
                  </Button>
                  <Button 
                    className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      toast.success("Signed out successfully");
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    className="text-white bg-blue-600 hover:bg-blue-700 font-medium px-6 py-2.5 rounded-full"
                    onClick={() => {
                      setIsLogin(true);
                      setShowAuthForm(true);
                    }}
                  >
                    Sign In
                  </Button>
                  <Button 
                    className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                    onClick={() => {
                      setIsLogin(false);
                      setShowAuthForm(true);
                    }}
                  >
                    Free Trial
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="text-sm font-medium text-blue-600 bg-blue-100 rounded-full px-3 py-1 inline-block">
                  World's Best AI Tool Accessibility
                </div>
                
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  AI Alt Text Generator
                </h1>
                
                <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                  Automatically generate alt text for images in over 130 languages.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg"
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
                  >
                    Get Plugin
                  </Button>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>100 free credits</span>
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
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4 relative"
                  onClick={() => document.getElementById('image-upload').click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!selectedImage) {
                      e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (!selectedImage) {
                      e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                    const files = e.dataTransfer.files;
                    if (files[0] && files[0].type.startsWith('image/')) {
                      // Revoke previous URL if exists
                      if (selectedImage && selectedImage.startsWith('blob:')) {
                        URL.revokeObjectURL(selectedImage);
                      }
                      const file = files[0];
                      const imageUrl = URL.createObjectURL(file);
                      setSelectedImage(imageUrl);
                      setGeneratedAltText("");
                    }
                  }}
                >
                  {selectedImage ? (
                    <>
                      <img
                        src={selectedImage}
                        alt="Uploaded preview"
                        className="max-w-full max-h-64 mx-auto rounded-lg mb-2"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedImage && selectedImage.startsWith('blob:')) {
                            URL.revokeObjectURL(selectedImage);
                          }
                          setSelectedImage(null);
                          setGeneratedAltText("");
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-gray-500 mt-2">Click to replace image</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Upload className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                    </>
                  )}
                </div>
                
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      // Revoke previous URL if exists
                      if (selectedImage && selectedImage.startsWith('blob:')) {
                        URL.revokeObjectURL(selectedImage);
                      }
                      const file = e.target.files[0];
                      const imageUrl = URL.createObjectURL(file);
                      setSelectedImage(imageUrl);
                      setGeneratedAltText("");
                    }
                  }}
                />
                
                {/* Generate Button */}
                <Button 
                  onClick={generateDemoAltText}
                  disabled={!selectedImage || isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium mb-4"
                >
                  {isGenerating ? 'Generating...' : 'Generate Alt Text'}
                </Button>
                
                {/* Generated Alt Text Result */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Generated Alt Text:</label>
                  <div className="relative bg-gray-50 rounded-lg p-3 border min-h-[60px] flex items-center">
                    {generatedAltText ? (
                      <>
                        <p className="text-sm text-gray-800 pr-8">
                          "{generatedAltText}"
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedAltText);
                            toast.success("Alt text copied to clipboard!");
                          }}
                          className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Alt text will appear here after generation...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - New Visual Design */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-blue-600 text-sm font-medium mb-2">How It Works .</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Let AI Write Your Alt Text
              <br />
              Automatically.
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
                  <div className="bg-blue-50 rounded-2xl p-8 border-2 border-dashed border-blue-200 relative w-full max-w-sm">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-gray-600 text-sm mb-1">Drag your file(s) or <span className="text-blue-600 underline">browse</span></p>
                    <p className="text-xs text-gray-500 mb-4">Max 10 MB files are allowed</p>
                    
                    {/* Blue file badge */}
                    <div className="absolute -top-3 right-6">
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
                        📎 theprojekts-image.jpg
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:order-2 relative z-10 max-w-sm">
                  {/* Large background number */}
                  <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{fontSize: '6rem', lineHeight: '1'}}>
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
                    <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{fontSize: '6rem', lineHeight: '1'}}>
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
                  <div className="relative w-full max-w-sm h-60 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
                    {/* Central AI Chip */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-16 bg-white rounded-lg border-2 border-blue-300 flex items-center justify-center shadow-sm">
                        <span className="text-xl font-bold text-blue-600">AI</span>
                      </div>
                    </div>
                    
                    {/* Circuit board elements */}
                    {/* Top connections */}
                    <div className="absolute top-4 left-8 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute top-4 left-20 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute top-4 right-20 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute top-4 right-8 w-3 h-3 bg-blue-500 rounded-full"></div>
                    
                    {/* Side connections */}
                    <div className="absolute left-4 top-16 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute left-4 bottom-16 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute right-4 top-16 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute right-4 bottom-16 w-3 h-3 bg-blue-500 rounded-full"></div>
                    
                    {/* Bottom connections */}
                    <div className="absolute bottom-4 left-8 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute bottom-4 left-20 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute bottom-4 right-20 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute bottom-4 right-8 w-3 h-3 bg-blue-500 rounded-full"></div>
                    
                    {/* Circuit lines */}
                    <div className="absolute top-6 left-11 w-20 h-px bg-blue-400"></div>
                    <div className="absolute top-6 right-11 w-20 h-px bg-blue-400"></div>
                    <div className="absolute bottom-6 left-11 w-20 h-px bg-blue-400"></div>
                    <div className="absolute bottom-6 right-11 w-20 h-px bg-blue-400"></div>
                    
                    {/* Vertical lines */}
                    <div className="absolute left-6 top-8 w-px h-12 bg-blue-400"></div>
                    <div className="absolute right-6 top-8 w-px h-12 bg-blue-400"></div>
                    <div className="absolute left-6 bottom-8 w-px h-12 bg-blue-400"></div>
                    <div className="absolute right-6 bottom-8 w-px h-12 bg-blue-400"></div>
                    
                    {/* Corner elements */}
                    <div className="absolute top-6 left-6 w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="absolute top-6 right-6 w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="absolute bottom-6 left-6 w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="absolute bottom-6 right-6 w-2 h-2 bg-blue-600 rounded-full"></div>
                    
                    {/* Small icons around the chip */}
                    <div className="absolute top-2 left-16">
                      <div className="w-6 h-6 bg-blue-200 rounded flex items-center justify-center">
                        <span className="text-xs text-blue-600">G</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-16">
                      <div className="w-6 h-6 bg-blue-200 rounded flex items-center justify-center">
                        <span className="text-xs text-blue-600">AWS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 - Get Alt Text: Image Left, Text Right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start relative">
                <div className="lg:order-1 flex justify-center lg:justify-end">
                  {/* Image with mountain scene */}
                  <div className="bg-white rounded-xl border-2 border-blue-200 p-4 w-full max-w-sm">
                    <div className="w-full h-32 bg-gradient-to-b from-blue-200 via-blue-100 to-green-100 rounded-lg flex items-end justify-center mb-3 relative overflow-hidden">
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
                      <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border border-blue-300">
                          <Eye className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Screen readers</p>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border border-blue-300">
                          <Search className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Search engines</p>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border border-blue-300">
                          <X className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-xs font-medium text-gray-700">Broken images</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:order-2 relative max-w-sm">
                  {/* Large background number */}
                  <div className="absolute -top-2 -left-10 font-bold text-gray-300 opacity-70 select-none pointer-events-none z-0" style={{fontSize: '6rem', lineHeight: '1'}}>
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
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-blue-600" />
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
                <div className="aspect-w-4 aspect-h-3 rounded-lg mb-6 overflow-hidden">
                  <img 
                    src="/red-fox.png" 
                    alt="Red fox standing on sandy beach during golden hour sunset with ocean waves in background"
                    className="w-full h-full object-cover rounded-lg"
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

      {/* Alt Text Best Practices */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Alt Text Best Practices</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Do's */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-green-700">Do's</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Be specific and descriptive about the image content</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Keep from short under 125 characters when possible</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Include relevant keywords for SEO</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Consider the context and purpose of the image</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Use natural, flowing language</span>
                </li>
              </ul>
            </div>

            {/* Don'ts */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-red-700">Don'ts</h3>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Start with "Image of" or "Picture of"</span>
                </li>
                <li className="flex items-start space-x-3">
                  <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Be vague or overly generic</span>
                </li>
                <li className="flex items-start space-x-3">
                  <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Include unnecessary technical information</span>
                </li>
                <li className="flex items-start space-x-3">
                  <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Repeat information from the surrounding text</span>
                </li>
                <li className="flex items-start space-x-3">
                  <X className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Use excessive keyword stuffing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>



      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 mb-8">Choose the plan that fits your needs</p>
            
            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  billingCycle === 'annual' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
                Annual
                <span className="ml-2 text-xs text-blue-600 font-semibold">Save 20%</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="text-4xl font-bold text-blue-600 mb-2">$0</div>
                <p className="text-gray-600 mb-6">per month</p>
                
                <div className="space-y-2 mb-8">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">100 Credits</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Basic support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">API access</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handlePlanSelection('free_trial', 'Free', '$0')}
                  className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Get Started
                </Button>
              </div>
            </div>

            {/* Tier 1 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 1</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${billingCycle === 'annual' ? '12' : '15'}
                  <span className="text-sm text-gray-600 font-normal ml-1">
                    {billingCycle === 'annual' ? '/month billed annually' : '/month'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-4">$144/year (Save 20%)</p>
                )}
                
                <div className="space-y-2 mb-8">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">1,000 Credits</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Priority support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">API access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Bulk processing</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handlePlanSelection('tier1', 'Tier 1', billingCycle === 'annual' ? '$144' : '$15')}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Choose Plan
                </Button>
              </div>
            </div>

            {/* Tier 2 - Most Popular */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-blue-500 relative transform scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">Most Popular</span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 2</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${billingCycle === 'annual' ? '20' : '25'}
                  <span className="text-sm text-gray-600 font-normal ml-1">
                    {billingCycle === 'annual' ? '/month billed annually' : '/month'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-4">$240/year (Save 20%)</p>
                )}
                
                <div className="space-y-2 mb-8">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">2,500 Credits</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Premium support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Advanced API access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Priority processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Bulk processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Custom integrations</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handlePlanSelection('tier2', 'Tier 2', billingCycle === 'annual' ? '$240' : '$25')}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Choose Plan
                </Button>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tier 3</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  ${billingCycle === 'annual' ? '36' : '45'}
                  <span className="text-sm text-gray-600 font-normal ml-1">
                    {billingCycle === 'annual' ? '/month billed annually' : '/month'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-4">$432/year (Save 20%)</p>
                )}
                
                <div className="space-y-2 mb-8">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">5,000 Credits</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Premium support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Advanced API access</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Priority processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Unlimited bulk processing</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 whitespace-nowrap">Dedicated support</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handlePlanSelection('tier3', 'Tier 3', billingCycle === 'annual' ? '$432' : '$45')}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  Choose Plan
                </Button>
              </div>
            </div>

          </div>

          {/* Credit Packs Section */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">One-Time Credit Packs</h3>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Small Pack */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Small Pack</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">$3</div>
                  <p className="text-gray-600 mb-6">for 100 credits</p>
                  
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">100 Credits</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">No expiration</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">Perfect for testing</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handlePlanSelection('small_pack', 'Small Pack', '$3')}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Buy Credits
                  </Button>
                </div>
              </div>

              {/* Pay as you go */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-colors">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Pay as you go</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">$5</div>
                  <p className="text-gray-600 mb-6">for 500 credits</p>
                  
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">500 Credits</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">No expiration</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">No monthly commitment</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3" />
                      <span className="text-gray-700">API access</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handlePlanSelection('pay_as_go', 'Pay as you go', '$5')}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Buy Credits
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600">
              All plans include our advanced AI alt-text generation and multi-language support.
              <br />
              Need a custom plan? <a href="#support" className="text-blue-600 hover:text-blue-700 font-medium">Contact us</a>
            </p>
          </div>
        </div>
      </section>

      {/* Example Alt Text */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Example Alt Text</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Example 1 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-w-4 aspect-h-3 bg-gradient-to-br from-blue-100 to-purple-100">
                <div className="flex items-center justify-center text-gray-600">
                  Business Team Meeting
                </div>
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
              <div className="aspect-w-4 aspect-h-3 bg-gradient-to-br from-green-100 to-yellow-100">
                <div className="flex items-center justify-center text-gray-600">
                  Fresh Vegetables
                </div>
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
              <div className="aspect-w-4 aspect-h-3 bg-gradient-to-br from-blue-100 to-cyan-100">
                <div className="flex items-center justify-center text-gray-600">
                  Mountain Landscape
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-sm leading-relaxed italic mb-4">
                  "Snow-capped mountain peaks reflecting in pristine alpine lake during golden hour"
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
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Start your free trial today
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            First 100 images alt text. No credit card required.
          </p>
          
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-gray-50 font-semibold px-8 py-4 text-lg rounded-lg"
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
      <footer className="bg-white border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Logo & Company Info */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Alt Text Pro</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Automatically generate alt text for images in over 130 languages.
              </p>
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs">f</span>
                </div>
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs">t</span>
                </div>
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs">in</span>
                </div>
              </div>
            </div>

            {/* Integrations */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Integrations</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">WordPress</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Shopify</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">API</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Bulk Upload</a></li>
              </ul>
            </div>

            {/* SEO & Accessibility */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">SEO & Accessibility</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Alt Text Best Practices</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">SEO Benefits</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">WCAG Compliance</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Screen Reader Support</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li><a href="#" className="hover:text-gray-900 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-gray-900 transition-colors">Status Page</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              © 2024 Alt Text Pro. All rights reserved.
            </p>
            <div className="flex space-x-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-900 transition-colors">Terms & Conditions</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

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
              className="w-full h-12 text-base font-semibold border-2"
            >
              {isGoogleLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5 text-blue-600" />
                  Continue with Google
                </>
              )}
            </Button>

            <div className="text-center mt-6 space-y-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"}
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthForm(false);
                    setIsLogin(false);
                    setEmail("");
                    setPassword("");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back to homepage
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
              <div className="text-3xl font-bold text-blue-600 mb-4">
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
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
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
                          <span className="text-sm text-gray-700">500 Credits (one-time)</span>
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
};

// Dashboard Component
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAltText, setGeneratedAltText] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadHistory();
  }, []);

  // Load API key when user is available
  useEffect(() => {
    if (user && user.token) {
      loadApiKey();
    }
  }, [user]);

  // Load subscription data from API
  const loadSubscriptionData = async (token) => {
    try {
      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/get-subscription`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      } else {
        console.warn('Subscription API not available, using fallback data');
        // Fallback subscription data for development
        setSubscriptionData({
          subscription: {
            plan: 'free',
            status: 'active',
            subscription_id: null,
            next_billing_date: null
          }
        });
      }
    } catch (error) {
      console.warn('Subscription API not available, using fallback data:', error.message);
      // Fallback subscription data for development
      setSubscriptionData({
        subscription: {
          plan: 'free',
          status: 'active',
          subscription_id: null,
          next_billing_date: null
        }
      });
    }
  };

  // Handle upgrade plan selection
  const handleUpgradePlan = (planId, planName, planPrice) => {
    setSelectedUpgradePlan({ id: planId, name: planName, price: planPrice });
    setShowUpgradeModal(true);
  };

  // Handle PayPal payment creation for upgrades
  const createUpgradePayPalOrder = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          planId: selectedUpgradePlan.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment creation failed');
      }

      return result.paymentId;
    } catch (error) {
      console.error('PayPal order creation error:', error);
      if (error.message.includes('Failed to fetch')) {
        toast.error('Payment service is not available. Please try again later or contact support.');
      } else {
        toast.error('Failed to create payment. Please try again.');
      }
      throw error;
    }
  };

  // Handle PayPal payment approval for upgrades
  const onUpgradePayPalApprove = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          paymentId: data.orderID,
          planId: selectedUpgradePlan.id,
          isSubscription: selectedUpgradePlan.id === 'tier1' || selectedUpgradePlan.id === 'tier2' || selectedUpgradePlan.id === 'tier3'
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment completion failed');
      }

      toast.success(`Successfully upgraded to ${selectedUpgradePlan.name}!`);
      setShowUpgradeModal(false);
      setSelectedUpgradePlan(null);
      
      // Reload dashboard data
      await loadDashboard();

    } catch (error) {
      console.error('PayPal approval error:', error);
      toast.error('Payment failed. Please try again.');
    }
  };

  // Load history when user or stats change
  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  // Load API key for WordPress plugin
  const loadApiKey = async () => {
    if (!user?.token) return;
    
    setIsLoadingApiKey(true);
    try {
      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/get-api-key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApiKey(data.api_key);
      } else {
        console.error('Failed to load API key');
        toast.error('Failed to load API key');
      }
    } catch (error) {
      console.error('Error loading API key:', error);
      toast.error('Error loading API key');
    } finally {
      setIsLoadingApiKey(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Please sign in to access the dashboard");
        window.location.href = "/";
        return;
      }
      
      setUser({ 
        email: session.user.email, 
        id: session.user.id,
        token: session.access_token
      });
      
      // Fetch real usage data from API (same endpoint the plugin uses for consistency)
      let apiBase;
      if (window.location.hostname === 'localhost') {
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      try {
        const usageResponse = await fetch(`${apiBase}/get-usage`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          if (usageData.success && usageData.data) {
            setUsageStats({
              credits_remaining: usageData.data.credits_remaining || 0,
              total_processed: usageData.data.total_generated || 0,
              plan: usageData.data.subscription_plan || 'free'
            });
          } else {
            throw new Error('Invalid API response format');
          }
        } else {
          throw new Error(`API returned status ${usageResponse.status}`);
        }
      } catch (error) {
        console.error('Error loading usage data from API:', error);
        // Fallback: try direct Supabase query as backup
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('credits_remaining, total_processed, subscription_plan, subscription_status, next_billing_date')
          .eq('id', session.user.id)
          .single();
        
        if (profileError || !profile) {
          console.error('Error loading profile:', profileError);
          // Final fallback to default if both methods fail
          setUsageStats({
            credits_remaining: 100,
            total_processed: 0,
            plan: 'Free Trial'
          });
        } else {
          setUsageStats({
            credits_remaining: profile.credits_remaining || 100,
            total_processed: profile.total_processed || 0,
            plan: profile.subscription_plan || 'Free Trial'
          });
        }
      }
      
      // Load subscription data from API (non-blocking)
      loadSubscriptionData(session.access_token).catch(err => {
        console.warn('Could not load subscription data:', err.message);
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      toast.error("Failed to load dashboard. Please try logging in again.");
      window.location.href = "/";
    }
  };

  const loadHistory = async () => {
    if (!user?.id) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('id, alt_text_generated, image_context, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error loading history:', error);
      } else {
        setHistory(data || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTestImage(e.target.result);
        setTestResult(null);
        setGeneratedAltText("");
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTestAltText = async () => {
    if (!testImage) {
      toast.error("Please upload an image first");
      return;
    }

    if (!user?.token) {
      toast.error("Session expired. Please sign in again.");
      window.location.href = "/";
      return;
    }

    // Check if user has credits
    if (usageStats?.credits_remaining <= 0) {
      toast.error("No credits remaining. Please upgrade your plan to continue.");
      setShowUpgradeModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      // Extract base64 from data URL
      const base64Data = testImage.split(',')[1];
      
      // Determine API endpoint - use local development or production
      // For localhost, use production API (Netlify Dev server not required)
      let apiBase;
      if (window.location.hostname === 'localhost') {
        // Use production API when running React dev server standalone
        apiBase = process.env.REACT_APP_API_BASE || 'https://www.alt-text.pro/.netlify/functions';
      } else {
        // Production - use relative path
        apiBase = '/.netlify/functions';
      }
      
      const endpoint = `${apiBase}/generate-alt-text`;
      
      console.log('🔍 Generating alt-text:', {
        endpoint,
        hasImage: !!base64Data,
        imageSize: base64Data?.length,
        hasToken: !!user.token
      });
      
      // Call the real API
      const apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          image_base64: base64Data,
          context: 'Dashboard test'
        })
      });
      
      // Check if response is OK before parsing JSON
      let data;
      try {
        const responseText = await apiResponse.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        toast.error("Invalid response from server. Please try again.");
        return;
      }
      
      if (apiResponse.ok) {
        // Update with real data from API response
        const result = {
          alt_text: data.alt_text || data.altText,
          credits_used: 1,
          credits_remaining: data.credits_remaining
        };
        
        setTestResult(result);
        
        // Update usage stats with real credits from API
        setUsageStats(prev => ({
          ...prev,
          credits_remaining: data.credits_remaining,
          total_processed: data.total_processed || (prev?.total_processed || 0) + 1
        }));
        
        // Update generated alt-text state for display
        setGeneratedAltText(result.alt_text);
        
        // Reload history to show new generation
        loadHistory();
        
        toast.success("Alt-text generated successfully!");
      } else {
        console.error('API Error Response:', {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          data: data
        });
        
        if (apiResponse.status === 401) {
          toast.error("Session expired. Please sign in again.");
          window.location.href = "/";
        } else if (apiResponse.status === 402) {
          toast.error("No credits remaining. Please upgrade your plan.");
        } else {
          toast.error(data.error || `Server error (${apiResponse.status}). Please try again.`);
        }
      }
    } catch (error) {
      console.error("Failed to generate alt-text:", error);
      toast.error("Failed to generate alt-text. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="relative w-12 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-lg transform -rotate-12" style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                <Zap className="h-5 w-5 text-white transform rotate-12" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user?.email}</span>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                      toast.error("Logout failed. Please try again.");
                    } else {
                      toast.success("Logged out successfully");
                      window.location.href = "/";
                    }
                  } catch (error) {
                    toast.error("Logout failed. Please try again.");
                  }
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your Alt Text Pro subscription and test the service</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Usage Stats */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-purple-600" />
                    Usage Statistics
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (user?.token) {
                        setIsLoading(true);
                        loadDashboard();
                        toast.info("Refreshing credits...");
                      }
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    title="Refresh credits"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Current Plan</span>
                    <Badge className="bg-purple-100 text-purple-700">
                      {usageStats?.plan || 'Free Trial'}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Credits Remaining</span>
                    <span className="font-semibold text-gray-800">
                      {usageStats?.credits_remaining || 0}
                    </span>
                  </div>
                  <Progress value={(usageStats?.credits_remaining / 100) * 100} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Processed</span>
                    <span className="font-semibold text-gray-800">
                      {usageStats?.total_processed || 0}
                    </span>
                  </div>
                </div>

                {/* Buy Credits Option - Always Visible */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <CreditCard className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Buy More Credits</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-3">
                    Need more credits? Choose a credit pack below.
                  </p>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => handleUpgradePlan('small_pack', 'Small Pack', '$3')}
                      size="sm" 
                      variant="outline"
                      className="w-full"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      100 Credits - $3
                    </Button>
                    <Button 
                      onClick={() => handleUpgradePlan('pay_as_go', 'Pay as you go', '$5')}
                      size="sm" 
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      500 Credits - $5
                    </Button>
                  </div>
                </div>

                {/* Development Mode Notice */}
                {window.location.hostname === 'localhost' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Brain className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-800">Development Mode</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Payment system is in development. Deploy to Netlify to enable payments.
                    </p>
                  </div>
                )}

                {/* Upgrade Section */}
                {usageStats?.credits_remaining <= 10 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <TrendingUp className="h-4 w-4 text-yellow-600 mr-2" />
                      <span className="text-sm font-medium text-yellow-800">
                        {usageStats?.credits_remaining <= 0 ? 'No Credits Left!' : 'Running Low on Credits'}
                      </span>
                    </div>
                    <p className="text-xs text-yellow-700 mb-3">
                      {usageStats?.credits_remaining <= 0 
                        ? 'Upgrade your plan to continue generating alt-text.'
                        : 'Consider upgrading to avoid interruption.'
                      }
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={() => handleUpgradePlan('tier1', 'Tier 1', '$15')}
                        size="sm" 
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Upgrade to Tier 1 - $15/month
                      </Button>
                      <Button 
                        onClick={() => handleUpgradePlan('pay_as_go', 'Pay as you go', '$5')}
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                      >
                        Buy 500 Credits - $5
                      </Button>
                    </div>
                  </div>
                )}

                {/* Subscription Info */}
                {subscriptionData?.subscription && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-800">Subscription</span>
                    </div>
                    <div className="space-y-1 text-xs text-blue-700">
                      <p>Plan: {subscriptionData.subscription.plan}</p>
                      <p>Status: {subscriptionData.subscription.status}</p>
                      {subscriptionData.subscription.next_billing_date && (
                        <p>Next billing: {new Date(subscriptionData.subscription.next_billing_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Key Section for WordPress Plugin */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-5 w-5 mr-2 text-blue-600" />
                  WordPress Plugin Integration
                </CardTitle>
                <p className="text-gray-600 text-sm">Use this API key to connect your WordPress plugin</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your API Key
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={isLoadingApiKey ? "Loading..." : (apiKey || "Not available")}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                        disabled={isLoadingApiKey}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="px-3"
                      disabled={isLoadingApiKey || !apiKey}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (apiKey) {
                          navigator.clipboard.writeText(apiKey);
                          toast.success("API key copied to clipboard!");
                        } else {
                          toast.error("API key not available. Please refresh the page.");
                        }
                      }}
                      className="px-3"
                      disabled={isLoadingApiKey || !apiKey}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        loadApiKey();
                      }}
                      className="px-3"
                      disabled={isLoadingApiKey}
                      title="Refresh API Key"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      Keep it secure!
                    </p>
                    {!apiKey && !isLoadingApiKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadApiKey}
                        className="text-xs"
                      >
                        Generate API Key
                      </Button>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        WordPress Plugin Setup
                      </h4>
                      <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Download the Alt Text Pro WordPress plugin</li>
                        <li>Install and activate it on your WordPress site</li>
                        <li>Go to Alt Text Pro → Settings in your WordPress admin</li>
                        <li>Paste this API key in the settings</li>
                        <li>Test the connection and start generating alt-text!</li>
                      </ol>
                      <div className="mt-3">
                        <a
                          href="/wordpress-plugin/alt-text-pro-plugin.zip"
                          download="alt-text-pro-plugin.zip"
                          className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download WordPress Plugin
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-amber-900 mb-1">
                        Important Security Note
                      </h4>
                      <p className="text-xs text-amber-800">
                        Keep your API key secure and never share it publicly. This key provides access to your Alt Text Pro account and credits.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Service */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Alt-Text Generation</CardTitle>
                <p className="text-gray-600">Upload an image to test our AI-powered alt-text generation</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  {!testImage ? (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                      onClick={() => document.getElementById('image-upload-input')?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-purple-500', 'bg-purple-50');
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50');
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith('image/')) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setTestImage(event.target.result);
                            setTestResult(null);
                            setGeneratedAltText("");
                          };
                          reader.readAsDataURL(file);
                        } else {
                          toast.error("Please upload an image file");
                        }
                      }}
                    >
                      <input
                        id="image-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 font-medium mb-2">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-gray-500">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative border-2 border-gray-300 rounded-lg p-4">
                        <img
                          src={testImage}
                          alt="Test upload"
                          className="max-w-full max-h-96 mx-auto rounded-lg object-contain"
                        />
                        <button
                          onClick={() => {
                            setTestImage(null);
                            setTestResult(null);
                            setGeneratedAltText("");
                            const input = document.getElementById('image-upload-input');
                            if (input) input.value = '';
                          }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg"
                          title="Remove image"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <input
                        id="image-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 mb-4"
                      />
                      
                      <Button
                        onClick={generateTestAltText}
                        disabled={isGenerating || (usageStats?.credits_remaining || 0) <= 0}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {isGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Generating Alt-Text...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            Generate Alt-Text ({usageStats?.credits_remaining || 0} credits left)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Generated Alt Text Result - Show directly under image */}
                {testImage && (
                  <div className="space-y-3 border-t pt-6">
                    <label className="block text-sm font-medium text-gray-700">Generated Alt Text:</label>
                    <div className="relative bg-gray-50 rounded-lg p-4 border min-h-[80px] flex items-center">
                      {generatedAltText ? (
                        <>
                          <p className="text-sm text-gray-800 pr-10 flex-1">
                            "{generatedAltText}"
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedAltText);
                              toast.success("Alt text copied to clipboard!");
                            }}
                            className="absolute top-3 right-3 p-2 hover:bg-gray-200 rounded transition-colors"
                            title="Copy to clipboard"
                          >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {isGenerating ? "Generating alt-text..." : "Alt text will appear here after generation..."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2 text-purple-600" />
                  Generation History
                </CardTitle>
                <p className="text-gray-600 text-sm">View all your previously generated alt-texts</p>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Loading history...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No generation history yet.</p>
                    <p className="text-sm mt-2">Generate alt-text to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex gap-4">
                          {/* Image Thumbnail - Placeholder since images aren't stored */}
                          <div className="flex-shrink-0">
                            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg border border-purple-300 flex items-center justify-center">
                              <Eye className="h-8 w-8 text-purple-500" />
                            </div>
                          </div>
                          
                          {/* Alt Text Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm text-gray-800 font-medium mb-1">
                                  "{item.alt_text_generated || 'No alt-text available'}"
                                </p>
                                {item.image_context && (
                                  <p className="text-xs text-gray-500 mb-2">
                                    Context: {item.image_context}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400">
                                  {new Date(item.created_at).toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.alt_text_generated);
                                  toast.success("Alt text copied to clipboard!");
                                }}
                                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Copy to clipboard"
                              >
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedUpgradePlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Upgrade Your Plan
              </h3>
              <p className="text-gray-600 mb-4">
                Selected: {selectedUpgradePlan.name}
              </p>
              <div className="text-3xl font-bold text-blue-600 mb-4">
                {selectedUpgradePlan.price}
                {selectedUpgradePlan.id !== 'pay_as_go' && (
                  <span className="text-lg text-gray-500">/month</span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Plan includes:</h4>
              <div className="space-y-2">
                {selectedUpgradePlan.id === 'tier1' && (
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
                {selectedUpgradePlan.id === 'tier2' && (
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
                {selectedUpgradePlan.id === 'pay_as_go' && (
                  <>
                    <div className="flex items-center">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-700">500 Credits (one-time)</span>
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
              <PayPalScriptProvider options={paypalOptions}>
                <PayPalButtons
                  createOrder={createUpgradePayPalOrder}
                  onApprove={onUpgradePayPalApprove}
                  onError={(error) => {
                    console.error('PayPal error:', error);
                    toast.error('Payment failed. Please try again.');
                  }}
                  onCancel={(data) => {
                    console.log('PayPal payment cancelled:', data);
                    toast.info('Payment cancelled');
                  }}
                  style={{
                    layout: "vertical",
                    color: "blue",
                    shape: "rect",
                    label: "paypal"
                  }}
                />
              </PayPalScriptProvider>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedUpgradePlan(null);
                }}
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;