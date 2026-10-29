"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelled() {
    const router = useRouter();

    return (
        <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
            <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8">
                <Image
                    src="/logo-alt-text-pro.png"
                    alt="Alt Text Pro"
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16"
                />
                <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-soft text-ink" aria-hidden="true">
                    <X className="h-8 w-8" />
                </div>
                <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight text-ink">Checkout cancelled</h1>
                <p className="mt-3 leading-7 text-ink-muted">
                    Nothing was charged, and your plan and credits are unchanged. You can come back to it anytime.
                </p>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                    Had a problem paying? Write to{" "}
                    <a href="mailto:help@alt-text.pro" className="font-semibold text-ink underline underline-offset-2">help@alt-text.pro</a>{" "}
                    and we will help.
                </p>
                <div className="mt-8 grid gap-3">
                    <Button onClick={() => router.push('/dashboard')} className="w-full">
                        Go to Dashboard
                    </Button>
                    <Button onClick={() => router.push('/#pricing')} variant="secondary" className="w-full">
                        See plans and credit packs
                    </Button>
                </div>
            </div>
        </main>
    );
}
