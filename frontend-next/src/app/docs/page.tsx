"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Rocket, Settings, Zap, Chrome, Code, DollarSign, Wrench, HelpCircle,
    Book, Shield, Search, Brain, Upload, RefreshCw, Eye, TrendingUp, PencilLine, Check
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLUGIN_VERSION } from '@/lib/utils';
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from '@/lib/pricing-catalog';

const DOC_SECTIONS = [
    { id: 'getting-started', title: 'Getting Started', icon: Rocket },
    { id: 'installation', title: 'Installation & Setup', icon: Settings },
    { id: 'features', title: 'Features', icon: Zap },
    { id: 'wordpress-plugin', title: 'WordPress Plugin', icon: Chrome },
    { id: 'api', title: 'API Documentation', icon: Code },
    { id: 'pricing', title: 'Pricing & Credits', icon: DollarSign },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: Wrench },
    { id: 'faq', title: 'FAQ', icon: HelpCircle }
];

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState('getting-started');

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(sectionId);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 200;
            for (let i = DOC_SECTIONS.length - 1; i >= 0; i--) {
                const section = document.getElementById(DOC_SECTIONS[i].id);
                if (section && section.offsetTop <= scrollPosition) {
                    setActiveSection(DOC_SECTIONS[i].id);
                    break;
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Table of Contents - Sidebar */}
                    <aside className="lg:w-64 flex-shrink-0">
                        <div className="sticky top-24 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 text-black">
                                <Book className="h-5 w-5 inline-block mr-2" />
                                Documentation
                            </h2>
                            <nav className="space-y-2">
                                {DOC_SECTIONS.map((section) => {
                                    const Icon = section.icon;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${activeSection === section.id
                                                ? 'bg-[#FEE11C]/20 text-black'
                                                : 'text-gray-700 hover:bg-gray-50'
                                                }`}
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
                                <h1 className="text-4xl font-bold mb-4 text-black">
                                    Getting Started with Alt Text Pro
                                </h1>
                                <p className="text-xl text-gray-600 mb-8">
                                    Learn how to generate and review AI-assisted alt-text drafts for your images.
                                </p>

                                <div className="prose max-w-none">
                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-black">What is Alt Text Pro?</h2>
                                    <p className="text-gray-700 mb-4">
                                        <strong>Alt Text Pro</strong> is a SaaS service and WordPress plugin that generates editable alt-text drafts with AI. It can help fill missing image descriptions, but you remain responsible for checking the result against the image and its page context.
                                    </p>

                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-black">Why Use Alt Text Pro?</h2>
                                    <div className="grid md:grid-cols-2 gap-6 my-6">
                                        <Card className="p-6">
                                            <div className="flex items-center mb-3">
                                                <Shield className="h-6 w-6 mr-3 text-black" />
                                                <h3 className="text-lg font-semibold">Accessibility Support</h3>
                                            </div>
                                            <p className="text-gray-600">Add reviewable image descriptions that support screen-reader users and help address WCAG text-alternative requirements.</p>
                                        </Card>
                                        <Card className="p-6">
                                            <div className="flex items-center mb-3">
                                                <Search className="h-6 w-6 mr-3 text-black" />
                                                <h3 className="text-lg font-semibold">Search Context</h3>
                                            </div>
                                            <p className="text-gray-600">Give search engines clearer text context for image content without promising a particular ranking outcome.</p>
                                        </Card>
                                        <Card className="p-6">
                                            <div className="flex items-center mb-3">
                                                <Zap className="h-6 w-6 mr-3 text-black" />
                                                <h3 className="text-lg font-semibold">Save Time</h3>
                                            </div>
                                            <p className="text-gray-600">Use controlled bulk runs for a media library instead of drafting every description from scratch.</p>
                                        </Card>
                                        <Card className="p-6">
                                            <div className="flex items-center mb-3">
                                                <Brain className="h-6 w-6 mr-3 text-black" />
                                                <h3 className="text-lg font-semibold">Context-Aware Drafts</h3>
                                            </div>
                                            <p className="text-gray-600">Add optional page context, generate a draft, and review it before saving.</p>
                                        </Card>
                                    </div>

                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-black">Quick Start Guide</h2>
                                    <div className="bg-teal-50 border-l-4 border-teal-500 p-6 rounded-lg my-6">
                                        <p className="text-gray-700 mb-5">
                                            Use this path if you want the fastest first result: create the account, install the plugin, connect from WordPress, then generate one manual alt text before starting a bulk job.
                                        </p>
                                        <ol className="list-decimal list-inside space-y-3 text-gray-700">
                                            <li><strong>Create your free account</strong> and start with 150 signup credits. No credit card is required.</li>
                                            <li><strong>Install the WordPress plugin</strong> from WordPress.org or download version {PLUGIN_VERSION} from your dashboard.</li>
                                            <li><strong>Click Connect to Alt Text Pro</strong> inside WordPress so the plugin can save your API key automatically.</li>
                                            <li><strong>Generate one image alt text</strong> and review it before using bulk processing.</li>
                                        </ol>
                                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                            <Link
                                                href="/dashboard"
                                                className="inline-flex items-center justify-center rounded-xl bg-[#000000] px-5 py-3 text-sm font-semibold text-white hover:bg-[#000000] transition-colors"
                                            >
                                                Open Dashboard
                                            </Link>
                                            <a
                                                href={`/wordpress-plugin/alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                                className="inline-flex items-center justify-center rounded-xl border border-teal-200 bg-white px-5 py-3 text-sm font-semibold text-[#000000] hover:bg-teal-50 transition-colors"
                                                download={`alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                            >
                                                Download Plugin
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Installation Section */}
                            <section id="installation" className="mb-16 pt-8 border-t border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <Settings className="h-8 w-8 inline-block mr-3" />
                                    Installation & Setup
                                </h2>
                                <div className="prose max-w-none">
                                <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Step 1: Create Your Account</h3>
                                    <p className="text-gray-700 mb-4">
                                        Visit <a href="https://www.alt-text.pro" className="text-teal-600 hover:underline">www.alt-text.pro</a> and sign up for a free account. You'll receive 150 signup credits, plus 15 more every month - no credit card required.
                                    </p>
                                <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Step 2: Install WordPress Plugin</h3>
                                    <div className="bg-gray-50 p-6 rounded-lg my-4">
                                        <h4 className="font-semibold mb-3">Method 1: WordPress.org Directory</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                                            <li>In WordPress admin, go to <strong>Plugins -&gt; Add New</strong></li>
                                            <li>Search for <strong>Alt Text Pro</strong></li>
                                            <li>Click <strong>Install Now</strong>, then <strong>Activate</strong></li>
                                        </ol>
                                    </div>
                                    <div className="bg-gray-50 p-6 rounded-lg my-4">
                                        <h4 className="font-semibold mb-3">Method 2: Download from Dashboard</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                                            <li>Go to your dashboard and click <strong>Download Plugin</strong></li>
                                            <li>In WordPress admin, go to <strong>Plugins -&gt; Add New -&gt; Upload Plugin</strong></li>
                                            <li>Choose the downloaded zip file and click <strong>Install Now</strong></li>
                                            <li>Activate the plugin after installation</li>
                                        </ol>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Step 3: Connect Your Site</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                                        <li>In WordPress admin, go to <strong>Alt Text Pro</strong></li>
                                        <li>Click <strong>Connect to Alt Text Pro</strong></li>
                                        <li>Sign in or create your free account</li>
                                        <li>The plugin saves your API key automatically and returns you to WordPress</li>
                                    </ol>
                                    <div className="bg-gray-50 p-6 rounded-lg my-4">
                                        <h4 className="font-semibold mb-3">Manual API Key Fallback</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                                            <li>Log in to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="text-teal-600 hover:underline">alt-text.pro/dashboard</a></li>
                                            <li>Copy your API key from the API Key section</li>
                                            <li>Paste it into <strong>Alt Text Pro -&gt; Settings</strong> in WordPress</li>
                                            <li>Click <strong>Test Connection</strong> before running bulk processing</li>
                                        </ol>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Step 4: Configure the Plugin</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                                        <li>In WordPress admin, go to <strong>Alt Text Pro → Settings</strong></li>
                                        <li>Confirm the connection status is active</li>
                                        <li>Configure your preferences:
                                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                                <li><strong>Auto-generate:</strong> Enable to generate alt-text automatically when uploading images</li>
                                                <li><strong>Overwrite existing:</strong> Choose whether to replace existing alt-text</li>
                                                <li><strong>Context-aware:</strong> Include page context in generated drafts</li>
                                                <li><strong>Batch size:</strong> Set how many images to process at once (default: 1; maximum: 10)</li>
                                            </ul>
                                        </li>
                                        <li>Click <strong>Save Settings</strong></li>
                                    </ol>
                                    <div className="bg-notebook-teal/10 border-l-4 border-[#000000] p-4 rounded-lg my-4">
                                        <p className="text-[#000000]"><strong>Note:</strong> The plugin requires WordPress 5.0+ and PHP 7.4+.</p>
                                    </div>
                                </div>
                            </section>

                            {/* Features Section */}
                            <section id="features" className="mb-16 pt-8 border-t border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <Zap className="h-8 w-8 inline-block mr-3" />
                                    Features
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Card className="p-6">
                                        <Brain className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">AI-Powered Generation</h3>
                                        <p className="text-gray-600">Uses AI to suggest descriptive alt text from image content and optional page context. Review each result before publishing.</p>
                                    </Card>
                                    <Card className="p-6">
                                        <Upload className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">Automatic Processing</h3>
                                        <p className="text-gray-600">Generate an alt-text suggestion automatically when uploading images to WordPress.</p>
                                    </Card>
                                    <Card className="p-6">
                                        <RefreshCw className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">Bulk Processing</h3>
                                        <p className="text-gray-600">Work through existing media-library images in controlled batches.</p>
                                    </Card>
                                    <Card className="p-6">
                                        <Eye className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">Context-Aware</h3>
                                        <p className="text-gray-600">Uses page context and metadata as additional input for the generated draft.</p>
                                    </Card>
                                    <Card className="p-6">
                                        <TrendingUp className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">Usage Tracking</h3>
                                        <p className="text-gray-600">Monitor your API usage, credit consumption, and generation history with detailed logs.</p>
                                    </Card>
                                    <Card className="p-6">
                                        <PencilLine className="h-8 w-8 mb-4 text-black" />
                                        <h3 className="text-xl font-bold mb-3">Human Review</h3>
                                        <p className="text-gray-600">Edit or replace every generated suggestion in the WordPress media library.</p>
                                    </Card>
                                </div>
                            </section>

                            {/* WordPress Plugin Section */}
                            <section id="wordpress-plugin" className="mb-16 pt-8 border-t border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <Chrome className="h-8 w-8 inline-block mr-3" />
                                    WordPress Plugin Guide
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Dashboard Overview</h3>
                                    <p className="text-gray-700 mb-4">The Alt Text Pro dashboard shows account and usage information:</p>
                                    <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                                        <li><strong>Credits Remaining:</strong> See how many credits you have left</li>
                                        <li><strong>Usage Statistics:</strong> Track your total generations and credit balance</li>
                                        <li><strong>Connection Status:</strong> Verify your API connection is working</li>
                                        <li><strong>Recent Activity:</strong> View your latest alt-text generations</li>
                                        <li><strong>Quick Actions:</strong> Access bulk processing and settings quickly</li>
                                    </ul>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Settings Configuration</h3>
                                    <p className="text-gray-700 mb-4">Configure the plugin to work exactly how you need it:</p>
                                    <div className="bg-gray-50 p-6 rounded-lg my-4">
                                        <h4 className="font-semibold mb-3">Available Settings:</h4>
                                        <ul className="space-y-2 text-gray-700">
                                            <li><strong>API Key:</strong> Your unique API key for authentication</li>
                                            <li><strong>Auto-generate on Upload:</strong> Automatically generate alt-text when images are uploaded</li>
                                            <li><strong>Overwrite Existing Alt-Text:</strong> Replace existing alt-text when processing</li>
                                            <li><strong>Context-Aware Generation:</strong> Include page or post context in a generated draft</li>
                                            <li><strong>Batch Size:</strong> Number of images to process per batch (1-10)</li>
                                        </ul>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Bulk Processing Workflow</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                                        <li>Go to <strong>Alt Text Pro → Bulk Process</strong></li>
                                        <li>Choose your processing option:
                                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                                <li><strong>Process images missing alt-text:</strong> Only process images without alt-text</li>
                                                <li><strong>Process all images:</strong> Process all images (with overwrite option)</li>
                                                <li><strong>Process selected images:</strong> Choose specific images from media library</li>
                                            </ul>
                                        </li>
                                        <li>Use the saved batch size from Settings; lower values are more reliable on shared hosting</li>
                                        <li>Click <strong>Start Processing</strong> and monitor progress</li>
                                        <li>Review generated alt-text and edit as needed</li>
                                    </ol>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Best Practices</h3>
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
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <Code className="h-8 w-8 inline-block mr-3" />
                                    API Documentation
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Authentication</h3>
                                    <p className="text-gray-700 mb-4">All API requests require authentication using your API key. Include it in the <code className="bg-gray-200 px-2 py-1 rounded">Authorization</code> header:</p>
                                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto">
                                        <pre className="text-sm">Authorization: Bearer YOUR_API_KEY</pre>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Generate Alt-Text Endpoint</h3>
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
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Code Examples</h3>
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
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Error Codes</h3>
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
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <DollarSign className="h-8 w-8 inline-block mr-3" />
                                    Pricing & Credits
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Pricing Plans</h3>
                                    <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-6 my-6">
                                        {SUBSCRIPTION_PLANS.map((plan) => (
                                            <Card
                                                key={plan.id}
                                                className={`p-6 border-2 ${plan.featured ? 'border-[#000000]' : ''}`}
                                            >
                                                {plan.featured && (
                                                    <Badge className="mb-2 bg-black text-white">
                                                        Popular
                                                    </Badge>
                                                )}
                                                <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                                                <div className="text-3xl font-bold mb-4 text-black">
                                                    {plan.monthlyPrice}
                                                    <span className="text-sm text-gray-500">/mo</span>
                                                </div>
                                                <ul className="space-y-2 text-gray-700 mb-4">
                                                    <li className="flex items-start text-sm">
                                                        <Check className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-green-500" aria-hidden="true" />
                                                        {plan.credits}
                                                    </li>
                                                    {plan.features.map((feature) => (
                                                        <li key={feature} className="flex items-start text-sm">
                                                            <Check className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-green-500" aria-hidden="true" />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </Card>
                                        ))}
                                    </div>
                                    <p className="text-gray-700 mb-4">
                                        Annual billing is available at{' '}
                                        {SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'free')
                                            .map((plan) => `${plan.annualPrice}/year for ${plan.name}`)
                                            .join(', ')}{' '}
                                        — a 10% saving. The listed monthly credit allowance still renews monthly on subscription plans. One-time credit packs are available to paid subscribers only:{' '}
                                        {CREDIT_PACKS.map((pack) => `${pack.price} for ${pack.creditCount.toLocaleString()} credits`).join(' or ')}.
                                        Pack credits never expire and are only used up when you generate.
                                    </p>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Credit System</h3>
                                    <p className="text-gray-700 mb-4">Each alt-text generation consumes <strong>1 credit</strong>. Credits are used when:</p>
                                    <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                                        <li>Generating alt-text for a new image</li>
                                        <li>Regenerating alt-text for an existing image (if overwrite is enabled)</li>
                                        <li>Using the API to generate alt-text</li>
                                    </ul>
                                    <div className="bg-notebook-teal/10 border-l-4 border-[#000000] p-4 rounded-lg my-4">
                                        <p className="text-[#000000]"><strong>Note:</strong> Failed generations (due to errors) do not consume credits.</p>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Upgrading Your Plan</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
                                        <li>Go to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="text-teal-600 hover:underline">alt-text.pro/dashboard</a></li>
                                        <li>Click "Upgrade Plan" or visit the Pricing section</li>
                                        <li>Select your desired plan</li>
                                        <li>Complete payment via our secure checkout</li>
                                        <li>Your new credits will be available immediately</li>
                                    </ol>
                                </div>
                            </section>

                            {/* Troubleshooting Section */}
                            <section id="troubleshooting" className="mb-16 pt-8 border-t border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <Wrench className="h-8 w-8 inline-block mr-3" />
                                    Troubleshooting
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-black">Common Issues</h3>
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
                                                <li>Reduce the batch size (try 1-3 images per batch)</li>
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
                                    <h3 className="text-2xl font-bold mt-8 mb-4 text-black">Getting Help</h3>
                                    <p className="text-gray-700 mb-4">If you're still experiencing issues, we're here to help:</p>
                                    <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                                        <li>Email us at <a href="mailto:support@alt-text.pro" className="text-teal-600 hover:underline">support@alt-text.pro</a></li>
                                        <li>Use the <Link href="/contact" className="text-teal-600 hover:underline">contact form</Link> on our website</li>
                                        <li>Check your dashboard for usage logs and error details</li>
                                    </ul>
                                </div>
                            </section>

                            {/* FAQ Section */}
                            <section id="faq" className="mb-16 pt-8 border-t border-gray-200">
                                <h2 className="text-3xl font-bold mb-6 text-black">
                                    <HelpCircle className="h-8 w-8 inline-block mr-3" />
                                    Frequently Asked Questions
                                </h2>
                                <div className="space-y-6">
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Do I need an Alt Text Pro account?</h3><p className="text-gray-700">Yes, you need a free Alt Text Pro account to use the plugin or API. Sign up at <a href="https://www.alt-text.pro" className="text-teal-600 hover:underline">alt-text.pro</a> and get 150 free signup credits to start.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Should I review AI-generated alt text?</h3><p className="text-gray-700">Yes. AI output can miss important context or make mistakes. Treat each result as a suggestion and edit it to match the image's purpose on the page.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I edit the generated alt-text?</h3><p className="text-gray-700">Absolutely! The plugin generates alt-text as a starting point. You can always edit, refine, or completely rewrite the descriptions in WordPress media library.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">What happens if I run out of credits?</h3><p className="text-gray-700">If you run out of credits, the plugin will stop generating new alt-text. You can purchase more credits or upgrade your plan from your dashboard.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Does this work with existing images?</h3><p className="text-gray-700">Yes! The plugin includes a powerful bulk processing feature that can generate alt-text for all your existing images that don't have alt-text yet.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Is my data secure?</h3><p className="text-gray-700">Yes, we take security seriously. Images are processed securely via encrypted HTTPS connections and are not stored on our servers after processing.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">What image formats are supported?</h3><p className="text-gray-700">The plugin supports all standard web image formats including JPEG, PNG, GIF, and WebP.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I cancel my subscription anytime?</h3><p className="text-gray-700">Yes, you can cancel your subscription at any time from your Alt Text Pro dashboard. You'll continue to have access until the end of your billing period.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Does this help search engines understand images?</h3><p className="text-gray-700">Descriptive alt text can give search engines useful text context for an image. Search rankings depend on many factors, so no ranking outcome is guaranteed.</p></Card>
                                    <Card className="p-6"><h3 className="font-bold text-lg mb-2">Can I use the API without WordPress?</h3><p className="text-gray-700">Yes! Our API can be integrated into any application or website. Check the API Documentation section above for code examples.</p></Card>
                                </div>
                            </section>
                        </div>
                    </main>
                </div>
            </div>
            <Footer />
        </div>
    );
}
