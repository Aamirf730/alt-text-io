import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Separator } from "./components/ui/separator";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket, Mail, Chrome } from "lucide-react";

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API base URL for Netlify functions
const API_BASE = '/.netlify/functions';

// Landing Page Component with Enhanced Auth
const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);

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
        // Login existing user
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      } else {
        // Register new user
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              subscription_plan: 'free_trial',
              credits_remaining: 30
            }
          }
        });
      }

      if (result.error) {
        if (result.error.message.includes('Email not confirmed')) {
          toast.success("Please check your email and click the confirmation link!");
        } else {
          toast.error(result.error.message);
        }
      } else if (result.data.user) {
        if (!isLogin && !result.data.session) {
          toast.success("Account created! Please check your email to confirm your account.");
        } else {
          toast.success(isLogin ? "Welcome back!" : "Welcome to Alt-Text AI!");
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
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
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

  const pricingPlans = [
    {
      id: "free_trial",
      name: "Free Trial",
      price: 0,
      credits: 30,
      billing: "one-time",
      features: ["30 AI-generated alt-texts", "Basic support", "WordPress plugin"],
      popular: false,
      color: "from-slate-500 to-slate-600"
    },
    {
      id: "starter",
      name: "Starter",
      price: 5,
      credits: 500,
      billing: "monthly",
      features: ["500 alt-texts/month", "Priority support", "SEO optimization", "Bulk processing"],
      popular: true,
      color: "from-emerald-500 to-emerald-600"
    },
    {
      id: "pro",
      name: "Pro",
      price: 10,
      credits: 2000,
      billing: "monthly",
      features: ["2000 alt-texts/month", "Premium support", "Advanced API access", "Analytics"],
      popular: false,
      color: "from-violet-500 to-violet-600"
    },
    {
      id: "pay_as_go",
      name: "Pay-as-you-go",
      price: 3,
      credits: 50,
      billing: "credits",
      features: ["50 AI alt-texts", "No expiration", "Flexible usage", "Perfect for testing"],
      popular: false,
      color: "from-orange-500 to-orange-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-2 rounded-xl">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-800">Alt-Text AI</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-800 transition-colors">Features</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-800 transition-colors">Pricing</a>
              <a href="#how-it-works" className="text-slate-600 hover:text-slate-800 transition-colors">How it Works</a>
              <Link to="/dashboard" className="text-violet-600 hover:text-violet-700 font-medium">Dashboard</Link>
              <Button
                variant="outline"
                onClick={() => setShowAuthForm(true)}
                className="ml-4"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-violet-100 text-violet-700 hover:bg-violet-200">
            ✨ Powered by Advanced AI + Supabase Auth
          </Badge>
          <h1 className="text-6xl font-bold text-slate-800 mb-6 leading-tight">
            Generate Perfect
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent"> Alt-Text </span>
            for Your Images
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Boost your WordPress SEO with AI-generated, accessible alt-text. Sign in with email or Google to get started with 30 free credits.
          </p>

          {!showAuthForm ? (
            <div className="space-y-4">
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => setShowAuthForm(true)}
                  className="h-14 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold text-lg"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                  variant="outline"
                  className="h-14 px-8 border-2 text-lg font-semibold"
                >
                  {isGoogleLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600 mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Chrome className="mr-2 h-5 w-5 text-blue-600" />
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Card className="max-w-md mx-auto mt-8">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <p className="text-slate-600">Sign in to your Alt-Text AI account</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Google Sign In Button */}
                <Button
                  onClick={handleGoogleAuth}
                  disabled={isGoogleLoading}
                  variant="outline"
                  className="w-full h-12 text-base font-semibold border-2"
                >
                  {isGoogleLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <Chrome className="mr-2 h-5 w-5 text-blue-600" />
                      Continue with Google
                    </>
                  )}
                </Button>

                <div className="relative">
                  <Separator />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white px-2 text-sm text-slate-500">or</span>
                  </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-base"
                      disabled={isLoading}
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
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold text-base"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        {isLogin ? "Signing in..." : "Creating account..."}
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-5 w-5" />
                        {isLogin ? "Sign In" : "Create Account"}
                      </>
                    )}
                  </Button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                  >
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowAuthForm(false)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    ← Back to homepage
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showAuthForm && (
            <div className="flex items-center justify-center space-x-8 text-sm text-slate-500 mt-8">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                30 free alt-texts
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                No credit card required
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                WordPress plugin included
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">
              Everything You Need for Perfect Alt-Text
            </h2>
            <p className="text-xl text-slate-600">
              Powerful features designed to enhance your website's accessibility and SEO
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">AI-Powered Generation</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Advanced AI technology analyzes your images and generates contextually accurate, SEO-optimized alt-text in seconds.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Easy Authentication</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Sign in with your email or Google account. Secure authentication powered by Supabase with automatic WordPress integration.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="bg-gradient-to-r from-orange-500 to-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">SEO Optimization</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Every generated alt-text is optimized for search engines while maintaining natural readability and accessibility compliance.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">
              How Alt-Text AI Works
            </h2>
            <p className="text-xl text-slate-600">
              Get up and running in minutes with our simple 3-step process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Sign Up with Email or Google</h3>
              <p className="text-slate-600">
                Create your account using email/password or sign in instantly with Google. Get 30 free credits to start.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Install WordPress Plugin</h3>
              <p className="text-slate-600">
                Download and install our WordPress plugin, then connect it with your account for seamless integration.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Automatic Alt-Text</h3>
              <p className="text-slate-600">
                Upload images as usual. Alt-text is generated automatically, or use bulk processing for existing images.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600">
              Choose the plan that fits your needs. Start free, scale as you grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan, index) => (
              <Card key={plan.id} className={`relative border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${plan.popular ? 'ring-2 ring-emerald-500 scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white px-4 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`bg-gradient-to-r ${plan.color} w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4`}>
                    <span className="text-white font-bold text-lg">{plan.name[0]}</span>
                  </div>
                  <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-slate-800">${plan.price}</span>
                    <span className="text-slate-500">/{plan.billing === 'monthly' ? 'mo' : plan.billing}</span>
                  </div>
                  <p className="text-emerald-600 font-semibold">{plan.credits} alt-texts</p>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-sm text-slate-600">
                        <CheckCircle className="h-4 w-4 text-emerald-500 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full bg-gradient-to-r ${plan.color} hover:opacity-90 text-white`}
                    onClick={() => {
                      if (plan.id === 'free_trial') {
                        setShowAuthForm(true);
                      } else {
                        toast.info(`${plan.name} plan coming soon! Start with free trial.`);
                      }
                    }}
                  >
                    {plan.id === 'free_trial' ? 'Start Free Trial' : 'Choose Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-violet-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Boost Your WordPress SEO?
          </h2>
          <p className="text-xl text-violet-100 mb-8">
            Join thousands of WordPress users who trust Alt-Text AI for better accessibility and SEO rankings.
          </p>

          <div className="flex items-center justify-center space-x-8 mb-8">
            <div className="flex items-center text-violet-100">
              <Users className="h-5 w-5 mr-2" />
              <span>10,000+ images processed</span>
            </div>
            <div className="flex items-center text-violet-100">
              <Shield className="h-5 w-5 mr-2" />
              <span>Secure Google & Email Auth</span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-violet-600 hover:bg-violet-50 font-semibold px-8 py-3 text-lg"
              onClick={() => setShowAuthForm(true)}
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-violet-600 font-semibold px-8 py-3 text-lg"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-2 rounded-xl">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Alt-Text AI</span>
              </div>
              <p className="text-slate-400">
                AI-powered alt-text generation for better accessibility and SEO.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">WordPress Plugin</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 mt-8 pt-8 text-center">
            <p className="text-slate-400">
              © 2025 Alt-Text AI. All rights reserved. Powered by Advanced AI & Supabase Auth.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Dashboard Component with Enhanced Auth
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadDashboard();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        toast.success('Successfully signed in!');
        loadDashboard();
      } else if (event === 'SIGNED_OUT') {
        window.location.href = "/";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDashboard = async () => {
    try {
      // Get current user from Supabase
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        console.log('No user found, redirecting to home');
        window.location.href = "/";
        return;
      }

      setUser(user);

      // Get the session for the access token
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Get usage stats from Netlify function
        const response = await fetch(`${API_BASE}/get-usage`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const stats = await response.json();
          setUsageStats(stats);
        } else {
          toast.error("Failed to load usage statistics");
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTestImage(e.target.result);
        setTestResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTestAltText = async () => {
    if (!testImage || !user) {
      toast.error("Please upload an image first");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please sign in again");
        return;
      }

      const base64Data = testImage.split(',')[1];
      const response = await fetch(`${API_BASE}/generate-alt-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image_base64: base64Data,
          context: "Test image for Alt-Text AI SaaS"
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
        setUsageStats(prev => ({
          ...prev,
          credits_remaining: result.credits_remaining,
          total_processed: prev.total_processed + 1
        }));
        toast.success("Alt-text generated successfully!");
      } else {
        const error = await response.json();
        if (response.status === 402) {
          toast.error("No credits remaining. Please upgrade your plan.");
        } else {
          toast.error(error.error || "Failed to generate alt-text");
        }
      }
    } catch (error) {
      console.error("Failed to generate alt-text:", error);
      toast.error("Failed to generate alt-text. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      window.location.href = "/";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'google':
        return <Chrome className="h-4 w-4 text-blue-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-slate-600" />;
      default:
        return <Mail className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-2 rounded-xl">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-800">Alt-Text AI</span>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getProviderIcon(user?.app_metadata?.provider)}
                <span className="text-slate-600">
                  Welcome, {user?.user_metadata?.full_name || user?.email}
                </span>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-600">
            Powered by Netlify + Supabase • Signed in with {user?.app_metadata?.provider || 'email'}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Usage Stats */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-violet-600" />
                  Usage Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">Current Plan</span>
                    <Badge className="bg-violet-100 text-violet-700">
                      {usageStats?.current_plan?.replace('_', ' ') || 'Loading...'}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">Credits Remaining</span>
                    <span className="font-semibold text-slate-800">
                      {usageStats?.credits_remaining || 0}
                    </span>
                  </div>
                  <Progress value={(usageStats?.credits_remaining / 30) * 100} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Total Processed</span>
                    <span className="font-semibold text-slate-800">
                      {usageStats?.total_processed || 0}
                    </span>
                  </div>
                </div>

                {usageStats?.plan_expires && (
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Plan Expires</span>
                      <span className="text-sm text-slate-800">
                        {new Date(usageStats.plan_expires).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Email Address</label>
                  <div className="bg-slate-100 p-3 rounded-lg text-sm">
                    {user?.email}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Authentication Method</label>
                  <div className="flex items-center space-x-2 bg-slate-100 p-3 rounded-lg">
                    {getProviderIcon(user?.app_metadata?.provider)}
                    <span className="text-sm capitalize">
                      {user?.app_metadata?.provider === 'google' ? 'Google OAuth' : 'Email & Password'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-2 block">Account Created</label>
                  <div className="bg-slate-100 p-3 rounded-lg text-sm">
                    {new Date(user?.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-slate-800">WordPress Plugin Setup:</h4>
                  <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                    <li>Download the Alt-Text AI WordPress plugin</li>
                    <li>Install and activate the plugin</li>
                    <li>Go to Settings → Alt-Text AI</li>
                    <li>Use your account email for authentication</li>
                    <li>Save settings and start generating alt-text!</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Service */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Test Alt-Text Generation</CardTitle>
                <p className="text-slate-600">Upload an image to test our AI-powered alt-text generation</p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="upload">Upload Image</TabsTrigger>
                    <TabsTrigger value="result" disabled={!testResult}>Generated Result</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-6">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="mb-4 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                      />

                      {testImage && (
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
                            <img
                              src={testImage}
                              alt="Test upload"
                              className="max-w-full max-h-64 mx-auto rounded-lg"
                            />
                          </div>

                          <Button
                            onClick={generateTestAltText}
                            disabled={isGenerating || usageStats?.credits_remaining <= 0}
                            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
                  </TabsContent>

                  <TabsContent value="result" className="space-y-6">
                    {testResult && (
                      <div className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <h4 className="font-semibold text-emerald-800 mb-2">Generated Alt-Text:</h4>
                          <p className="text-emerald-700 text-lg font-medium">
                            "{testResult.alt_text}"
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm text-slate-600">Credits Used</div>
                            <div className="text-2xl font-bold text-slate-800">{testResult.credits_used}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="text-sm text-slate-600">Credits Remaining</div>
                            <div className="text-2xl font-bold text-slate-800">{testResult.credits_remaining}</div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => {
                            setTestImage(null);
                            setTestResult(null);
                          }}
                          className="w-full"
                        >
                          Test Another Image
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component with Auth State Management
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Supabase auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Initializing Alt-Text AI...</p>
        </div>
      </div>
    );
  }

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