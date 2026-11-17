"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Download,
  ImageOff,
  Info,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getApiBase } from "@/lib/utils";
import { trackMarketingEvent } from "@/lib/analytics";

type Status =
  | "missing"
  | "empty"
  | "filename"
  | "generic"
  | "redundant_prefix"
  | "too_long"
  | "duplicate"
  | "ok";

type CheckedImage = {
  index: number;
  tag: "img" | "input" | "area";
  src: string | null;
  alt: string | null;
  inLink: boolean;
  status: Status;
  severity: "error" | "review" | "ok";
  reason: string;
};

type CheckResult = {
  checkedUrl: string;
  finalUrl: string;
  htmlTruncated: boolean;
  isWordPress: boolean;
  truncated: boolean;
  totals: {
    images: number;
    missing: number;
    empty: number;
    needsReview: number;
    ok: number;
    ignored: number;
  };
  images: CheckedImage[];
};

type Filter = "problems" | "missing" | "review" | "empty" | "all";

const STATUS_LABEL: Record<Status, string> = {
  missing: "Missing alt",
  empty: "Empty alt",
  filename: "File name",
  generic: "Too generic",
  redundant_prefix: "Starts with “image of”",
  too_long: "Very long",
  duplicate: "Repeated",
  ok: "Looks fine",
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "problems", label: "Problems" },
  { id: "missing", label: "Missing" },
  { id: "review", label: "Needs review" },
  { id: "empty", label: "Empty alt" },
  { id: "all", label: "All images" },
];

// Worst first: no alt, then weak alt, then empty (often decorative), then fine.
function rank(image: CheckedImage) {
  if (image.severity === "error") return 0;
  if (image.status === "empty") return 2;
  if (image.severity === "review") return 1;
  return 3;
}

function matchesFilter(image: CheckedImage, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "problems") return image.status !== "ok";
  if (filter === "missing") return image.status === "missing";
  if (filter === "empty") return image.status === "empty";
  return image.severity === "review" && image.status !== "empty";
}

function displayUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return value;
  }
}

function shortSrc(src: string | null, tag: CheckedImage["tag"]) {
  if (tag === "area") return "Image map link";
  if (!src) return "No image address";
  if (src.startsWith("data:")) return "Inline image (data URL)";
  try {
    const url = new URL(src);
    const file = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    return decodeURIComponent(file).slice(0, 60);
  } catch {
    return src.slice(0, 60);
  }
}

function csvCell(value: string | number | null) {
  let text = value == null ? "" : String(value);
  // Stop spreadsheet apps from treating page content as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function StatusBadge({ image }: { image: CheckedImage }) {
  const styles =
    image.severity === "error"
      ? "bg-red-50 text-error border-red-200"
      : image.severity === "ok"
        ? "bg-green-50 text-success border-green-200"
        : "bg-amber-50 text-warning border-amber-200";
  const Icon =
    image.severity === "error"
      ? XCircle
      : image.severity === "ok"
        ? CheckCircle
        : image.status === "empty"
          ? Info
          : AlertTriangle;

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {STATUS_LABEL[image.status]}
    </span>
  );
}

function Thumbnail({ image }: { image: CheckedImage }) {
  const [failed, setFailed] = useState(false);
  const canShow = image.src && /^https?:/i.test(image.src) && !failed;

  if (!canShow) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-yellow-tint">
        <ImageOff className="h-5 w-5 text-ink-muted" aria-hidden="true" />
        <span className="sr-only">No preview for image {image.index}</span>
      </div>
    );
  }

  return (
    // Third-party images on the visitor's own page: plain <img>, no Next optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src as string}
      alt={`Thumbnail of checked image ${image.index}`}
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg border border-line bg-yellow-tint object-cover"
    />
  );
}

function AltValue({ image }: { image: CheckedImage }) {
  if (image.alt === null) {
    return <span className="italic text-ink-muted">No alt attribute</span>;
  }
  if (image.alt === "") {
    return <code className="rounded bg-yellow-tint px-1.5 py-0.5 text-sm">alt=&quot;&quot;</code>;
  }
  return <span className="break-words text-ink">“{image.alt}”</span>;
}

