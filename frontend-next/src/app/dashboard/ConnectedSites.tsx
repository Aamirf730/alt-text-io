"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { Globe, RefreshCw } from "lucide-react";

import { getAccessToken } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatSiteUrl } from "./dashboard-helpers";

export type ConnectedSite = {
    site_url: string;
    plugin_version: string | null;
    wp_locale: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    disconnected_at: string | null;
};

type LoadState = "loading" | "ready" | "unavailable" | "error";

export default function ConnectedSites() {
    const [sites, setSites] = useState<ConnectedSite[]>([]);
    const [state, setState] = useState<LoadState>("loading");

    const lastLoadRef = useRef(0);

    // quiet: refresh in place without the loading message.
    const loadSites = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
        lastLoadRef.current = Date.now();
        if (!quiet) setState("loading");
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                setState("error");
                return;
            }

            const response = await fetch(`${getApiBase()}/get-connected-sites`, {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            // The endpoint may not be deployed yet; hide the list quietly.
            if (response.status === 404) {
                setState("unavailable");
                return;
            }

            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.success || !Array.isArray(data.sites)) {
                if (!quiet) setState("error");
                return;
            }

            setSites(data.sites as ConnectedSite[]);
            setState("ready");
        } catch (error) {
            console.warn("Connected sites unavailable:", error);
            if (!quiet) setState("error");
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => void loadSites(), 0);
        return () => window.clearTimeout(timer);
    }, [loadSites]);

    // A site connected in another tab shows up when the person comes back.
    useEffect(() => {
        const refreshOnReturn = () => {
            if (document.visibilityState !== "visible") return;
            if (Date.now() - lastLoadRef.current < 10_000) return;
            void loadSites({ quiet: true });
        };
        document.addEventListener("visibilitychange", refreshOnReturn);
        window.addEventListener("focus", refreshOnReturn);
        return () => {
            document.removeEventListener("visibilitychange", refreshOnReturn);
            window.removeEventListener("focus", refreshOnReturn);
        };
    }, [loadSites]);

    return (
        <section aria-labelledby="sites-heading" className="rounded-2xl border border-line bg-white p-5 shadow-notebook sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-soft">
                        <NextImage src="/logos/wordpress.svg" alt="" aria-hidden width={24} height={24} className="h-6 w-6" />
                    </span>
                    <div>
                        <h2 id="sites-heading" className="font-lato text-xl font-semibold text-ink">Connected sites</h2>
                        <p className="mt-1 text-sm text-ink-muted">WordPress sites that use your API key.</p>
                    </div>
                </div>
                {state !== "loading" && state !== "unavailable" && (
                    <button type="button" onClick={() => void loadSites()} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Refresh connected sites">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="mt-5" aria-live="polite">
                {state === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Loading sites…
                    </p>
                ) : state === "unavailable" ? (
                    <p className="text-sm leading-6 text-ink-muted">
                        The list of connected sites isn&apos;t available yet. Your plugin connection is not affected.
                    </p>
                ) : state === "error" ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                        <span>We couldn&apos;t load your connected sites.</span>
                        <button type="button" onClick={() => void loadSites()} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                            Try again
                        </button>
                    </div>
                ) : sites.length === 0 ? (
                    <p className="text-sm leading-6 text-ink-muted">
                        No sites yet. Connect the plugin from <strong>Alt Text Pro</strong> in your WordPress admin and the site appears here.
                    </p>
                ) : (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                        {sites.map((site) => {
                            const isDisconnected = Boolean(site.disconnected_at);
                            return (
                                <li key={site.site_url} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                                            <Globe className="h-4 w-4 shrink-0" aria-hidden />
                                            <span className="truncate">{formatSiteUrl(site.site_url)}</span>
                                        </p>
                                        <p className="mt-1 text-xs text-ink-muted">
                                            Last seen {formatRelativeTime(site.last_seen_at)}
                                            {site.plugin_version ? ` · Plugin v${site.plugin_version}` : ""}
                                            {site.wp_locale ? ` · ${site.wp_locale}` : ""}
                                        </p>
                                    </div>
                                    <span
                                        className={cn(
                                            "inline-flex w-fit shrink-0 items-center rounded-lg border px-2.5 py-1 text-xs font-semibold",
                                            isDisconnected
                                                ? "border-amber-200 bg-amber-50 text-warning"
                                                : "border-green-200 bg-green-50 text-success",
                                        )}
                                    >
                                        {isDisconnected ? "Disconnected" : "Connected"}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            {state === "ready" && sites.length > 0 && (
                <p className="mt-4 text-xs leading-5 text-ink-muted">
                    To disconnect one site, open Alt Text Pro, then Settings, in that site&apos;s WordPress admin and click
                    Disconnect account. All your sites share one API key, so rotating the key in API settings disconnects
                    every site at once.
                </p>
            )}
        </section>
    );
}
