import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
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
import { Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket, Mail, Chrome, Upload, Eye, EyeOff, Download, Check, X, Search, CreditCard, Calendar, TrendingUp, Key, Copy, Info, AlertTriangle, RefreshCw, Book, FileText, HelpCircle, Settings, Code, DollarSign, Wrench, Globe, LogOut, MessageCircle, Image as ImageIcon, Crown } from "lucide-react";
import { Switch } from "./components/ui/switch";

// PHASE 0 REFACTORING: Extracted modules
// These configuration files and components have been extracted for better organization
import { supabase as supabaseClient } from './lib/supabase';
import { PAYPAL_CLIENT_ID as PAYPAL_CLIENT_ID_FROM_CONFIG, PAYPAL_PLAN_IDS, paypalOptions, paypalSubscriptionOptions } from './lib/paypal';
import ContactPageExtracted from './pages/ContactPage';
import AboutPageExtracted from './pages/AboutPage';

// PHASE 0 REFACTORING: Configuration moved to lib files
// The following code has been extracted to lib/supabase.js and lib/paypal.js
// Keeping it commented for reference during migration

// Initialize Supabase client - NOW IMPORTED FROM lib/supabase.js
const supabase = supabaseClient; // Use the imported client

// PayPal configuration - NOW IMPORTED FROM lib/paypal.js
const PAYPAL_CLIENT_ID = PAYPAL_CLIENT_ID_FROM_CONFIG; // Use the imported config

/*
// OLD CODE - Now in lib/supabase.js
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

console.log('🔧 Supabase Configuration:');
console.log('  - URL:', supabaseUrl);
console.log('  - Anon Key:', supabaseAnonKey ? (supabaseAnonKey.substring(0, 20) + '...') : 'NOT SET');
console.log('  - Env URL:', process.env.REACT_APP_SUPABASE_URL || 'NOT SET');
console.log('  - Env Key:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('⚠️ WARNING: Supabase is using placeholder values! Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    site: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? window.location.origin
      : 'https://www.alt-text.pro'
  }
});
*/