export default function AltTextChecker() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [filter, setFilter] = useState<Filter>("problems");
  const [announcement, setAnnouncement] = useState("");
  const resultsHeading = useRef<HTMLHeadingElement>(null);

  const visible = useMemo(
    () =>
      result
        ? result.images
            .filter((image) => matchesFilter(image, filter))
            .sort((a, b) => rank(a) - rank(b) || a.index - b.index)
        : [],
    [result, filter]
  );

  const problemCount = result ? result.totals.missing + result.totals.needsReview : 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setAnnouncement("Checking the page. This can take a few seconds.");

    try {
      const response = await fetch(`${getApiBase()}/check-alt-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.totals) {
        const message =
          (data && (data.message || data.error)) ||
          "Something went wrong while checking that page. Please try again.";
        setError(message);
        setAnnouncement(message);
        return;
      }

      const checked = data as CheckResult;
      setResult(checked);
      setFilter(checked.totals.missing + checked.totals.needsReview + checked.totals.empty > 0 ? "problems" : "all");
      setAnnouncement(
        `Found ${checked.totals.images} images. ${checked.totals.missing} missing alt text, ${checked.totals.needsReview} need review, ${checked.totals.empty} have empty alt text.`
      );
      trackMarketingEvent("alt_checker_run", {
        source: "landing_page",
        properties: {
          images: checked.totals.images,
          missing: checked.totals.missing,
          is_wordpress: checked.isWordPress,
        },
      });
      requestAnimationFrame(() => resultsHeading.current?.focus());
    } catch {
      const message = "We could not reach the checker. Check your connection and try again.";
      setError(message);
      setAnnouncement(message);
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!result) return;
    const rows = [
      ["#", "status", "element", "image_url", "alt_text", "in_link", "note"],
      ...result.images.map((image) => [
        image.index,
        STATUS_LABEL[image.status],
        image.tag,
        image.src,
        image.alt === null ? "(no alt attribute)" : image.alt,
        image.inLink ? "yes" : "no",
        image.reason,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    let host = "page";
    try {
      host = new URL(result.finalUrl).hostname;
    } catch {
      // keep the default name
    }
    link.href = URL.createObjectURL(blob);
    link.download = `alt-text-check-${host}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-white p-5 shadow-notebook-lg sm:p-6" noValidate>
        <label htmlFor="checker-url" className="mb-2 block font-semibold text-ink">
          Page address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="checker-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://example.com/blog/post"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-describedby="checker-help"
            aria-invalid={error ? true : undefined}
            className="h-12 text-base"
            required
          />
          <button
            type="submit"
            className={cn(buttonVariants(), "h-12 shrink-0")}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Checking…
              </>
            ) : (
              <>
                <Search aria-hidden="true" />
                Check page
              </>
            )}
          </button>
        </div>
        <p id="checker-help" className="mt-3 text-sm text-ink-muted">
          Free, no signup. Checks one public page at a time. We don&apos;t save the address you enter.
        </p>
      </form>

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {error && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-ink" role="alert">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <section className="mt-10" aria-labelledby="checker-results-heading">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2
                id="checker-results-heading"
                ref={resultsHeading}
                tabIndex={-1}
                className="font-outfit text-2xl font-bold tracking-tight outline-none focus:outline-none focus-visible:outline-none sm:text-3xl"
              >
                Results
              </h2>
              <p className="mt-1 break-all text-ink-muted">
                {displayUrl(result.finalUrl)}
                {result.isWordPress && (
                  <span className="ml-2 inline-flex rounded-full bg-yellow-soft px-2.5 py-0.5 text-xs font-semibold text-ink">
                    WordPress site
                  </span>
                )}
              </p>
            </div>
            {result.totals.images > 0 && (
              <button type="button" onClick={downloadCsv} className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden="true" />
                Download CSV
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Images found", value: result.totals.images, tone: "text-ink" },
              { label: "Missing alt", value: result.totals.missing, tone: result.totals.missing ? "text-error" : "text-ink" },
              { label: "Needs review", value: result.totals.needsReview, tone: result.totals.needsReview ? "text-warning" : "text-ink" },
              { label: "Empty alt", value: result.totals.empty, tone: "text-ink" },
              { label: "Looks fine", value: result.totals.ok, tone: result.totals.ok ? "text-success" : "text-ink" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
                <dt className="label-caps">{item.label}</dt>
                <dd className={`mt-1 font-outfit text-3xl font-bold ${item.tone}`}>{item.value}</dd>
              </div>
            ))}
          </dl>

          {(result.htmlTruncated || result.truncated || result.totals.ignored > 0) && (
            <ul className="mt-4 space-y-1 text-sm text-ink-muted">
              {result.htmlTruncated && <li>This page is very large, so only the first part was checked.</li>}
              {result.truncated && <li>Showing the first 300 images. The counts above include all of them.</li>}
              {result.totals.ignored > 0 && (
                <li>
                  {result.totals.ignored} tracking pixel{result.totals.ignored === 1 ? " was" : "s were"} ignored.
                </li>
              )}
            </ul>
          )}

          {result.totals.images === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-white p-6">
              <p className="font-semibold text-ink">No images found in this page&apos;s HTML.</p>
              <p className="mt-2 text-ink-muted">
                If you can see images on the page, they are probably added by JavaScript after it loads, or set as CSS backgrounds. This checker reads the HTML the server sends, so it can&apos;t see those.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter images">
                {FILTERS.map((item) => {
                  const count = result.images.filter((image) => matchesFilter(image, item.id)).length;
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      aria-pressed={active}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-yellow-strong ${
                        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-yellow-tint"
                      }`}
                    >
                      {item.label} <span className={active ? "text-white/80" : "text-ink-muted"}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {visible.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-ink-muted">Nothing in this view.</p>
              ) : (
                <>
                  <div className="mt-6 hidden overflow-hidden rounded-2xl border border-line sm:block">
                    <table className="w-full table-fixed text-left text-sm">
                      <caption className="sr-only">
                        Images on {displayUrl(result.finalUrl)} with their alt text and status
                      </caption>
                      <thead className="bg-yellow-tint">
                        <tr>
                          <th scope="col" className="w-[88px] px-4 py-3 font-semibold">Image</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Alt text</th>
                          <th scope="col" className="w-[38%] px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((image) => (
                          <tr key={image.index} className="border-t border-line align-top">
                            <td className="px-4 py-4">
                              <Thumbnail image={image} />
                            </td>
                            <td className="px-4 py-4">
                              <p className="mb-1 truncate text-xs text-ink-muted" title={image.src || undefined}>
                                #{image.index} · {shortSrc(image.src, image.tag)}
                                {image.inLink ? " · in a link" : ""}
                              </p>
                              <AltValue image={image} />
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge image={image} />
                              <p className="mt-2 leading-relaxed text-ink-muted">{image.reason}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="mt-6 space-y-3 sm:hidden" aria-label="Checked images">
                    {visible.map((image) => (
                      <li key={image.index} className="rounded-2xl border border-line bg-white p-4">
                        <div className="flex gap-3">
                          <Thumbnail image={image} />
                          <div className="min-w-0">
                            <p className="truncate text-xs text-ink-muted">
                              #{image.index} · {shortSrc(image.src, image.tag)}
                            </p>
                            <div className="mt-1">
                              <StatusBadge image={image} />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm">
                          <AltValue image={image} />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{image.reason}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <div className="mt-10 rounded-2xl border border-line bg-white p-6 shadow-notebook lg:p-8">
            {result.isWordPress && result.totals.missing > 0 ? (
              <>
                <h3 className="mb-3 font-outfit text-2xl font-bold tracking-tight">
                  Fill {result.totals.missing === 1 ? "the missing description" : `${result.totals.missing} missing descriptions`} in WordPress
                </h3>
                <p className="mb-6 max-w-2xl leading-relaxed text-ink-muted">
                  This looks like a WordPress site. Alt Text Pro finds the images in your media library that have no alt text and drafts a description for each one in a bulk run. You review the results, and you start with 150 free credits.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/bulk-generate-alt-text-wordpress" className={buttonVariants()}>
                    See how the bulk fix works
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/?auth=signup" className={buttonVariants({ variant: "secondary" })}>
                    Get 150 Free Credits
                  </Link>
                </div>
              </>
            ) : result.isWordPress && problemCount > 0 ? (
              <>
                <h3 className="mb-3 font-outfit text-2xl font-bold tracking-tight">
                  Improve {problemCount === 1 ? "this image" : `these ${problemCount} images`} in WordPress
                </h3>
                <p className="mb-6 max-w-2xl leading-relaxed text-ink-muted">
                  This looks like a WordPress site. Alt Text Pro can draft a fresh description for any image from the media editor, and you edit it before it&apos;s saved. You start with 150 free credits.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/ai-alt-text-generator-for-wordpress" className={buttonVariants()}>
                    See how it works
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/?auth=signup" className={buttonVariants({ variant: "secondary" })}>
                    Get 150 Free Credits
                  </Link>
                </div>
              </>
            ) : problemCount > 0 ? (
              <>
                <h3 className="mb-3 font-outfit text-2xl font-bold tracking-tight">How to fix these</h3>
                <p className="mb-6 max-w-2xl leading-relaxed text-ink-muted">
                  Describe what each image shows and why it&apos;s on the page, and use empty alt only for decoration. Alt Text Pro works with WordPress today; for other sites, our guide walks through writing alt text by hand.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/how-to-write-alt-text" className={buttonVariants()}>
                    How to write alt text
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/alt-text-simulator" className={buttonVariants({ variant: "secondary" })}>
                    Hear how screen readers read it
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-3 font-outfit text-2xl font-bold tracking-tight">No obvious problems on this page</h3>
                <p className="max-w-2xl leading-relaxed text-ink-muted">
                  Every image has alt text that passed these checks. This tool checks one page at a time, so try a few more, especially older posts and product pages. Only a person can confirm the descriptions are accurate.
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
