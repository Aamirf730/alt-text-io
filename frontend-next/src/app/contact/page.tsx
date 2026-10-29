"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Loader2 } from 'lucide-react';
import { getApiBase } from '@/lib/utils';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
        website: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const url = `${getApiBase()}/send-contact-email`;

            const response = await fetch(url, {
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
                    message: '',
                    website: '',
                });
            } else {
                const errorMsg = data.details || data.error || 'Failed to send message';
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('Contact form submission failed');
            toast.error(error.message || 'Failed to send message. Please try again later.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-yellow-tint">
            <Navbar />

            {/* Contact Form Section */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl border border-line shadow-notebook p-8 md:p-12">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold mb-4 text-ink">
                            Get in Touch
                        </h1>
                        <p className="text-lg text-ink-muted max-w-2xl mx-auto">
                            Have a question or need help? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
                        </p>
                        <p className="mt-3 text-base text-ink-muted">
                            Prefer email? Write to{' '}
                            <a href="mailto:help@alt-text.pro" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">help@alt-text.pro</a>.
                        </p>
                    </div>

                    {/* Contact Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                            <label htmlFor="website">Website</label>
                            <Input
                                id="website"
                                name="website"
                                type="text"
                                value={formData.website}
                                onChange={handleChange}
                                autoComplete="off"
                                tabIndex={-1}
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Name Field */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-ink mb-2">
                                    Name <span className="text-error" aria-hidden="true">*</span>
                                </label>
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                    className="w-full"
                                />
                            </div>
                            {/* Email Field */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-ink mb-2">
                                    Email <span className="text-error" aria-hidden="true">*</span>
                                </label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="your@email.com"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Subject Field */}
                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-ink mb-2">
                                Subject <span className="text-error" aria-hidden="true">*</span>
                            </label>
                            <Input
                                id="subject"
                                name="subject"
                                type="text"
                                required
                                autoComplete="off"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="How can we help?"
                                className="w-full"
                            />
                        </div>

                        {/* Message Field */}
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-ink mb-2">
                                Message <span className="text-error" aria-hidden="true">*</span>
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                required
                                rows={6}
                                value={formData.message}
                                onChange={handleChange}
                                placeholder="Tell us more about your inquiry..."
                                className="w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-base text-ink placeholder:text-ink-muted focus-visible:border-yellow-strong disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-center">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full md:w-auto"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" aria-hidden="true" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail aria-hidden="true" />
                                        Send Message
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </main>
            <Footer />
        </div>
    );
}