/*
// OLD CODE - Now in lib/paypal.js
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test';

const PAYPAL_PLAN_IDS = {
  tier1: {
    monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER1 || 'P-8R4278588L5455645NEMOH6A',
    annual: process.env.REACT_APP_PAYPAL_PLAN_TIER1_ANNUAL || 'P-ANNUAL_TIER1_PLACEHOLDER'
  },
  tier2: {
    monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER2 || 'P-5XP84993MM234080GNEMOTRQ',
    annual: process.env.REACT_APP_PAYPAL_PLAN_TIER2_ANNUAL || 'P-ANNUAL_TIER2_PLACEHOLDER'
  },
  tier3: {
    monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER3 || 'P-2DC95956TS8763323NEMOWJQ',
    annual: process.env.REACT_APP_PAYPAL_PLAN_TIER3_ANNUAL || 'P-ANNUAL_TIER3_PLACEHOLDER'
  }
};

const paypalOptions = {
  "client-id": PAYPAL_CLIENT_ID,
  currency: "USD",
  intent: "capture",
  "enable-funding": "venmo",
  "disable-funding": "paylater,card"
};

const paypalSubscriptionOptions = {
  "client-id": PAYPAL_CLIENT_ID,
  currency: "USD",
  vault: true,
  intent: "subscription"
};
*/

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-menu-container')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMobileMenuOpen]);

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
        // For localhost, use Netlify Dev server (port 9999)
        let apiBase;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          // Use localhost Netlify Dev functions (port 9999)
          apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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
            emailRedirectTo: window.location.origin + '/email-confirmed',
            data: {
              subscription_plan: 'free',
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

        // For signups, always show email confirmation message
        if (!isLogin) {
          // Always show email confirmation message for signups
          toast.success("Welcome! Please confirm your email account.", { duration: 8000 });

          // Log for debugging
          console.log('📧 Email confirmation required for:', email);
          console.log('📧 Supabase URL:', supabaseUrl);
          console.log('📧 Email confirmed status:', emailConfirmed);

          // Show warning if Supabase not configured
          if (supabaseUrl === 'https://placeholder.supabase.co') {
            toast.error("⚠️ Supabase is not configured! Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY", { duration: 10000 });
          }

          // Only redirect to dashboard if email is already confirmed AND there's a session
          if (emailConfirmed && result.data.session) {
            // Ensure profile exists with credits
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
                    subscription_plan: 'free',
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
                    subscription_plan: 'free'
                  })
                  .eq('id', result.data.user.id);
              }
            } catch (profileCreateError) {
              console.error('Error ensuring profile exists:', profileCreateError);
              // Continue anyway
            }

            // Update user state before redirect
            if (result.data.session?.user) {
              setUser({
                email: result.data.session.user.email,
                id: result.data.session.user.id
              });
            }

            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 2000);
          }
        } else {
          // Login flow
          // Ensure profile exists with credits
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
                    subscription_plan: 'free',
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
                    subscription_plan: 'free'
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

          toast.success("Welcome back!");
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

  // Handle PayPal subscription creation (for subscriptions using SDK)
  const createPayPalSubscription = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      // Get the PayPal plan ID for the selected plan
      const planGroup = PAYPAL_PLAN_IDS[selectedPlan.id];
      const paypalPlanId = planGroup?.[billingCycle === 'annual' ? 'annual' : 'monthly'];

      if (!paypalPlanId) {
        throw new Error(`No PayPal plan ID found for ${selectedPlan.id} (${billingCycle})`);
      }

      console.log('Creating PayPal subscription via SDK for plan:', selectedPlan.id);
      console.log('PayPal Plan ID:', paypalPlanId);
      console.log('Actions object:', actions);
      console.log('Actions.subscription available:', !!actions.subscription);

      // Check if actions.subscription exists
      if (!actions || !actions.subscription) {
        console.error('❌ actions.subscription is not available!');
        console.error('Available actions:', Object.keys(actions || {}));
        throw new Error('PayPal subscription actions not available. Please use server-side subscription creation.');
      }

      // Use PayPal SDK's createSubscription method
      // This returns a subscription ID directly, avoiding redirects
      const subscriptionId = await actions.subscription.create({
        plan_id: paypalPlanId
      });

      console.log('✅ Subscription created via SDK:', subscriptionId);
      return subscriptionId;
    } catch (error) {
      console.error('PayPal subscription creation error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error('Failed to create subscription. Please try again.');
      throw error;
    }
  };

  // Handle PayPal payment creation (for one-time payments)
  const createPayPalOrder = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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

      // Return the payment ID for one-time payments
      return result.paymentId;
    } catch (error) {
      console.error('PayPal order creation error:', error);
      toast.error('Failed to create payment. Please try again.');
      throw error;
    }
  };

  // Handle PayPal subscription approval (for subscriptions using SDK)
  const onPayPalSubscriptionApprove = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      console.log('PayPal subscription approved:', data);
      console.log('Subscription ID:', data.subscriptionID);

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // Complete the subscription on our backend
      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subscriptionId: data.subscriptionID,
          planId: selectedPlan.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Subscription completion failed');
      }

      toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
      setShowPaymentModal(false);
      setSelectedPlan(null);

      // Refresh user data or redirect to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);

    } catch (error) {
      console.error('PayPal subscription approval error:', error);
      toast.error('Subscription failed. Please try again.');
    }
  };

  // Handle PayPal payment approval (for one-time payments)
  const onPayPalApprove = async (data, actions) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // For one-time payments, capture the order first using PayPalButtons actions
      if (actions && actions.order) {
        const captureResult = await actions.order.capture();
        console.log('PayPal order captured:', captureResult);
      }

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
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </div>
              </div>

              {/* Centered Navigation Links */}
              <div className="hidden lg:flex items-center space-x-12">
                <a href="#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>

              {/* Right Side Buttons */}
              <div className="hidden lg:flex items-center space-x-3">
                {user ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
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
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
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
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  {isMobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 top-20"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* Menu */}
          <div className="lg:hidden fixed inset-x-0 top-20 z-50 bg-white border-b border-gray-200 shadow-lg mobile-menu-container">
            <div className="px-4 py-6 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-3">
                <a
                  href="#pricing"
                  className="block text-gray-700 hover:text-gray-900 font-medium transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <Link
                  to="/contact"
                  className="block text-gray-700 hover:text-gray-900 font-medium transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Contact
                </Link>
                <Link
                  to="/docs"
                  className="block text-gray-700 hover:text-gray-900 font-medium transition-colors py-2"
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
                      className="w-full text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        window.location.href = "/dashboard";
                      }}
                    >
                      Dashboard
                    </Button>
                    <Button
                      className="w-full bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
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
                      className="w-full text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsLogin(true);
                        setShowAuthForm(true);
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="w-full bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsLogin(false);
                        setShowAuthForm(true);
                      }}
                    >
                      Free Trial
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

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
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 relative"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#004953';
                    e.currentTarget.style.backgroundColor = 'rgba(13, 79, 94, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => document.getElementById('image-upload').click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!selectedImage) {
                      e.currentTarget.style.borderColor = '#004953';
                      e.currentTarget.style.backgroundColor = 'rgba(13, 79, 94, 0.05)';
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (!selectedImage) {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = 'transparent';
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
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgba(13, 79, 94, 0.1)' }}>
                        <Upload className="h-6 w-6" style={{ color: '#0D4F5E' }} />
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
                  className="w-full disabled:bg-gray-400 text-white py-3 rounded-lg font-medium mb-4"
                  style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)')}
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
                    <span className="text-gray-700">100 Credits</span>
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
                  ${billingCycle === 'monthly' ? '12' : '129.60'}
                  <span className="text-xl text-gray-600 font-normal ml-1">USD</span>
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    {billingCycle === 'monthly' ? 'per Month' : 'per Year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-xs text-gray-500 mb-2">$10.80/month billed annually</p>
                )}

                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span className="text-gray-700">1,000 Credits</span>
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
                  onClick={() => handlePlanSelection('tier1', 'Tier 1', billingCycle === 'monthly' ? '$12' : '$129.60')}
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
                    <span className="text-gray-700">2,500 Credits</span>
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
                    <span className="text-gray-700">5,000 Credits</span>
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

          <div className="text-center mt-12">
            <p className="text-gray-600">
              All plans include our advanced AI alt-text generation and multi-language support.
              <br />
              Need a custom plan? <Link to="/contact" className="font-medium transition-colors" style={{ color: '#0D4F5E' }} onMouseEnter={(e) => e.currentTarget.style.color = '#003a42'} onMouseLeave={(e) => e.currentTarget.style.color = '#0D4F5E'}>Contact us</Link>
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
              <div className="aspect-w-4 aspect-h-3" style={{ background: 'linear-gradient(135deg, rgba(13, 79, 94, 0.15) 0%, rgba(0, 73, 83, 0.15) 100%)' }}>
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
              <div className="aspect-w-4 aspect-h-3 bg-gradient-to-br from-teal-100 to-cyan-100">
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
              <div className="aspect-w-4 aspect-h-3" style={{ background: 'linear-gradient(135deg, rgba(13, 79, 94, 0.15) 0%, rgba(0, 73, 83, 0.15) 100%)' }}>
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
      <footer className="text-white py-12" style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Logo & Company Info */}
            <div className="flex items-center space-x-2">
              <img
                src="/logo-alt-text-pro.png"
                alt="Alt Text Pro Logo"
                className="h-10 w-10 object-contain"
              />
              <span className="text-2xl font-bold text-white">Alt Text Pro</span>
            </div>

            <p className="text-gray-200 text-sm max-w-md">
              Automatically generate alt text for images in over 130 languages.
            </p>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-200">
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            </div>

            {/* Copyright */}
            <p className="text-gray-300 text-sm pt-4 border-t border-white/20 w-full">
              © 2024 Alt Text Pro. All rights reserved.
            </p>
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
              className="w-full h-12 text-base font-semibold border-2 transition-colors"
              style={{
                borderColor: '#003a42',
                color: '#003a42',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(13, 79, 94, 0.1)';
                e.currentTarget.style.color = '#003a42';
                e.currentTarget.style.borderColor = '#0D4F5E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#003a42';
                e.currentTarget.style.borderColor = '#003a42';
              }}
            >
              {isGoogleLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 mr-2" style={{ borderColor: '#003a42' }}></div>
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
                onMouseEnter={(e) => e.currentTarget.style.color = '#003a42'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#0D4F5E'}
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
                  onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
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
                      onError={(error) => {
                        console.error('PayPal subscription error:', error);
                        toast.error(error.message || 'Subscription failed. Please try again.');
                      }}
                    />
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
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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

  // Handle PayPal subscription creation for upgrades (using SDK)
  const createUpgradePayPalSubscription = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      // Get the PayPal plan ID for the selected upgrade plan
      // Default to monthly for upgrades as dashboard doesn't have billing cycle toggle yet
      const planGroup = PAYPAL_PLAN_IDS[selectedUpgradePlan.id];
      const paypalPlanId = planGroup?.monthly;

      if (!paypalPlanId) {
        throw new Error(`No PayPal plan ID found for ${selectedUpgradePlan.id}`);
      }

      console.log('Creating PayPal subscription via SDK for upgrade plan:', selectedUpgradePlan.id);
      console.log('PayPal Plan ID:', paypalPlanId);

      // Use PayPal SDK's createSubscription method
      return actions.subscription.create({
        plan_id: paypalPlanId
      });
    } catch (error) {
      console.error('PayPal subscription creation error:', error);
      toast.error('Failed to create subscription. Please try again.');
      throw error;
    }
  };

  // Handle PayPal payment creation for upgrades (one-time payments)
  const createUpgradePayPalOrder = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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

  // Handle PayPal subscription approval for upgrades (using SDK)
  const onUpgradePayPalSubscriptionApprove = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      console.log('PayPal subscription approved for upgrade:', data);
      console.log('Subscription ID:', data.subscriptionID);

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // Complete the subscription on our backend
      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          subscriptionId: data.subscriptionID,
          planId: selectedUpgradePlan.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Subscription completion failed');
      }

      toast.success(`Successfully upgraded to ${selectedUpgradePlan.name}!`);
      setShowUpgradeModal(false);
      setSelectedUpgradePlan(null);

      // Reload dashboard data
      await loadDashboard();

    } catch (error) {
      console.error('PayPal subscription approval error:', error);
      toast.error('Subscription failed. Please try again.');
    }
  };

  // Handle PayPal payment approval for upgrades (one-time payments)
  const onUpgradePayPalApprove = async (data, actions) => {
    try {
      if (!user?.token) {
        throw new Error('No valid session');
      }

      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // For one-time payments, capture the order first using PayPalButtons actions
      if (actions && actions.order) {
        const captureResult = await actions.order.capture();
        console.log('PayPal order captured:', captureResult);
      }

      const response = await fetch(`${apiBase}/complete-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          paymentId: data.orderID,
          planId: selectedUpgradePlan.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment completion failed');
      }

      toast.success(`Successfully purchased ${selectedUpgradePlan.name}!`);
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
    if (!user?.id) return;

    setIsLoadingApiKey(true);
    try {
      // First, try to get existing API key from Supabase
      const { data: existingKeys, error: fetchError } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching API key:', fetchError);
        // If table doesn't exist or RLS issue, try using the function
        const { data: functionResult, error: functionError } = await supabase
          .rpc('get_or_create_api_key', { p_user_id: user.id });

        if (functionError) {
          console.error('Error calling get_or_create_api_key:', functionError);
          toast.error('Error loading API key');
          return;
        }

        setApiKey(functionResult);
        return;
      }

      // If we have an existing key, use it
      if (existingKeys && existingKeys.length > 0) {
        setApiKey(existingKeys[0].api_key);
        return;
      }

      // If no key exists, create one using the function
      const { data: newKey, error: createError } = await supabase
        .rpc('get_or_create_api_key', { p_user_id: user.id });

      if (createError) {
        console.error('Error creating API key:', createError);
        toast.error('Error creating API key');
        return;
      }

      setApiKey(newKey);
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
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-3">
              <img
                src="/logo-alt-text-pro.png"
                alt="Alt Text Pro Logo"
                className="h-8 w-8 object-contain"
              />
              <span className="text-xl font-bold text-gray-900">Alt Text Pro</span>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-sm text-gray-500">
                Logged in as <span className="font-medium text-gray-900">{user?.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
                onClick={async () => {
                  try {
                    const { error } = await supabase.auth.signOut();
                    if (!error) {
                      toast.success("Logged out successfully");
                      window.location.href = "/";
                    }
                  } catch (error) {
                    toast.error("Logout failed");
                  }
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your account, credits, and API keys</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Plugin v1.4.1</span>
            <a
              href="/wordpress-plugin/alt-text-pro-plugin-1.4.1.zip"
              download="alt-text-pro-plugin-1.4.1.zip"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white transition-all rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Plugin
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credits Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Available Credits</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{usageStats?.credits_remaining || 0}</h3>
                </div>
                <div className="p-2 bg-teal-50 rounded-lg">
                  <Zap className="h-6 w-6 text-teal-600" />
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((usageStats?.credits_remaining || 0) / 100) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{usageStats?.plan === 'free' ? '100 total' : 'Monthly quota'}</span>
                <button
                  onClick={() => handleUpgradePlan('pay_as_go', 'Pay as you go', '$5')}
                  className="text-teal-600 font-medium hover:text-teal-700"
                >
                  Top up +
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Generated Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Generated</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{usageStats?.total_processed || 0}</h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <ImageIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Images processed successfully
              </p>
            </CardContent>
          </Card>

          {/* Plan Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Plan</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1 capitalize">{usageStats?.plan || 'Free'}</h3>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Crown className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center"
              >
                Manage Subscription <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Area - Left 2/3 */}
          <div className="lg:col-span-2 space-y-8">

            {/* Test Alt Text Section */}
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Quick Test</CardTitle>
                    <p className="text-sm text-gray-500">Generate alt-text for an image instantly</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-full">
                    <Brain className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!testImage ? (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-all duration-200"
                    onClick={() => document.getElementById('image-upload-input')?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-teal-500', 'bg-teal-50');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-teal-500', 'bg-teal-50');
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
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <h4 className="text-gray-900 font-medium mb-1">Click to upload or drag and drop</h4>
                    <p className="text-sm text-gray-500">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex gap-6">
                      <div className="w-1/3">
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 group">
                          <img
                            src={testImage}
                            alt="Test upload"
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => {
                                setTestImage(null);
                                setTestResult(null);
                                setGeneratedAltText("");
                                const input = document.getElementById('image-upload-input');
                                if (input) input.value = '';
                              }}
                              className="bg-white text-red-600 px-3 py-1.5 rounded-md text-sm font-medium shadow-lg"
                            >
                              Remove Image
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        {generatedAltText ? (
                          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Generated Result</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedAltText);
                                  toast.success("Copied!");
                                }}
                                className="text-green-600 hover:text-green-700 text-xs flex items-center"
                              >
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </button>
                            </div>
                            <p className="text-gray-800 font-medium leading-relaxed">
                              "{generatedAltText}"
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-gray-500 mb-4">
                              Ready to generate description for this image. This will use 1 credit.
                            </p>
                            <Button
                              onClick={generateTestAltText}
                              disabled={isGenerating || (usageStats?.credits_remaining || 0) <= 0}
                              className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
                              style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                            >
                              {isGenerating ? (
                                <>
                                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Brain className="h-4 w-4 mr-2" />
                                  Generate Alt Text
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Section */}
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden">
                  {isLoadingHistory ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
                      <p className="text-gray-500 text-sm">Loading history...</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="p-12 text-center bg-gray-50/50">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-900 font-medium">No history yet</p>
                      <p className="text-gray-500 text-sm mt-1">Generated alt-text will appear here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {history.map((item) => (
                        <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-4 items-start">
                          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold text-xs">IMG</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium mb-1">
                              "{item.alt_text_generated || 'No alt-text'}"
                            </p>
                            <div className="flex items-center text-xs text-gray-500">
                              <span className="flex items-center mr-4">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                              {item.image_context && (
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                  {item.image_context}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.alt_text_generated);
                              toast.success("Copied!");
                            }}
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            title="Copy alt text"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right 1/3 */}
          <div className="lg:col-span-1 space-y-6">
            {/* API Key Card */}
            <Card className="border-none shadow-sm bg-gray-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center">
                    <Key className="h-4 w-4 mr-2 text-teal-400" />
                    API Key
                  </h3>
                  <span className="text-xs bg-teal-500/20 text-teal-300 px-2 py-1 rounded font-medium">Active</span>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Use this key to connect the WordPress plugin to your account.
                </p>

                <div className="bg-black/30 rounded-lg p-3 flex items-center justify-between mb-4 border border-white/10">
                  <code className="text-sm font-mono text-teal-300 truncate mr-2">
                    {isLoadingApiKey ? "Loading..." : (showApiKey ? apiKey : "alt_••••••••••••••••")}
                  </code>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        if (apiKey) {
                          navigator.clipboard.writeText(apiKey);
                          toast.success("Copied API Key");
                        }
                      }}
                      className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!apiKey && !isLoadingApiKey && (
                    <Button
                      size="sm"
                      onClick={loadApiKey}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white border-none"
                    >
                      Generate Key
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Help / Support Card */}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  <a href="/docs" className="block p-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <Book className="h-4 w-4 mr-3 text-teal-500" />
                    Read Documentation
                  </a>
                  <a href="/contact" className="block p-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <MessageCircle className="h-4 w-4 mr-3 text-teal-500" />
                    Contact Support
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Setup Guide */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Quick Setup
              </h4>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-2 ml-1">
                <li>Download and install the plugin</li>
                <li>Copy your API Key from above</li>
                <li>Paste into plugin settings</li>
                <li>Start generating alt-text!</li>
              </ol>
            </div>

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
              <div className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>
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
              {/* For subscriptions, use server-side API to create subscription */}
              {(selectedUpgradePlan.id === 'tier1' || selectedUpgradePlan.id === 'tier2' || selectedUpgradePlan.id === 'tier3') ? (
                <Button
                  onClick={async () => {
                    try {
                      if (!user?.token) {
                        toast.error('Please sign in to continue');
                        return;
                      }

                      let apiBase;
                      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
                      } else {
                        apiBase = '/.netlify/functions';
                      }

                      console.log('Creating subscription via backend API for plan:', selectedUpgradePlan.id);

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

                      console.log('Payment creation response:', result);

                      if (!response.ok) {
                        console.error('Payment creation failed:', result);
                        throw new Error(result.error || result.details || 'Payment creation failed');
                      }

                      if (result.approvalUrl) {
                        const approvalUrl = result.approvalUrl;
                        console.log('═══════════════════════════════════════════════════════════');
                        console.log('🔗 PAYPAL APPROVAL URL RECEIVED (Dashboard)');
                        console.log('═══════════════════════════════════════════════════════════');
                        console.log('Approval URL:', approvalUrl);
                        console.log('Plan ID:', selectedUpgradePlan.id);
                        console.log('Subscription ID:', result.subscriptionId);
                        console.log('Payment ID:', result.paymentId);
                        console.log('Is Subscription:', result.isSubscription);

                        // Parse and log URL details
                        try {
                          const urlObj = new URL(approvalUrl);
                          console.log('URL Details:');
                          console.log('  - Protocol:', urlObj.protocol);
                          console.log('  - Host:', urlObj.host);
                          console.log('  - Pathname:', urlObj.pathname);
                          console.log('  - Search params:', Object.fromEntries(urlObj.searchParams));

                          const baToken = urlObj.searchParams.get('ba_token');
                          if (baToken) {
                            console.log('  - ba_token present:', true);
                            console.log('  - ba_token length:', baToken.length);
                            console.log('  - ba_token preview:', baToken.substring(0, 15) + '...' + baToken.substring(baToken.length - 5));
                          } else {
                            console.error('  - ⚠️ ba_token MISSING!');
                          }
                        } catch (urlError) {
                          console.error('Error parsing approval URL:', urlError);
                        }

                        // Validate it's a subscription URL
                        if (!approvalUrl.includes('/billing/subscriptions') || !approvalUrl.includes('ba_token')) {
                          console.error('❌ Invalid subscription URL:', approvalUrl);
                          console.error('  - Contains /billing/subscriptions:', approvalUrl.includes('/billing/subscriptions'));
                          console.error('  - Contains ba_token:', approvalUrl.includes('ba_token'));
                          toast.error('PayPal returned incorrect payment type. Please contact support.');
                          return;
                        }

                        // Log redirect details
                        console.log('═══════════════════════════════════════════════════════════');
                        console.log('🚀 REDIRECTING TO PAYPAL (Dashboard)');
                        console.log('═══════════════════════════════════════════════════════════');
                        console.log('Redirect URL:', approvalUrl);
                        console.log('Timestamp:', new Date().toISOString());
                        console.log('User Agent:', navigator.userAgent);
                        console.log('Current URL:', window.location.href);
                        console.log('═══════════════════════════════════════════════════════════');

                        // Store approval URL details in sessionStorage for debugging
                        try {
                          sessionStorage.setItem('paypal_approval_url', approvalUrl);
                          sessionStorage.setItem('paypal_plan_id', selectedUpgradePlan.id);
                          sessionStorage.setItem('paypal_subscription_id', result.subscriptionId || '');
                          sessionStorage.setItem('paypal_redirect_timestamp', new Date().toISOString());
                        } catch (e) {
                          console.warn('Could not store approval URL in sessionStorage:', e);
                        }

                        // Redirect to PayPal approval page
                        window.location.href = approvalUrl;
                      } else {
                        console.error('No approval URL in response:', result);
                        toast.error(`Failed to get PayPal approval URL. Response: ${JSON.stringify(result)}`);
                      }
                    } catch (error) {
                      console.error('PayPal subscription creation error:', error);
                      const errorMessage = error.message || error.toString() || 'Failed to create subscription. Please try again.';
                      console.error('Full error details:', error);
                      toast.error(errorMessage);
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Subscribe with PayPal
                </Button>
              ) : (
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
              )}
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

// Documentation Page Component
const DocsPage = () => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [user, setUser] = useState(null);

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
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };
    checkAuth();
  }, []);

  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: Rocket },
    { id: 'installation', title: 'Installation & Setup', icon: Settings },
    { id: 'features', title: 'Features', icon: Zap },
    { id: 'wordpress-plugin', title: 'WordPress Plugin', icon: Chrome },
    { id: 'api', title: 'API Documentation', icon: Code },
    { id: 'pricing', title: 'Pricing & Credits', icon: DollarSign },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: Wrench },
    { id: 'faq', title: 'FAQ', icon: HelpCircle }
  ];

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-3">
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </Link>
              </div>
              <div className="hidden lg:flex items-center space-x-12">
                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>
              <div className="hidden lg:flex items-center space-x-3">
                {user ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
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
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Free Trial
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Table of Contents - Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-lg font-bold mb-4" style={{ color: '#003a42' }}>
                <Book className="h-5 w-5 inline-block mr-2" />
                Documentation
              </h2>
              <nav className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeSection === section.id
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      style={activeSection === section.id ? { color: '#003a42', backgroundColor: 'rgba(13, 79, 94, 0.1)' } : {}}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
              {/* Getting Started Section */}
              <section id="getting-started" className="mb-16">
                <h1 className="text-4xl font-bold mb-4" style={{ color: '#003a42' }}>
                  Getting Started with Alt Text Pro
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                  Learn how to automatically generate professional alt-text for your images using AI.
                </p>

                <div className="prose max-w-none">
                  <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#003a42' }}>What is Alt Text Pro?</h2>
                  <p className="text-gray-700 mb-4">
                    <strong>Alt Text Pro</strong> is a powerful SaaS platform that automatically generates high-quality alt-text for your images using advanced AI technology. Whether you're using our WordPress plugin or our API, Alt Text Pro helps improve your website's accessibility, SEO, and user experience with professionally written alt-text descriptions.
                  </p>

                  <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#003a42' }}>Why Use Alt Text Pro?</h2>
                  <div className="grid md:grid-cols-2 gap-6 my-6">
                    <Card className="p-6">
                      <div className="flex items-center mb-3">
                        <Shield className="h-6 w-6 mr-3" style={{ color: '#0D4F5E' }} />
                        <h3 className="text-lg font-semibold">Accessibility Compliance</h3>
                      </div>
                      <p className="text-gray-600">Meet WCAG guidelines and make your website accessible to screen readers and assistive technologies.</p>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center mb-3">
                        <Search className="h-6 w-6 mr-3" style={{ color: '#0D4F5E' }} />
                        <h3 className="text-lg font-semibold">SEO Optimization</h3>
                      </div>
                      <p className="text-gray-600">Improve search engine rankings with better image descriptions that help search engines understand your content.</p>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center mb-3">
                        <Zap className="h-6 w-6 mr-3" style={{ color: '#0D4F5E' }} />
                        <h3 className="text-lg font-semibold">Save Time</h3>
                      </div>
                      <p className="text-gray-600">Process hundreds of images in minutes instead of hours of manual work.</p>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center mb-3">
                        <Brain className="h-6 w-6 mr-3" style={{ color: '#0D4F5E' }} />
                        <h3 className="text-lg font-semibold">AI-Powered Quality</h3>
                      </div>
                      <p className="text-gray-600">Leverage Google Gemini AI to generate accurate, context-aware descriptions.</p>
                    </Card>
                  </div>

                  <h2 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#003a42' }}>Quick Start Guide</h2>
                  <div className="bg-teal-50 border-l-4 border-teal-500 p-6 rounded-lg my-6">
                    <ol className="list-decimal list-inside space-y-3 text-gray-700">
                      <li><strong>Sign up for free</strong> at <a href="https://www.alt-text.pro" className="text-teal-600 hover:underline">alt-text.pro</a> and get 100 free credits</li>
                      <li><strong>Get your API key</strong> from your dashboard</li>
                      <li><strong>Install the WordPress plugin</strong> or use our API to start generating alt-text</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* Installation Section - will continue in next part due to length */}
              <section id="installation" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <Settings className="h-8 w-8 inline-block mr-3" />
                  Installation & Setup
                </h2>
                <div className="prose max-w-none">
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Step 1: Create Your Account</h3>
                  <p className="text-gray-700 mb-4">
                    Visit <a href="https://www.alt-text.pro" className="text-teal-600 hover:underline">www.alt-text.pro</a> and sign up for a free account. You'll receive 100 credits to get started - no credit card required.
                  </p>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Step 2: Get Your API Key</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                    <li>Log in to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="text-teal-600 hover:underline">alt-text.pro/dashboard</a></li>
                    <li>Your API key is displayed on the dashboard</li>
                    <li>Click the copy button to copy your API key</li>
                    <li>Keep your API key secure - treat it like a password</li>
                  </ol>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Step 3: Install WordPress Plugin</h3>
                  <div className="bg-gray-50 p-6 rounded-lg my-4">
                    <h4 className="font-semibold mb-3">Method 1: Download from Dashboard (Recommended)</h4>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      <li>Go to your dashboard and click "Download Plugin"</li>
                      <li>In WordPress admin, go to <strong>Plugins → Add New → Upload Plugin</strong></li>
                      <li>Choose the downloaded zip file and click "Install Now"</li>
                      <li>Activate the plugin after installation</li>
                    </ol>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg my-4">
                    <h4 className="font-semibold mb-3">Method 2: Manual Installation</h4>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      <li>Download the plugin from <a href="https://www.alt-text.pro/wordpress-plugin/alt-text-pro-plugin-1.4.1.zip" className="text-teal-600 hover:underline">alt-text.pro/wordpress-plugin/alt-text-pro-plugin-1.4.1.zip</a></li>
                      <li>Extract the zip file</li>
                      <li>Upload the <code className="bg-gray-200 px-2 py-1 rounded">alt-text-ai</code> folder to <code className="bg-gray-200 px-2 py-1 rounded">/wp-content/plugins/</code></li>
                      <li>Go to <strong>Plugins</strong> in WordPress admin and activate <strong>Alt Text Pro</strong></li>
                    </ol>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Step 4: Configure the Plugin</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                    <li>In WordPress admin, go to <strong>Alt Text Pro → Settings</strong></li>
                    <li>Paste your API key in the <strong>API Key</strong> field</li>
                    <li>Click <strong>Test Connection</strong> to verify it works</li>
                    <li>Configure your preferences:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li><strong>Auto-generate:</strong> Enable to generate alt-text automatically when uploading images</li>
                        <li><strong>Overwrite existing:</strong> Choose whether to replace existing alt-text</li>
                        <li><strong>Context-aware:</strong> Enable for better descriptions using page context</li>
                        <li><strong>Batch size:</strong> Set how many images to process at once (default: 10)</li>
                      </ul>
                    </li>
                    <li>Click <strong>Save Settings</strong></li>
                  </ol>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg my-4">
                    <p className="text-blue-800"><strong>Note:</strong> The plugin requires WordPress 5.0+ and PHP 7.4+.</p>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section id="features" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <Zap className="h-8 w-8 inline-block mr-3" />
                  Features
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <Brain className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">AI-Powered Generation</h3>
                    <p className="text-gray-600">Uses Google Gemini AI to create accurate, descriptive alt-text that understands image content and context.</p>
                  </Card>
                  <Card className="p-6">
                    <Upload className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">Automatic Processing</h3>
                    <p className="text-gray-600">Generate alt-text automatically when uploading images to WordPress. Set it and forget it!</p>
                  </Card>
                  <Card className="p-6">
                    <RefreshCw className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">Bulk Processing</h3>
                    <p className="text-gray-600">Process hundreds of existing images at once. Perfect for retrofitting alt-text to existing websites.</p>
                  </Card>
                  <Card className="p-6">
                    <Eye className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">Context-Aware</h3>
                    <p className="text-gray-600">Provides better descriptions using page context and metadata for more relevant alt-text.</p>
                  </Card>
                  <Card className="p-6">
                    <TrendingUp className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">Usage Tracking</h3>
                    <p className="text-gray-600">Monitor your API usage, credit consumption, and generation history with detailed logs.</p>
                  </Card>
                  <Card className="p-6">
                    <Globe className="h-8 w-8 mb-4" style={{ color: '#0D4F5E' }} />
                    <h3 className="text-xl font-bold mb-3">Multi-Language Support</h3>
                    <p className="text-gray-600">Generate alt-text in over 130 languages to reach a global audience.</p>
                  </Card>
                </div>
              </section>

              {/* WordPress Plugin Section */}
              <section id="wordpress-plugin" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <Chrome className="h-8 w-8 inline-block mr-3" />
                  WordPress Plugin Guide
                </h2>
                <div className="prose max-w-none">
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Dashboard Overview</h3>
                  <p className="text-gray-700 mb-4">The Alt Text Pro dashboard provides a comprehensive overview of your account and usage:</p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                    <li><strong>Credits Remaining:</strong> See how many credits you have left</li>
                    <li><strong>Usage Statistics:</strong> Track your total generations and success rate</li>
                    <li><strong>Connection Status:</strong> Verify your API connection is working</li>
                    <li><strong>Recent Activity:</strong> View your latest alt-text generations</li>
                    <li><strong>Quick Actions:</strong> Access bulk processing and settings quickly</li>
                  </ul>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Settings Configuration</h3>
                  <p className="text-gray-700 mb-4">Configure the plugin to work exactly how you need it:</p>
                  <div className="bg-gray-50 p-6 rounded-lg my-4">
                    <h4 className="font-semibold mb-3">Available Settings:</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>API Key:</strong> Your unique API key for authentication</li>
                      <li><strong>Auto-generate on Upload:</strong> Automatically generate alt-text when images are uploaded</li>
                      <li><strong>Overwrite Existing Alt-Text:</strong> Replace existing alt-text when processing</li>
                      <li><strong>Context-Aware Generation:</strong> Use page/post context for better descriptions</li>
                      <li><strong>Batch Size:</strong> Number of images to process per batch (1-50)</li>
                    </ul>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Bulk Processing Workflow</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                    <li>Go to <strong>Alt Text Pro → Bulk Process</strong></li>
                    <li>Choose your processing option:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li><strong>Process images missing alt-text:</strong> Only process images without alt-text</li>
                        <li><strong>Process all images:</strong> Process all images (with overwrite option)</li>
                        <li><strong>Process selected images:</strong> Choose specific images from media library</li>
                      </ul>
                    </li>
                    <li>Set batch size (recommended: 10-20 for best performance)</li>
                    <li>Click <strong>Start Processing</strong> and monitor progress</li>
                    <li>Review generated alt-text and edit as needed</li>
                  </ol>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Best Practices</h3>
                  <div className="bg-teal-50 border-l-4 border-teal-500 p-6 rounded-lg my-4">
                    <ul className="space-y-2 text-gray-700">
                      <li>✓ Review generated alt-text for accuracy, especially for complex images</li>
                      <li>✓ Add context when processing product images or specialized content</li>
                      <li>✓ Use bulk processing during off-peak hours for large batches</li>
                      <li>✓ Monitor your credit usage to avoid running out mid-process</li>
                      <li>✓ Keep your API key secure and never share it publicly</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* API Documentation Section */}
              <section id="api" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <Code className="h-8 w-8 inline-block mr-3" />
                  API Documentation
                </h2>
                <div className="prose max-w-none">
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Authentication</h3>
                  <p className="text-gray-700 mb-4">All API requests require authentication using your API key. Include it in the <code className="bg-gray-200 px-2 py-1 rounded">Authorization</code> header:</p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto">
                    <pre className="text-sm">Authorization: Bearer YOUR_API_KEY</pre>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Generate Alt-Text Endpoint</h3>
                  <div className="bg-gray-50 p-6 rounded-lg my-4">
                    <p className="font-mono text-sm mb-2"><strong>POST</strong> <code className="text-teal-600">/.netlify/functions/generate-alt-text</code></p>
                    <p className="text-gray-700 mb-4">Generates alt-text for an image using AI.</p>
                    <h4 className="font-semibold mt-4 mb-2">Request Body:</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg my-2 overflow-x-auto">
                      <pre className="text-sm">{`{\n  "image_base64": "base64_encoded_image_string",\n  "context": "optional context description"\n}`}</pre>
                    </div>
                    <h4 className="font-semibold mt-4 mb-2">Response (Success):</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg my-2 overflow-x-auto">
                      <pre className="text-sm">{`{\n  "alt_text": "A beautiful sunset over mountains",\n  "credits_remaining": 95\n}`}</pre>
                    </div>
                    <h4 className="font-semibold mt-4 mb-2">Response (Error):</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg my-2 overflow-x-auto">
                      <pre className="text-sm">{`{\n  "error": "Insufficient credits",\n  "details": "You have 0 credits remaining"\n}`}</pre>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Code Examples</h3>
                  <div className="my-6">
                    <h4 className="font-semibold mb-2">JavaScript (Fetch API)</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">{`const response = await fetch('https://www.alt-text.pro/.netlify/functions/generate-alt-text', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer YOUR_API_KEY'\n  },\n  body: JSON.stringify({\n    image_base64: base64Image,\n    context: 'Product photo'\n  })\n});\n\nconst data = await response.json();\nconsole.log(data.alt_text);`}</pre>
                    </div>
                  </div>
                  <div className="my-6">
                    <h4 className="font-semibold mb-2">cURL</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm">{`curl -X POST https://www.alt-text.pro/.netlify/functions/generate-alt-text \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{\n    "image_base64": "base64_encoded_image",\n    "context": "Landscape photo"\n  }'`}</pre>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Error Codes</h3>
                  <div className="bg-gray-50 p-6 rounded-lg my-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Status Code</th>
                          <th className="text-left py-2">Error</th>
                          <th className="text-left py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr className="border-b"><td className="py-2">401</td><td className="py-2">Unauthorized</td><td className="py-2">Invalid or missing API key</td></tr>
                        <tr className="border-b"><td className="py-2">402</td><td className="py-2">Payment Required</td><td className="py-2">Insufficient credits</td></tr>
                        <tr className="border-b"><td className="py-2">400</td><td className="py-2">Bad Request</td><td className="py-2">Invalid image format or missing parameters</td></tr>
                        <tr className="border-b"><td className="py-2">500</td><td className="py-2">Server Error</td><td className="py-2">Internal server error</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Pricing Section */}
              <section id="pricing" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <DollarSign className="h-8 w-8 inline-block mr-3" />
                  Pricing & Credits
                </h2>
                <div className="prose max-w-none">
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Pricing Plans</h3>
                  <div className="grid md:grid-cols-3 gap-6 my-6">
                    <Card className="p-6 border-2">
                      <h4 className="text-xl font-bold mb-2">Free</h4>
                      <div className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>$0</div>
                      <ul className="space-y-2 text-gray-700 mb-4">
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> 100 Credits</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Basic Support</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> API Access</li>
                      </ul>
                    </Card>
                    <Card className="p-6 border-2 border-teal-500">
                      <Badge className="mb-2" style={{ backgroundColor: '#0D4F5E', color: 'white' }}>Popular</Badge>
                      <h4 className="text-xl font-bold mb-2">Tier 1</h4>
                      <div className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>$12<span className="text-sm text-gray-500">/mo</span></div>
                      <ul className="space-y-2 text-gray-700 mb-4">
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> 1,000 Credits/month</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Priority Support</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Bulk Processing</li>
                      </ul>
                    </Card>
                    <Card className="p-6 border-2">
                      <h4 className="text-xl font-bold mb-2">Tier 2</h4>
                      <div className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>$20<span className="text-sm text-gray-500">/mo</span></div>
                      <ul className="space-y-2 text-gray-700 mb-4">
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> 2,500 Credits/month</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Premium Support</li>
                        <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Advanced Features</li>
                      </ul>
                    </Card>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Credit System</h3>
                  <p className="text-gray-700 mb-4">Each alt-text generation consumes <strong>1 credit</strong>. Credits are used when:</p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                    <li>Generating alt-text for a new image</li>
                    <li>Regenerating alt-text for an existing image (if overwrite is enabled)</li>
                    <li>Using the API to generate alt-text</li>
                  </ul>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg my-4">
                    <p className="text-blue-800"><strong>Note:</strong> Failed generations (due to errors) do not consume credits.</p>
                  </div>
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Upgrading Your Plan</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                    <li>Go to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="text-teal-600 hover:underline">alt-text.pro/dashboard</a></li>
                    <li>Click "Upgrade Plan" or visit the Pricing section</li>
                    <li>Select your desired plan</li>
                    <li>Complete payment via PayPal</li>
                    <li>Your new credits will be available immediately</li>
                  </ol>
                </div>
              </section>

              {/* Troubleshooting Section */}
              <section id="troubleshooting" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <Wrench className="h-8 w-8 inline-block mr-3" />
                  Troubleshooting
                </h2>
                <div className="prose max-w-none">
                  <h3 className="text-2xl font-bold mt-6 mb-4" style={{ color: '#003a42' }}>Common Issues</h3>
                  <div className="space-y-6">
                    <Card className="p-6">
                      <h4 className="font-bold text-lg mb-2">"Error loading API key" or Connection Failed</h4>
                      <p className="text-gray-700 mb-2"><strong>Solution:</strong></p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li>Verify your API key is correct in Settings</li>
                        <li>Click "Test Connection" to verify connectivity</li>
                        <li>Check your internet connection</li>
                        <li>Ensure your API key hasn't been revoked</li>
                      </ul>
                    </Card>
                    <Card className="p-6">
                      <h4 className="font-bold text-lg mb-2">"Insufficient credits" Error</h4>
                      <p className="text-gray-700 mb-2"><strong>Solution:</strong></p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li>Check your credit balance in the dashboard</li>
                        <li>Upgrade your plan or purchase additional credits</li>
                        <li>Wait for monthly credit renewal (for subscription plans)</li>
                      </ul>
                    </Card>
                    <Card className="p-6">
                      <h4 className="font-bold text-lg mb-2">Bulk Processing Stops or Fails</h4>
                      <p className="text-gray-700 mb-2"><strong>Solution:</strong></p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li>Reduce batch size (try 5-10 images per batch)</li>
                        <li>Check your credit balance before starting</li>
                        <li>Ensure your server has sufficient resources</li>
                        <li>Process during off-peak hours for better performance</li>
                      </ul>
                    </Card>
                    <Card className="p-6">
                      <h4 className="font-bold text-lg mb-2">Images Not Processing Automatically</h4>
                      <p className="text-gray-700 mb-2"><strong>Solution:</strong></p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li>Verify "Auto-generate on Upload" is enabled in Settings</li>
                        <li>Check that you have sufficient credits</li>
                        <li>Ensure your API key is valid</li>
                        <li>Check WordPress error logs for details</li>
                      </ul>
                    </Card>
                    <Card className="p-6">
                      <h4 className="font-bold text-lg mb-2">Plugin Conflicts</h4>
                      <p className="text-gray-700 mb-2"><strong>Solution:</strong></p>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        <li>Deactivate other plugins temporarily to identify conflicts</li>
                        <li>Update WordPress and all plugins to latest versions</li>
                        <li>Check PHP version (requires 7.4+)</li>
                        <li>Contact support with plugin conflict details</li>
                      </ul>
                    </Card>
                  </div>
                  <h3 className="text-2xl font-bold mt-8 mb-4" style={{ color: '#003a42' }}>Getting Help</h3>
                  <p className="text-gray-700 mb-4">If you're still experiencing issues, we're here to help:</p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                    <li>Email us at <a href="mailto:support@alt-text.pro" className="text-teal-600 hover:underline">support@alt-text.pro</a></li>
                    <li>Use the <Link to="/contact" className="text-teal-600 hover:underline">contact form</Link> on our website</li>
                    <li>Check your dashboard for usage logs and error details</li>
                  </ul>
                </div>
              </section>

              {/* FAQ Section */}
              <section id="faq" className="mb-16 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#003a42' }}>
                  <HelpCircle className="h-8 w-8 inline-block mr-3" />
                  Frequently Asked Questions
                </h2>
                <div className="space-y-6">
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Do I need an Alt Text Pro account?</h3><p className="text-gray-700">Yes, you need a free Alt Text Pro account to use the plugin or API. Sign up at <a href="https://www.alt-text.pro" className="text-teal-600 hover:underline">alt-text.pro</a> and get 100 free credits to start.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">How accurate is the AI-generated alt-text?</h3><p className="text-gray-700">Our AI uses Google Gemini and provides highly accurate descriptions. However, we always recommend reviewing and editing the generated text to ensure it fits your specific context perfectly.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I edit the generated alt-text?</h3><p className="text-gray-700">Absolutely! The plugin generates alt-text as a starting point. You can always edit, refine, or completely rewrite the descriptions in WordPress media library.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">What happens if I run out of credits?</h3><p className="text-gray-700">If you run out of credits, the plugin will stop generating new alt-text. You can purchase more credits or upgrade your plan from your dashboard.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Does this work with existing images?</h3><p className="text-gray-700">Yes! The plugin includes a powerful bulk processing feature that can generate alt-text for all your existing images that don't have alt-text yet.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Is my data secure?</h3><p className="text-gray-700">Yes, we take security seriously. Images are processed securely via encrypted HTTPS connections and are not stored on our servers after processing.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">What image formats are supported?</h3><p className="text-gray-700">The plugin supports all standard web image formats including JPEG, PNG, GIF, and WebP.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I cancel my subscription anytime?</h3><p className="text-gray-700">Yes, you can cancel your subscription at any time from your Alt Text Pro dashboard. You'll continue to have access until the end of your billing period.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Does this help with SEO?</h3><p className="text-gray-700">Yes! Proper alt-text improves your SEO by helping search engines understand your images, which can improve your rankings in image search results.</p></Card>
                  <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I use the API without WordPress?</h3><p className="text-gray-700">Yes! Our API can be integrated into any application or website. Check the API Documentation section above for code examples.</p></Card>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

// Contact Page Component
const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const navigate = useNavigate();

  // Check authentication state on mount
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/.netlify/functions/send-contact-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Thank you! Your message has been sent successfully. We\'ll get back to you soon.');
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
      } else {
        // Show detailed error message if available
        const errorMsg = data.details || data.error || 'Failed to send message';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error sending contact form:', error);
      // Show the detailed error message
      toast.error(error.message || 'Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </div>
              </div>

              {/* Centered Navigation Links */}
              <div className="hidden lg:flex items-center space-x-12">
                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>

              {/* Right Side Buttons */}
              <div className="hidden lg:flex items-center space-x-3">
                {user ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
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
                      className="text-white font-medium px-6 py-2.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)'}
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium"
                      onClick={() => {
                        window.location.href = "/";
                      }}
                    >
                      Free Trial
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Contact Form Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4" style={{ color: '#003a42' }}>
              Get in Touch
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Have a question or need help? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full"
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  className="w-full"
                />
              </div>
            </div>

            {/* Subject Field */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <Input
                id="subject"
                name="subject"
                type="text"
                value={formData.subject}
                onChange={handleChange}
                placeholder="What's this about?"
                className="w-full"
              />
            </div>

            {/* Message Field */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell us how we can help you..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={isSubmitting}
                size="lg"
                className="px-8 py-3 text-lg font-semibold"
                style={{
                  background: isSubmitting
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)',
                  color: 'white',
                  minWidth: '200px'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #003a42 0%, #0D4F5E 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)';
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2 inline-block"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 mr-2 inline-block" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Contact Information */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#003a42' }}>
                  Contact Information
                </h3>
                <div className="space-y-3 text-gray-600">
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 mr-3" style={{ color: '#0D4F5E' }} />
                    <a href="mailto:support@alt-text.pro" className="hover:text-teal-600 transition-colors">
                      support@alt-text.pro
                    </a>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#003a42' }}>
                  Response Time
                </h3>
                <p className="text-gray-600">
                  We typically respond within 24-48 hours during business days. For urgent matters, please mention it in your message.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// PayPal Subscription Button Component (using native SDK)
// This uses PayPal's native JavaScript SDK with createSubscription
const PayPalSubscriptionButton = ({ planId, planName, paypalPlanId, onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonContainerRef = React.useRef(null);

  useEffect(() => {
    // Load PayPal SDK script if not already loaded
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.async = true;
      script.setAttribute('data-sdk-integration-source', 'button-factory');
      script.onload = () => {
        setScriptLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        onError?.({ message: 'Failed to load PayPal SDK. Please refresh the page.' });
      };
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }

    return () => {
      // Cleanup: remove PayPal buttons if component unmounts
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = '';
      }
    };
  }, [onError]);

  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !buttonContainerRef.current) return;

    // Clear any existing buttons
    buttonContainerRef.current.innerHTML = '';

    // Render PayPal subscription button using native SDK
    window.paypal.Buttons({
      style: {
        shape: 'pill',
        color: 'blue',
        layout: 'vertical',
        label: 'subscribe'
      },
      createSubscription: function (data, actions) {
        console.log('Creating PayPal subscription for plan:', paypalPlanId);
        return actions.subscription.create({
          plan_id: paypalPlanId
        });
      },
      onApprove: async function (data, actions) {
        try {
          setIsLoading(true);
          console.log('PayPal subscription approved:', data);
          console.log('Subscription ID:', data.subscriptionID);

          // Get user session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('Please sign in to continue');
          }

          // Determine API base URL
          let apiBase;
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
          } else {
            apiBase = '/.netlify/functions';
          }

          // Complete the subscription on our backend
          const response = await fetch(`${apiBase}/complete-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              subscriptionId: data.subscriptionID,
              planId: planId
            })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Subscription completion failed');
          }

          console.log('Subscription completed successfully:', result);
          onSuccess?.();
        } catch (error) {
          console.error('Subscription completion error:', error);
          onError?.(error);
        } finally {
          setIsLoading(false);
        }
      },
      onError: function (err) {
        console.error('PayPal button error:', err);
        setIsLoading(false);
        onError?.({ message: err.message || 'PayPal subscription failed. Please try again.' });
      },
      onCancel: function (data) {
        console.log('PayPal subscription cancelled:', data);
        setIsLoading(false);
        toast.info('Subscription cancelled');
      }
    }).render(buttonContainerRef.current);
  }, [scriptLoaded, paypalPlanId, planId, onSuccess, onError]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-700">Processing subscription...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div ref={buttonContainerRef} id={`paypal-button-container-${paypalPlanId}`}></div>
    </div>
  );
};

// Payment Success Handler Component
// Following guidance pattern - simplified subscription activation
const PaymentSuccess = () => {
  const [status, setStatus] = useState('processing');
  const navigate = useNavigate();

  // Use URLSearchParams to get query parameters (following guidance pattern)
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  useEffect(() => {
    const subscriptionId = searchParams.get('subscription_id') ||
      searchParams.get('subscriptionId') ||
      hashParams.get('subscription_id') ||
      hashParams.get('subscriptionId') ||
      searchParams.get('token') ||
      hashParams.get('token');

    if (subscriptionId) {
      // Determine API base URL
      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      // Activate subscription (following guidance pattern)
      fetch(`${apiBase}/activate-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ACTIVE') {
            setStatus('success');
            // Redirect to dashboard or update user state
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          } else if (data.status === 'APPROVAL_PENDING' || data.status === 'APPROVED') {
            setStatus('pending');
            // Still redirect - webhook will activate
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          } else {
            setStatus('pending');
            // Unknown status - redirect anyway
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          }
        })
        .catch(error => {
          console.error('Subscription activation error:', error);
          setStatus('error');
        });
    } else {
      // No subscription ID found - might be one-time payment or error
      console.warn('No subscription ID found in URL parameters');
      setStatus('error');
    }
  }, [searchParams, hashParams, navigate]);

  // Following guidance pattern - simple status-based rendering
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center max-w-md mx-auto p-6">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">✓ Subscription Activated!</h1>
          <p className="text-gray-600 mb-6">Welcome to Alt Text Pro! Your subscription is now active.</p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Processing your subscription...</p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Subscription Pending</h2>
          <p className="text-gray-600 mb-6">Your subscription is being processed. You will be redirected to your dashboard shortly.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">Please contact support if this issue persists.</p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          toast.error("Please sign in to access the admin dashboard");
          navigate("/");
          return;
        }

        setUser({
          email: session.user.email,
          id: session.user.id,
          token: session.access_token
        });

        await loadUsers(session.access_token);
      } catch (error) {
        console.error("Error checking auth:", error);
        toast.error("Authentication error");
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [navigate]);

  const loadUsers = async (token) => {
    try {
      let apiBase;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost Netlify Dev functions (port 9999)
        apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
      } else {
        apiBase = '/.netlify/functions';
      }

      const response = await fetch(`${apiBase}/admin-get-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 403) {
        toast.error("Access denied. Superuser privileges required.");
        navigate("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setUsers(result.data.users || []);
        setStats(result.data.stats || null);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users. Please try again.");
    }
  };

  const handleRefresh = async () => {
    if (user?.token) {
      setIsLoading(true);
      await loadUsers(user.token);
      setIsLoading(false);
      toast.success("Users refreshed");
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === "all" || user.subscription_plan === filterPlan;
    const matchesStatus = filterStatus === "all" || user.subscription_status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount || 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: '#0D4F5E' }}></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage users, credits, and subscriptions</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
              <Button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/");
                  toast.success("Signed out");
                }}
                variant="outline"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{formatCurrency(stats.total_revenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.active_users}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Credits Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{stats.total_credits_used.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by email or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Plan</label>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="tier1">Tier 1</option>
                  <option value="tier2">Tier 2</option>
                  <option value="tier3">Tier 3</option>
                  <option value="pay_as_go">Pay as You Go</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Processed</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Paid</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((userData) => (
                      <tr key={userData.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{userData.email}</div>
                          <div className="text-xs text-gray-500 font-mono">{userData.id.substring(0, 8)}...</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-purple-100 text-purple-700">
                            {userData.subscription_plan || "free"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              userData.subscription_status === "active"
                                ? "bg-green-100 text-green-700"
                                : userData.subscription_status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-teal-100 text-teal-700"
                            }
                          >
                            {userData.subscription_status || "active"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{userData.credits_remaining || 0}</div>
                          <div className="text-xs text-gray-500">
                            Used: {userData.total_credits_used || 0}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{userData.total_processed || 0}</div>
                          <div className="text-xs text-gray-500">
                            Logs: {userData.total_usage_count || 0}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-green-600">
                            {formatCurrency(userData.total_paid || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {userData.payment_count || 0} payment(s)
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(userData.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(userData)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white shadow-xl">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>User Details</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">User ID</label>
                <p className="text-gray-900 font-mono text-sm">{selectedUser.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Subscription Plan</label>
                  <p className="text-gray-900">
                    <Badge className="bg-purple-100 text-purple-700">
                      {selectedUser.subscription_plan || "free"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Subscription Status</label>
                  <p className="text-gray-900">
                    <Badge
                      className={
                        selectedUser.subscription_status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }
                    >
                      {selectedUser.subscription_status || "active"}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Credits Remaining</label>
                  <p className="text-2xl font-bold text-gray-900">{selectedUser.credits_remaining || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Processed</label>
                  <p className="text-2xl font-bold text-gray-900">{selectedUser.total_processed || 0}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Credits Used</label>
                  <p className="text-gray-900">{selectedUser.total_credits_used || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Usage Count</label>
                  <p className="text-gray-900">{selectedUser.total_usage_count || 0}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Total Paid</label>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedUser.total_paid || 0)}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedUser.payment_count || 0} payment(s)
                </p>
              </div>
              {selectedUser.latest_payment && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Latest Payment</label>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm">
                      <span className="font-semibold">Amount:</span> {formatCurrency(selectedUser.latest_payment.amount)}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Status:</span> {selectedUser.latest_payment.status}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Plan:</span> {selectedUser.latest_payment.plan_id}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Date:</span> {formatDate(selectedUser.latest_payment.created_at)}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Created At</label>
                  <p className="text-gray-900">{formatDate(selectedUser.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Updated At</label>
                  <p className="text-gray-900">{formatDate(selectedUser.updated_at)}</p>
                </div>
              </div>
              {selectedUser.next_billing_date && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Next Billing Date</label>
                  <p className="text-gray-900">{formatDate(selectedUser.next_billing_date)}</p>
                </div>
              )}
              {selectedUser.expires_at && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Expires At</label>
                  <p className="text-gray-900">{formatDate(selectedUser.expires_at)}</p>
                </div>
              )}
              {selectedUser.subscription_id && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Subscription ID</label>
                  <p className="text-gray-900 font-mono text-sm">{selectedUser.subscription_id}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Terms & Conditions Page Component
const TermsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-3">
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </Link>
              </div>
              <div className="hidden lg:flex items-center space-x-12">
                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms & Conditions</h1>
          <p className="text-gray-600 mb-8">Last updated: November 2024</p>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction and Acceptance</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Welcome to Alt Text Pro ("we," "our," or "us"). These Terms & Conditions ("Terms") govern your access to and use of our AI-powered alt-text generation service, including our website, API, and WordPress plugin (collectively, the "Service").
              </p>
              <p className="text-gray-700 leading-relaxed">
                By accessing or using our Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Alt Text Pro is an AI-powered service that automatically generates descriptive alt text for images using Google Gemini AI technology. Our Service includes:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Web-based alt-text generation tool</li>
                <li>RESTful API for programmatic access</li>
                <li>WordPress plugin for automated alt-text generation</li>
                <li>Support for over 130 languages</li>
                <li>Bulk processing capabilities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration and User Responsibilities</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                To use our Service, you must:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mb-4">
                <li>Create an account with a valid email address</li>
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Be at least 18 years old or have parental consent</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription Plans and Pricing</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We offer the following subscription plans:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 mb-4">
                <ul className="space-y-3 text-gray-700">
                  <li><strong>Free Plan:</strong> $0/month - 100 credits per month</li>
                  <li><strong>Tier 1:</strong> $12/month - 1,000 credits per month</li>
                  <li><strong>Tier 2:</strong> $20/month - 2,500 credits per month</li>
                  <li><strong>Tier 3:</strong> $40/month - 5,000 credits per month</li>
                  <li><strong>Pay as you go:</strong> $5 one-time - 300 credits (no expiration)</li>
                  <li><strong>Small Pack:</strong> $3 one-time - 100 credits (no expiration)</li>
                </ul>
              </div>
              <p className="text-gray-700 leading-relaxed">
                All prices are in USD. Subscription plans renew automatically on a monthly basis unless cancelled. Credits reset at the beginning of each billing cycle for subscription plans. One-time credit packs do not expire.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Payment Terms</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payments are processed through PayPal. By subscribing, you authorize us to charge your PayPal account for the subscription fee on a recurring monthly basis.
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Subscription fees are charged in advance for each billing period</li>
                <li>One-time payments are charged immediately upon purchase</li>
                <li>All fees are non-refundable except as required by law</li>
                <li>If payment fails, your account may be suspended until payment is received</li>
                <li>We reserve the right to change our pricing with 30 days' notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Cancellation and Refund Policy</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You may cancel your subscription at any time through your PayPal account or by contacting us. Cancellation will take effect at the end of your current billing period.
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>No refunds are provided for partial billing periods</li>
                <li>Unused credits expire at the end of the billing period for subscription plans</li>
                <li>One-time credit packs are non-refundable</li>
                <li>Refunds may be provided at our sole discretion in exceptional circumstances</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. API Usage Terms</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you use our API:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>You must keep your API key secure and confidential</li>
                <li>You are responsible for all API usage under your account</li>
                <li>You must not share your API key with third parties</li>
                <li>You must comply with rate limits and usage restrictions</li>
                <li>We reserve the right to revoke API access for violations of these Terms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. WordPress Plugin Usage</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Our WordPress plugin is provided "as is" for use with WordPress websites. By using the plugin:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>You must have a valid Alt Text Pro account with active credits</li>
                <li>You are responsible for ensuring the plugin is compatible with your WordPress installation</li>
                <li>We are not responsible for any issues arising from plugin conflicts or WordPress updates</li>
                <li>The plugin may be updated or discontinued at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Prohibited Uses</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Violate any laws in your jurisdiction</li>
                <li>Infringe upon the intellectual property rights of others</li>
                <li>Attempt to reverse engineer or extract source code from the Service</li>
                <li>Use automated systems to abuse or overload our Service</li>
                <li>Share your account credentials with others</li>
                <li>Use the Service to generate alt text for illegal, harmful, or offensive content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Intellectual Property Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                The Service, including all content, features, and functionality, is owned by Alt Text Pro and protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Generated alt text is provided for your use, but you acknowledge that:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Alt text is generated using AI technology and may not always be accurate</li>
                <li>You are responsible for reviewing and editing generated alt text as needed</li>
                <li>We do not claim ownership of the alt text generated for your images</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALT TEXT PRO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Our total liability for any claims arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim. We are not responsible for the accuracy, quality, or appropriateness of AI-generated alt text.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Service Modifications and Termination</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We reserve the right to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Modify, suspend, or discontinue the Service at any time</li>
                <li>Change features, pricing, or availability without prior notice</li>
                <li>Terminate or suspend your account for violations of these Terms</li>
                <li>Refuse service to anyone for any reason</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law and Disputes</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Any disputes arising from these Terms or the Service shall be resolved through binding arbitration or in the courts of the United States.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                <strong>Email:</strong> help@wpgeared.com<br />
                <strong>Website:</strong> <Link to="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Changes to Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

// Privacy Policy Page Component
const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-3">
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </Link>
              </div>
              <div className="hidden lg:flex items-center space-x-12">
                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: November 2024</p>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed">
                Alt Text Pro ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered alt-text generation service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.1 Account Information</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Email address (required for account creation)</li>
                <li>Password (stored in encrypted/hashed format)</li>
                <li>Account creation date and last login information</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.2 Payment Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payment processing is handled by PayPal. We do not store your credit card or PayPal account details. PayPal may share transaction information with us, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Payment amount and currency</li>
                <li>Transaction date and status</li>
                <li>Subscription plan information</li>
                <li>PayPal transaction IDs</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.3 Usage Data</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We collect information about how you use our Service:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Number of images processed</li>
                <li>Credits used and remaining</li>
                <li>API usage statistics</li>
                <li>Subscription plan and status</li>
                <li>Feature usage patterns</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">2.4 Technical Information</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device information</li>
                <li>API keys (for authenticated API access)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process payments and manage subscriptions</li>
                <li>Send service-related communications (account updates, billing notices)</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Monitor and analyze usage patterns to improve our Service</li>
                <li>Detect, prevent, and address technical issues or security threats</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Storage</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Your data is stored securely using Supabase, a cloud-based database platform. Supabase provides:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Encrypted data storage</li>
                <li>Secure authentication and authorization</li>
                <li>Regular backups and data redundancy</li>
                <li>Compliance with industry security standards</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Data is stored in the United States, but may be processed in other jurisdictions as part of Supabase's global infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Third-Party Services</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use the following third-party services that may process your data:
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.1 Supabase</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use Supabase for user authentication, database storage, and user management. Supabase's privacy policy applies to data stored in their systems.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.2 PayPal</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payment processing is handled by PayPal. When you make a payment, PayPal collects and processes your payment information according to their privacy policy. We receive transaction details but not your full payment credentials.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">5.3 Google Gemini AI</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use Google's Gemini AI to generate alt text for your images. When you submit an image for processing, it is sent to Google's AI service. Google's privacy policy applies to data processed by their AI services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Encryption of data in transit (HTTPS/TLS)</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Secure password hashing (passwords are never stored in plain text)</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication requirements</li>
                <li>API key security and rotation</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to certain processing of your information</li>
                <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise these rights, please contact us at help@wpgeared.com. We will respond to your request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain your personal information for as long as necessary to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Provide our Service to you</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce our agreements</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or legitimate business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Maintain your login session</li>
                <li>Remember your preferences</li>
                <li>Analyze Service usage and performance</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Our Service is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately, and we will delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. International Data Transfers</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
              </p>
              <p className="text-gray-700 leading-relaxed">
                By using our Service, you consent to the transfer of your information to the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. California Privacy Rights</h2>
              <p className="text-gray-700 leading-relaxed">
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information. We do not sell your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. European Privacy Rights (GDPR)</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                To exercise these rights, contact us at help@wpgeared.com. We will respond within one month.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Policy Updates</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                <strong>Email:</strong> help@wpgeared.com<br />
                <strong>Website:</strong> <Link to="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

// Email Confirmation Component
const EmailConfirmation = () => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check both hash and query parameters (Supabase can use either)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const type = hashParams.get('type') || queryParams.get('type');

        if (type === 'signup' && accessToken) {
          // Set the session
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });

          if (sessionError) {
            throw sessionError;
          }

          if (data.session) {
            setIsConfirmed(true);
            // Clear URL hash/query to clean up the URL
            window.history.replaceState({}, document.title, '/email-confirmed');
          }
        } else {
          // Check if user is already confirmed (might have been redirected here after confirmation)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsConfirmed(true);
            // Clear URL hash/query to clean up the URL
            window.history.replaceState({}, document.title, '/email-confirmed');
          } else {
            // If no session and no token, show error
            setError('Invalid confirmation link. Please try signing up again.');
          }
        }
      } catch (err) {
        console.error('Email confirmation error:', err);
        setError(err.message || 'Failed to confirm email. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    handleEmailConfirmation();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/logo-alt-text-pro.png"
              alt="Alt Text Pro Logo"
              className="h-16 w-16 object-contain"
            />
          </div>

          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                style={{ borderColor: '#0D4F5E' }}></div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your email...</h1>
              <p className="text-gray-600">Please wait while we verify your account.</p>
            </>
          ) : error ? (
            <>
              <div className="mb-4">
                <X className="h-12 w-12 mx-auto text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmation Failed</h1>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button
                onClick={() => navigate('/')}
                className="w-full"
                style={{
                  background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)',
                  color: 'white'
                }}
              >
                Go to Homepage
              </Button>
            </>
          ) : isConfirmed ? (
            <>
              <div className="mb-4">
                <CheckCircle className="h-16 w-16 mx-auto" style={{ color: '#0D4F5E' }} />
              </div>
              <h1 className="text-3xl font-bold mb-4" style={{ color: '#003a42' }}>
                Thanks for confirming your email!
              </h1>
              <p className="text-gray-600 mb-6">
                Your account has been successfully verified. You'll be redirected to your dashboard shortly.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                  style={{
                    background: 'linear-gradient(135deg, #0D4F5E 0%, #004953 100%)',
                    color: 'white'
                  }}
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full"
                  style={{
                    borderColor: '#003a42',
                    color: '#003a42'
                  }}
                >
                  Back to Homepage
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};


// About Page Component
const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full shadow-lg border border-gray-100 px-6 py-3" style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-3">
                  <img
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro Logo"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-2xl font-bold text-gray-900">Alt Text Pro</span>
                </Link>
              </div>
              <div className="hidden lg:flex items-center space-x-12">
                <a href="/#pricing" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Pricing</a>
                <Link to="/contact" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Contact</Link>
                <Link to="/docs" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Docs</Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">About Us</h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <p className="text-xl text-gray-600 leading-relaxed">
                Alt Text Pro is dedicated to making the web more accessible for everyone. Our mission is to help website owners, developers, and content creators ensure their images are properly described for screen readers and search engines.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed">
                We believe that accessibility shouldn't be an afterthought or a difficult technical hurdle. By leveraging advanced AI technology, we automate the process of generating accurate, descriptive alternative text for images, saving time while improving web accessibility compliance (WCAG) and SEO performance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Why Accessibility Matters</h2>
              <p className="text-gray-700 leading-relaxed">
                Millions of people rely on screen readers to navigate the web. Without proper alt text, images are invisible to these users. We are committed to bridging this gap by providing tools that make it effortless to add high-quality descriptions to every image on your website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">The Team</h2>
              <p className="text-gray-700 leading-relaxed">
                Alt Text Pro is built by a team of passionate developers and accessibility advocates. We are constantly refining our AI models and plugins to provide the best possible experience for our users and, ultimately, for the users of the websites we help improve.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-700 leading-relaxed">
                We'd love to hear from you. Whether you have questions, feedback, or just want to say hello, please feel free to reach out.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>Email:</strong> help@wpgeared.com<br />
                <strong>Website:</strong> <Link to="/contact" className="text-teal-600 hover:text-teal-700">www.alt-text.pro/contact</Link>
              </p>
            </section>
          </div>
        </div>
      </div>
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
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/contact" element={<ContactPageExtracted />} />
          <Route path="/about" element={<AboutPageExtracted />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/email-confirmed" element={<EmailConfirmation />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/payment-cancelled" element={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
              <div className="text-center max-w-md mx-auto p-6">
                <X className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Cancelled</h2>
                <p className="text-gray-600 mb-6">Your payment was cancelled. You can try again anytime.</p>
                <Button onClick={() => window.location.href = '/dashboard'} className="bg-teal-600 hover:bg-teal-700">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;