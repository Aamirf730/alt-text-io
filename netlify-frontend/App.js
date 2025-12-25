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
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { Brain, Zap, CheckCircle, Star, ArrowRight, Users, Shield, Rocket } from "lucide-react";

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// API base URL for Netlify functions
const API_BASE = '/.netlify/functions';

// Landing Page Component
const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);

  const handleAuth = async (e) => {
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
        });
      }

      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success(isLogin ? "Welcome back!" : "Account created! Welcome to Alt-Text AI!");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Same beautiful landing page JSX as before, but with updated form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation - same as before */}
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
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Supabase Auth */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-6 bg-violet-100 text-violet-700 hover:bg-violet-200">
            ✨ Powered by AI + Supabase
          </Badge>
          <h1 className="text-6xl font-bold text-slate-800 mb-6 leading-tight">
            Generate Perfect
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent"> Alt-Text </span>
            for Your Images
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Boost your WordPress SEO with AI-generated, accessible alt-text. Hosted on Netlify with Supabase database for maximum reliability and scalability.
          </p>

          <form onSubmit={handleAuth} className="max-w-md mx-auto mb-12 space-y-4">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-12 text-lg"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-3">
              <Input
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 h-12 text-lg"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-12 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold"
              >
                {isLoading ? "Processing..." : (isLogin ? "Sign In" : "Start Free Trial")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-slate-500 text-center">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-violet-600 hover:text-violet-700 font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </form>

          <div className="flex items-center justify-center space-x-8 text-sm text-slate-500">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
              30 free alt-texts
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
              Powered by Supabase
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
              Hosted on Netlify
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the landing page sections remain the same... */}
      {/* Features, How it Works, Pricing, CTA, Footer sections */}
    </div>
  );
};

// Dashboard Component with Supabase
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Get current user from Supabase
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        window.location.href = "/";
        return;
      }

      setUser(user);

      // Get usage stats from Netlify function
      const response = await fetch(`${API_BASE}/get-usage`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
        },
      });

      if (response.ok) {
        const stats = await response.json();
        setUsageStats(stats);
      } else {
        toast.error("Failed to load usage statistics");
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
      const base64Data = testImage.split(',')[1];
      const response = await fetch(`${API_BASE}/generate-alt-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`,
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
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Rest of the dashboard JSX remains similar, but with handleLogout and user.email
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
              <span className="text-slate-600">Welcome, {user?.email}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Rest of dashboard JSX similar to before but using Supabase auth */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-600">Powered by Netlify + Supabase</p>
        </div>

        {/* Dashboard content remains the same... */}
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
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;