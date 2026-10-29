import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Book, Home, SearchX } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found | Alt Text Pro",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-yellow-tint text-ink">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-16 sm:py-24">
        <section className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 text-center shadow-notebook sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-soft text-ink" aria-hidden="true">
            <SearchX className="h-8 w-8" />
          </span>
          <p className="label-caps mt-6">Error 404</p>
          <h1 className="mt-2 font-outfit text-3xl font-semibold tracking-tight sm:text-4xl">
            We can&apos;t find that page
          </h1>
          <p className="mt-4 leading-7 text-ink-muted">
            The link may be out of date, or the page has moved. These will get you back on track.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/" className={cn(buttonVariants(), "w-full")}>
              <Home />
              Go to homepage
            </Link>
            <Link href="/docs" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
              <Book />
              Read the docs
            </Link>
          </div>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "mt-3 w-full")}>
            Open your dashboard
            <ArrowRight />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
