"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, Copy, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    getHistoryPageRange,
    getHistoryPageSummary,
    hasNextHistoryPage,
    HISTORY_PAGE_SIZE,
} from "./dashboard-helpers";

type HistoryRow = {
    id: string;
    alt: string;
    context: string | null;
    date: string;
};

type GenerationHistoryProps = {
    userId: string;
    /** Changes after a new generation so the list returns to page 1. */
    refreshKey: number;
};

export default function GenerationHistory({ userId, refreshKey }: GenerationHistoryProps) {
    const [page, setPage] = useState(0);
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [total, setTotal] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPage = useCallback(async (pageToLoad: number) => {
        setIsLoading(true);
        setError(null);
        const [from, to] = getHistoryPageRange(pageToLoad);
        try {
            const { data, error: queryError, count } = await supabase
                .from("usage_logs")
                .select("id, alt_text_generated, image_context, created_at", { count: "exact" })
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (queryError) throw queryError;

            setRows((data || []).map((item: any) => ({
                id: item.id,
                alt: item.alt_text_generated || "Alt text unavailable",
                context: item.image_context || null,
                date: item.created_at,
            })));
            setTotal(typeof count === "number" ? count : null);
        } catch (loadError) {
            console.error("Error loading generation history:", loadError);
            setError("We couldn't load your generation history.");
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPage(0);
            void loadPage(0);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadPage, refreshKey]);

    const goToPage = (nextPage: number) => {
        setPage(nextPage);
        void loadPage(nextPage);
    };

    const canGoNext = hasNextHistoryPage(page, rows.length, total);

    return (
        <section id="history" aria-labelledby="history-heading" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-notebook">
            <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow">
                        <History className="h-5 w-5 text-ink" />
                    </span>
                    <div>
                        <h2 id="history-heading" className="font-lato text-xl font-semibold text-ink">Generation history</h2>
                        <p className="mt-1 text-sm text-ink-muted">Every alt text generated with your account, newest first.</p>
                    </div>
                </div>
                <p className="text-xs font-semibold text-ink-muted" aria-live="polite">
                    {!isLoading && !error ? getHistoryPageSummary(page, rows.length, total) : null}
                </p>
            </div>

            <div aria-live="polite" aria-busy={isLoading}>
                {isLoading ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-ink" />
                        <p className="mt-3 text-sm text-ink-muted">Loading history…</p>
                    </div>
                ) : error ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-ink">{error}</p>
                        <button type="button" onClick={() => void loadPage(page)} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}>
                            <RefreshCw className="h-4 w-4" /> Try again
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-ink">No generations yet</p>
                        <p className="mt-1 text-sm text-ink-muted">Alt text you generate in WordPress or here appears in this list.</p>
                    </div>
                ) : (
                    <ol className="divide-y divide-line">
                        {rows.map((item) => (
                            <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_40px] items-start gap-3 px-5 py-4 hover:bg-yellow-tint sm:grid-cols-[minmax(0,1fr)_150px_40px] sm:items-center sm:px-6">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-6 text-ink">{item.alt}</p>
                                    <p className="mt-1 flex items-center gap-2 truncate text-xs text-ink-muted">
                                        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                                        {item.context || "WordPress media"}
                                    </p>
                                </div>
                                <time className="col-start-1 text-xs text-ink-muted sm:col-start-auto" dateTime={item.date}>
                                    {new Date(item.date).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                </time>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(item.alt)
                                            .then(() => toast.success("Copied to clipboard"))
                                            .catch(() => toast.error("Copy was blocked by your browser."));
                                    }}
                                    className={cn(buttonVariants({ variant: "secondary", size: "icon-sm" }), "col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto")}
                                    aria-label="Copy generated alt text"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <nav className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6" aria-label="Generation history pages">
                <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={isLoading || page === 0}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                    <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <span className="text-xs text-ink-muted">Page {page + 1}{typeof total === "number" && total > 0 ? ` of ${Math.ceil(total / HISTORY_PAGE_SIZE)}` : ""}</span>
                <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={isLoading || !canGoNext}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                    Next <ChevronRight className="h-4 w-4" />
                </button>
            </nav>
        </section>
    );
}
