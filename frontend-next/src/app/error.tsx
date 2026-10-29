"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-yellow-tint px-4 py-12 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-8">
        <Image
          src="/logo-alt-text-pro.png"
          alt="Alt Text Pro"
          width={64}
          height={64}
          className="mx-auto h-16 w-16"
        />
        <span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-warning" aria-hidden="true">
          <AlertTriangle className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-outfit text-2xl font-semibold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p role="alert" className="mt-3 leading-7 text-ink-muted">
          This page hit an unexpected problem. Your account and credits are safe. Try again, or contact
          support if it keeps happening.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-8 grid gap-3">
          <Button type="button" onClick={() => retry()} className="w-full">
            <RefreshCw />
            Try again
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
            <Home />
            Go to homepage
          </Link>
          <Link href="/contact" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
            Contact support
          </Link>
        </div>
      </section>
    </main>
  );
}
