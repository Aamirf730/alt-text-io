import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Rocket, Settings, Zap, Chrome, Code, DollarSign, Wrench, HelpCircle,
    Book, Shield, Search, Brain, Upload, RefreshCw, Eye, TrendingUp, Globe, Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

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

                            {/* Installation Section */}
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

export default DocsPage;
