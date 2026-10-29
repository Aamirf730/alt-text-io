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
import { buttonVariants } from '@/components/ui/button';
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
        <div className="min-h-screen bg-yellow-tint">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Table of Contents - Sidebar */}
                    <aside className="lg:w-64 flex-shrink-0">
                        <div className="sticky top-24 bg-white rounded-2xl border border-line shadow-notebook p-6 border border-line">
                            <h2 className="text-lg font-bold mb-4 text-ink flex items-center gap-2">
                                <Book className="h-5 w-5 shrink-0" aria-hidden="true" />
                                Documentation
                            </h2>
                            <nav className="space-y-2">
                                {DOC_SECTIONS.map((section) => {
                                    const Icon = section.icon;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => scrollToSection(section.id)}
                                            className={`w-full text-left px-3 h-10 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${activeSection === section.id
                                                ? 'bg-yellow-soft text-ink font-semibold'
                                                : 'text-ink hover:bg-yellow-tint'
                                                }`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            {section.title}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl border border-line shadow-notebook p-8 md:p-12">
                            {/* Getting Started Section */}
                            <section id="getting-started" className="mb-16">
                                <h1 className="text-4xl font-bold mb-4 text-ink">
                                    Getting Started with Alt Text Pro
                                </h1>
                                <p className="text-xl text-ink-muted mb-8">
                                    Set up the plugin, generate your first description, and learn how bulk runs, credits, and the API work.
                                </p>

                                <div className="prose max-w-none">
                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-ink">What is Alt Text Pro?</h2>
                                    <p className="text-ink mb-4">
                                        <strong>Alt Text Pro</strong> is a WordPress plugin backed by a web service. The plugin sends an image to the service, which uses Google Gemini to draft alt text and returns it to WordPress. You stay responsible for checking the result against the image and the page it appears on.
                                    </p>
                                    <p className="text-ink mb-4">
                                        For an overview, see{" "}
                                        <Link href="/ai-alt-text-generator-for-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">AI alt text for WordPress</Link>,{" "}
                                        <Link href="/bulk-generate-alt-text-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">bulk fixes for missing alt text</Link>, and{" "}
                                        <Link href="/woocommerce-product-image-alt-text" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">WooCommerce product images</Link>.
                                    </p>

                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-ink">Why Use Alt Text Pro?</h2>
                                    <div className="grid md:grid-cols-2 gap-6 my-6">
                                        <Card className="gap-0 p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Shield className="h-5 w-5 text-ink" aria-hidden="true" /></span>
                                                <h3 className="text-lg font-semibold">Accessibility Support</h3>
                                            </div>
                                            <p className="text-ink-muted">Give screen-reader users a description of each meaningful image. Review drafts before relying on them, because AI can be wrong.</p>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Search className="h-5 w-5 text-ink" aria-hidden="true" /></span>
                                                <h3 className="text-lg font-semibold">Search Context</h3>
                                            </div>
                                            <p className="text-ink-muted">Descriptive alt text gives search engines text about each image. It helps, but no tool can promise rankings.</p>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Zap className="h-5 w-5 text-ink" aria-hidden="true" /></span>
                                                <h3 className="text-lg font-semibold">Save Time</h3>
                                            </div>
                                            <p className="text-ink-muted">Run bulk processing across your media library instead of writing every description by hand.</p>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Brain className="h-5 w-5 text-ink" aria-hidden="true" /></span>
                                                <h3 className="text-lg font-semibold">Context-Aware Drafts</h3>
                                            </div>
                                            <p className="text-ink-muted">Add optional page context, generate a draft, and review it before saving.</p>
                                        </Card>
                                    </div>

                                    <h2 className="text-2xl font-bold mt-8 mb-4 text-ink">Quick Start Guide</h2>
                                    <div className="bg-yellow-tint border-l-4 border-brand-yellow p-6 rounded-xl my-6">
                                        <p className="text-ink mb-5">
                                            Use this path if you want the fastest first result: install the plugin, connect from WordPress, then generate one manual alt text before starting a bulk job.
                                        </p>
                                        <ol className="list-decimal list-inside space-y-3 text-ink">
                                            <li><strong>Install the WordPress plugin</strong> from WordPress.org or download version {PLUGIN_VERSION} from your dashboard.</li>
                                            <li><strong>Click Connect Account</strong> inside WordPress and sign in, or create a free account with 150 signup credits. No credit card is required. The plugin saves your API key automatically.</li>
                                            <li><strong>Generate one image alt text</strong> and review it before using bulk processing.</li>
                                        </ol>
                                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                            <Link
                                                href="/dashboard"
                                                className={buttonVariants()}
                                            >
                                                Open Dashboard
                                            </Link>
                                            <a
                                                href={`/wordpress-plugin/alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                                className={buttonVariants({ variant: "secondary" })}
                                                download={`alt-text-pro-plugin-${PLUGIN_VERSION}.zip`}
                                            >
                                                Download Plugin
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Installation Section */}
                            <section id="installation" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Settings className="h-6 w-6" aria-hidden="true" /></span>
                                    Installation & Setup
                                </h2>
                                <div className="prose max-w-none">
                                <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Step 1: Create Your Account</h3>
                                    <p className="text-ink mb-4">
                                        Visit <a href="https://www.alt-text.pro" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">www.alt-text.pro</a> and sign up for a free account, or skip this step and create the account when you click Connect Account in step 3. You'll receive 150 signup credits, plus 15 more every month - no credit card required.
                                    </p>
                                <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Step 2: Install WordPress Plugin</h3>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <h4 className="font-semibold mb-3">Method 1: WordPress.org Directory</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-ink">
                                            <li>In WordPress admin, go to <strong>Plugins -&gt; Add New</strong></li>
                                            <li>Search for <strong>Alt Text Pro</strong></li>
                                            <li>Click <strong>Install Now</strong>, then <strong>Activate</strong></li>
                                        </ol>
                                    </div>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <h4 className="font-semibold mb-3">Method 2: Download from Dashboard</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-ink">
                                            <li>Go to your dashboard and click <strong>Download Plugin</strong></li>
                                            <li>In WordPress admin, go to <strong>Plugins -&gt; Add New -&gt; Upload Plugin</strong></li>
                                            <li>Choose the downloaded zip file and click <strong>Install Now</strong></li>
                                            <li>Activate the plugin after installation</li>
                                        </ol>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Step 3: Connect Your Site</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-ink mb-4">
                                        <li>In WordPress admin, go to <strong>Alt Text Pro</strong>. The connect window opens on its own (or click <strong>Start onboarding</strong> on the Settings page)</li>
                                        <li>Click <strong>Connect Account</strong></li>
                                        <li>Sign in or create your free account</li>
                                        <li>The plugin saves your API key automatically and returns you to WordPress</li>
                                    </ol>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <h4 className="font-semibold mb-3">Manual API Key Fallback</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-ink">
                                            <li>Log in to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">alt-text.pro/dashboard</a></li>
                                            <li>Copy your API key from the API Key section</li>
                                            <li>Paste it into <strong>Alt Text Pro -&gt; Settings</strong> in WordPress</li>
                                            <li>Click <strong>Test</strong> next to the key before running bulk processing</li>
                                        </ol>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Step 4: Configure the Plugin</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-ink mb-4">
                                        <li>In WordPress admin, go to <strong>Alt Text Pro → Settings</strong></li>
                                        <li>Confirm the connection status is active</li>
                                        <li>Configure your preferences:
                                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                                <li><strong>Auto-generate on upload:</strong> Generate alt text automatically when you upload images (off by default)</li>
                                                <li><strong>Overwrite existing alt-text:</strong> Choose whether regenerating replaces alt text that is already there (off by default)</li>
                                                <li><strong>Alt text language:</strong> Follows your site language unless you choose another</li>
                                                <li><strong>Send image context:</strong> Send the titles of posts that use the image and its file name for more relevant drafts</li>
                                            </ul>
                                        </li>
                                        <li>Click <strong>Save Settings</strong></li>
                                    </ol>
                                    <div className="bg-yellow-tint border-l-4 border-brand-yellow p-4 rounded-xl my-4">
                                        <p className="text-ink"><strong>Note:</strong> The plugin requires WordPress 5.0+ and PHP 7.4+.</p>
                                    </div>
                                </div>
                            </section>

                            {/* Features Section */}
                            <section id="features" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Zap className="h-6 w-6" aria-hidden="true" /></span>
                                    Features
                                </h2>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Card className="gap-0 p-6">
                                        <Brain className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">AI-Powered Generation</h3>
                                        <p className="text-ink-muted">Uses AI to suggest descriptive alt text from image content and optional page context. Review each result before publishing.</p>
                                    </Card>
                                    <Card className="gap-0 p-6">
                                        <Upload className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">Automatic Processing</h3>
                                        <p className="text-ink-muted">Generate an alt-text suggestion automatically when uploading images to WordPress.</p>
                                    </Card>
                                    <Card className="gap-0 p-6">
                                        <RefreshCw className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">Bulk Processing</h3>
                                        <p className="text-ink-muted">Work through existing media-library images one at a time, and stop after the current image whenever you like.</p>
                                    </Card>
                                    <Card className="gap-0 p-6">
                                        <Eye className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">Context-Aware</h3>
                                        <p className="text-ink-muted">Uses page context and metadata as additional input for the generated draft.</p>
                                    </Card>
                                    <Card className="gap-0 p-6">
                                        <TrendingUp className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">Usage Tracking</h3>
                                        <p className="text-ink-muted">See credit use and a log of every generated description, with CSV export from the Logs page.</p>
                                    </Card>
                                    <Card className="gap-0 p-6">
                                        <PencilLine className="h-8 w-8 mb-4 text-ink" />
                                        <h3 className="text-xl font-bold mb-3">Human Review</h3>
                                        <p className="text-ink-muted">Edit or replace every generated suggestion in the WordPress media library.</p>
                                    </Card>
                                </div>
                            </section>

                            {/* WordPress Plugin Section */}
                            <section id="wordpress-plugin" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Chrome className="h-6 w-6" aria-hidden="true" /></span>
                                    WordPress Plugin Guide
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Dashboard Overview</h3>
                                    <p className="text-ink mb-4">The Alt Text Pro dashboard shows account and usage information:</p>
                                    <ul className="list-disc list-inside space-y-2 text-ink mb-4">
                                        <li><strong>Credits Remaining:</strong> See how many credits you have left</li>
                                        <li><strong>Usage Statistics:</strong> Track your total generations and credit balance</li>
                                        <li><strong>Connection Status:</strong> Verify your API connection is working</li>
                                        <li><strong>Recent Activity:</strong> View your latest alt-text generations</li>
                                        <li><strong>Quick Actions:</strong> Access bulk processing and settings quickly</li>
                                    </ul>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Settings Configuration</h3>
                                    <p className="text-ink mb-4">Configure the plugin to work exactly how you need it:</p>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <h4 className="font-semibold mb-3">Available Settings:</h4>
                                        <ul className="space-y-2 text-ink">
                                            <li><strong>API Key:</strong> Your unique API key for authentication. Use <strong>Test</strong> to check it, or <strong>Disconnect account</strong> to remove it from this site</li>
                                            <li><strong>Auto-generate on upload:</strong> Generate alt text automatically when images are uploaded</li>
                                            <li><strong>Overwrite existing alt-text:</strong> Replace existing alt text when regenerating. When off, bulk runs skip images that already have alt text</li>
                                            <li><strong>Fill empty alt text in post content:</strong> Images inside posts with empty alt text are shown with their Media Library alt text. Alt text written in the post is never overwritten</li>
                                            <li><strong>Alt text language:</strong> The language drafts are written in. Follows the site language by default</li>
                                            <li><strong>Email me when a bulk run finishes:</strong> Your site sends a short summary when a run finishes or stops</li>
                                            <li><strong>Show context field on images:</strong> Adds a context box to each image&apos;s edit page</li>
                                            <li><strong>Send image context:</strong> Sends the titles of posts that use the image and its file name with each request</li>
                                            <li><strong>Blog context:</strong> A short description of your site, sent with every request</li>
                                        </ul>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Bulk Processing Workflow</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-ink mb-4">
                                        <li>Go to <strong>Alt Text Pro → Bulk Process</strong></li>
                                        <li>Choose your processing option:
                                            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                                <li><strong>Process images missing alt-text:</strong> Only process images without alt-text</li>
                                                <li><strong>Process all images:</strong> Process all images (with overwrite option)</li>
                                                <li><strong>Process selected images:</strong> Choose specific images from media library</li>
                                            </ul>
                                        </li>
                                        <li>One run covers up to your newest 20,000 images; start another run to continue with older images</li>
                                        <li>Click <strong>Start Processing</strong> and monitor progress. Choose <strong>Stop after current image</strong> to end the run early</li>
                                        <li>Review generated alt-text and edit as needed</li>
                                    </ol>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Best Practices</h3>
                                    <div className="bg-yellow-tint border-l-4 border-brand-yellow p-6 rounded-xl my-4">
                                        <ul className="space-y-2 text-ink">
                                            <li>✓ Review generated alt-text for accuracy, especially for complex images</li>
                                            <li>✓ Add context when processing product images or specialized content</li>
                                            <li>✓ Start large bulk runs when you can leave the Bulk page open</li>
                                            <li>✓ Monitor your credit usage to avoid running out mid-process</li>
                                            <li>✓ Keep your API key secure and never share it publicly</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* API Documentation Section */}
                            <section id="api" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Code className="h-6 w-6" aria-hidden="true" /></span>
                                    API Documentation
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Authentication</h3>
                                    <p className="text-ink mb-4">All API requests require authentication using your API key. Include it in the <code className="bg-yellow-soft px-2 py-1 rounded">Authorization</code> header:</p>
                                    <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl my-4 overflow-x-auto">
                                        <pre className="text-sm">Authorization: Bearer YOUR_API_KEY</pre>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Generate Alt-Text Endpoint</h3>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <p className="font-mono text-sm mb-2"><strong>POST</strong> <code className="text-ink">/.netlify/functions/generate-alt-text</code></p>
                                        <p className="text-ink mb-4">Generates alt-text for an image using AI.</p>
                                        <h4 className="font-semibold mt-4 mb-2">Request Body:</h4>
                                        <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl my-2 overflow-x-auto">
                                            <pre className="text-sm">{`{\n  "image_base64": "base64_encoded_image_string",\n  "context": "optional context description"\n}`}</pre>
                                        </div>
                                        <h4 className="font-semibold mt-4 mb-2">Response (Success):</h4>
                                        <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl my-2 overflow-x-auto">
                                            <pre className="text-sm">{`{\n  "alt_text": "A beautiful sunset over mountains",\n  "credits_remaining": 95\n}`}</pre>
                                        </div>
                                        <h4 className="font-semibold mt-4 mb-2">Response (Error):</h4>
                                        <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl my-2 overflow-x-auto">
                                            <pre className="text-sm">{`{\n  "code": "no_credits",\n  "error": "No monthly credits remaining. Please upgrade, top up, or wait for your next credit refill."\n}`}</pre>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Code Examples</h3>
                                    <div className="my-6">
                                        <h4 className="font-semibold mb-2">JavaScript (Fetch API)</h4>
                                        <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl overflow-x-auto">
                                            <pre className="text-sm">{`const response = await fetch('https://www.alt-text.pro/.netlify/functions/generate-alt-text', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer YOUR_API_KEY'\n  },\n  body: JSON.stringify({\n    image_base64: base64Image,\n    context: 'Product photo'\n  })\n});\n\nconst data = await response.json();\nconsole.log(data.alt_text);`}</pre>
                                        </div>
                                    </div>
                                    <div className="my-6">
                                        <h4 className="font-semibold mb-2">cURL</h4>
                                        <div className="border border-line bg-yellow-tint text-ink font-mono text-sm p-4 rounded-xl overflow-x-auto">
                                            <pre className="text-sm">{`curl -X POST https://www.alt-text.pro/.netlify/functions/generate-alt-text \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{\n    "image_base64": "base64_encoded_image",\n    "context": "Landscape photo"\n  }'`}</pre>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Error Codes</h3>
                                    <div className="bg-yellow-tint p-6 rounded-xl my-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2">Status Code</th>
                                                    <th className="text-left py-2">Error</th>
                                                    <th className="text-left py-2">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-ink">
                                                <tr className="border-b"><td className="py-2">401</td><td className="py-2">Unauthorized</td><td className="py-2">Invalid or missing API key</td></tr>
                                                <tr className="border-b"><td className="py-2">402</td><td className="py-2">Payment Required</td><td className="py-2">No credits remaining (code <code>no_credits</code>)</td></tr>
                                                <tr className="border-b"><td className="py-2">400</td><td className="py-2">Bad Request</td><td className="py-2">Invalid image format or missing parameters</td></tr>
                                                <tr className="border-b"><td className="py-2">500</td><td className="py-2">Server Error</td><td className="py-2">Internal server error</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </section>

                            {/* Pricing Section */}
                            <section id="pricing" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><DollarSign className="h-6 w-6" aria-hidden="true" /></span>
                                    Pricing & Credits
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Pricing Plans</h3>
                                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 my-6">
                                        {SUBSCRIPTION_PLANS.map((plan) => (
                                            <Card
                                                key={plan.id}
                                                className={`h-full gap-0 p-6 ${plan.featured ? 'border-2 border-brand-yellow' : ''}`}
                                            >
                                                <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                                                    <h4 className="text-xl font-bold">{plan.name}</h4>
                                                    {plan.featured && (
                                                        <Badge className="bg-brand-yellow text-ink">
                                                            Recommended
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-3xl font-bold mb-4 text-ink">
                                                    {plan.monthlyPrice}
                                                    <span className="text-sm text-ink-muted">/mo</span>
                                                </div>
                                                <ul className="space-y-2 text-ink mb-4">
                                                    <li className="flex items-start gap-2 text-sm leading-5">
                                                        <span className="flex h-5 shrink-0 items-center"><Check className="h-4 w-4 text-ink" aria-hidden="true" /></span>
                                                        {plan.credits}
                                                    </li>
                                                    {plan.features.map((feature) => (
                                                        <li key={feature} className="flex items-start gap-2 text-sm leading-5">
                                                            <span className="flex h-5 shrink-0 items-center"><Check className="h-4 w-4 text-ink" aria-hidden="true" /></span>
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </Card>
                                        ))}
                                    </div>
                                    <p className="text-ink mb-4">
                                        Annual billing is available at{' '}
                                        {SUBSCRIPTION_PLANS.filter((plan) => plan.id !== 'free')
                                            .map((plan) => `${plan.annualPrice}/year for ${plan.name}`)
                                            .join(', ')}{' '}
                                        — two months free compared with monthly billing. The listed monthly credit allowance still renews monthly on subscription plans. One-time credit packs are available on every plan, including Free:{' '}
                                        {CREDIT_PACKS.map((pack) => `${pack.price} for ${pack.creditCount.toLocaleString()} credits`).join(', ')}.
                                        Pack credits never expire and are only used up when you generate.
                                    </p>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Credit System</h3>
                                    <p className="text-ink mb-4">Each alt-text generation consumes <strong>1 credit</strong>. Credits are used when:</p>
                                    <ul className="list-disc list-inside space-y-2 text-ink mb-4">
                                        <li>Generating alt-text for a new image</li>
                                        <li>Regenerating alt-text for an existing image (if overwrite is enabled)</li>
                                        <li>Using the API to generate alt-text</li>
                                    </ul>
                                    <div className="bg-yellow-tint border-l-4 border-brand-yellow p-4 rounded-xl my-4">
                                        <p className="text-ink"><strong>Note:</strong> Failed generations (due to errors) do not consume credits.</p>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Upgrading Your Plan</h3>
                                    <ol className="list-decimal list-inside space-y-2 text-ink mb-4">
                                        <li>Go to your dashboard at <a href="https://www.alt-text.pro/dashboard" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">alt-text.pro/dashboard</a></li>
                                        <li>Click "Upgrade Plan" or visit the Pricing section</li>
                                        <li>Select your desired plan</li>
                                        <li>Complete payment via our secure checkout</li>
                                        <li>Your new credits will be available immediately</li>
                                    </ol>
                                </div>
                            </section>

                            {/* Troubleshooting Section */}
                            <section id="troubleshooting" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><Wrench className="h-6 w-6" aria-hidden="true" /></span>
                                    Troubleshooting
                                </h2>
                                <div className="prose max-w-none">
                                    <h3 className="text-2xl font-bold mt-6 mb-4 text-ink">Common Issues</h3>
                                    <div className="space-y-6">
                                        <Card className="gap-0 p-6">
                                            <h4 className="font-bold text-lg mb-2">The plugin cannot connect or says the API key is invalid</h4>
                                            <p className="text-ink mb-2"><strong>Solution:</strong></p>
                                            <ul className="list-disc list-inside space-y-1 text-ink">
                                                <li>In Alt Text Pro → Settings, click <strong>Disconnect account</strong>, then <strong>Start onboarding</strong> and <strong>Connect Account</strong> again, or paste the key from your dashboard</li>
                                                <li>Click &quot;Test&quot; next to the key to check the connection</li>
                                                <li>Check your internet connection</li>
                                                <li>Ensure your API key hasn't been revoked</li>
                                            </ul>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <h4 className="font-bold text-lg mb-2">&quot;No credits remaining&quot; message</h4>
                                            <p className="text-ink mb-2"><strong>Solution:</strong></p>
                                            <ul className="list-disc list-inside space-y-1 text-ink">
                                                <li>Check your credit balance in the dashboard</li>
                                                <li>Upgrade your plan or purchase additional credits</li>
                                                <li>Wait for monthly credit renewal (for subscription plans)</li>
                                            </ul>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <h4 className="font-bold text-lg mb-2">Bulk Processing Stops or Fails</h4>
                                            <p className="text-ink mb-2"><strong>Solution:</strong></p>
                                            <ul className="list-disc list-inside space-y-1 text-ink">
                                                <li>Try a small run with <strong>Process selected images</strong> first</li>
                                                <li>Check your credit balance before starting</li>
                                                <li>Ensure your server has sufficient resources</li>
                                                <li>Process during off-peak hours for better performance</li>
                                            </ul>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <h4 className="font-bold text-lg mb-2">Images Not Processing Automatically</h4>
                                            <p className="text-ink mb-2"><strong>Solution:</strong></p>
                                            <ul className="list-disc list-inside space-y-1 text-ink">
                                                <li>Verify "Auto-generate on Upload" is enabled in Settings</li>
                                                <li>Check that you have sufficient credits</li>
                                                <li>Ensure your API key is valid</li>
                                                <li>Check WordPress error logs for details</li>
                                            </ul>
                                        </Card>
                                        <Card className="gap-0 p-6">
                                            <h4 className="font-bold text-lg mb-2">Plugin Conflicts</h4>
                                            <p className="text-ink mb-2"><strong>Solution:</strong></p>
                                            <ul className="list-disc list-inside space-y-1 text-ink">
                                                <li>Deactivate other plugins temporarily to identify conflicts</li>
                                                <li>Update WordPress and all plugins to latest versions</li>
                                                <li>Check PHP version (requires 7.4+)</li>
                                                <li>Contact support with plugin conflict details</li>
                                            </ul>
                                        </Card>
                                    </div>
                                    <h3 className="text-2xl font-bold mt-8 mb-4 text-ink">Getting Help</h3>
                                    <p className="text-ink mb-4">If you're still experiencing issues, we're here to help:</p>
                                    <ul className="list-disc list-inside space-y-2 text-ink mb-4">
                                        <li>Email us at <a href="mailto:help@alt-text.pro" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">help@alt-text.pro</a></li>
                                        <li>Use the <Link href="/contact" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">contact form</Link> on our website</li>
                                        <li>Check your dashboard for usage logs and error details</li>
                                    </ul>
                                </div>
                            </section>

                            {/* FAQ Section */}
                            <section id="faq" className="mb-16 pt-8 border-t border-line">
                                <h2 className="text-3xl font-bold mb-6 text-ink flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-soft"><HelpCircle className="h-6 w-6" aria-hidden="true" /></span>
                                    Frequently Asked Questions
                                </h2>
                                <div className="space-y-6">
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Do I need an Alt Text Pro account?</h3><p className="text-ink">Yes, you need a free Alt Text Pro account to use the plugin or API. Sign up at <a href="https://www.alt-text.pro" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">alt-text.pro</a> and get 150 free signup credits to start.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Should I review AI-generated alt text?</h3><p className="text-ink">Yes. AI output can miss important context or make mistakes. Treat each result as a suggestion and edit it to match the image's purpose on the page.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Can I edit the generated alt-text?</h3><p className="text-ink">Yes. The plugin generates alt text as a starting point. You can edit, refine, or rewrite any description in the WordPress media library.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">What happens if I run out of credits?</h3><p className="text-ink">If you run out of credits, the plugin will stop generating new alt-text. You can purchase more credits or upgrade your plan from your dashboard.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Does this work with existing images?</h3><p className="text-ink">Yes. Bulk processing fills in alt text for existing images that have none, up to your newest 20,000 images per run.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Is my data secure?</h3><p className="text-ink">Images are sent over HTTPS to Alt Text Pro, passed to Google Gemini to write the description, and not stored by Alt Text Pro afterwards. Your API key is stored encrypted in WordPress. See the <Link href="/privacy" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">privacy policy</Link> for details.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">What image formats are supported?</h3><p className="text-ink">JPEG, PNG, GIF, WebP and AVIF, and HEIC when your server&apos;s image editor can read it. SVG and other vector files are skipped.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Can I cancel my subscription anytime?</h3><p className="text-ink">Yes, you can cancel your subscription at any time from your Alt Text Pro dashboard. You'll continue to have access until the end of your billing period.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Does this help search engines understand images?</h3><p className="text-ink">Descriptive alt text can give search engines useful text context for an image. Search rankings depend on many factors, so no ranking outcome is guaranteed.</p></Card>
                                    <Card className="gap-0 p-6"><h3 className="font-bold text-lg mb-2">Can I use the API without WordPress?</h3><p className="text-ink">Yes. You can call the API from any application or website. See the API Documentation section above for code examples.</p></Card>
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
