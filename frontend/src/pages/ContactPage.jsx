import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Mail } from 'lucide-react';

const ContactPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [user, setUser] = useState(null);
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

export default ContactPage;
