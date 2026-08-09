"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelled() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white">
            <div className="text-center max-w-md mx-auto p-6">
                <X className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Cancelled</h2>
                <p className="text-gray-600 mb-6">Your payment was cancelled. You can try again anytime.</p>
                <Button onClick={() => router.push('/dashboard')} className="bg-teal-600 hover:bg-teal-700">
                    Go to Dashboard
                </Button>
            </div>
        </div>
    );
}
