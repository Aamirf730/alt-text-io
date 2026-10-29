"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Circle, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLUGIN_URL = "https://wordpress.org/plugins/alt-text-pro/";

type Step = {
  title: string;
  description: string;
  /** null when the dashboard cannot tell, such as bulk runs in WordPress. */
  done: boolean | null;
  action?: { label: string; href: string; external?: boolean };
};

function hiddenKey(userId: string) {
  return `altTextPro.gettingStartedHidden.${userId}`;
}

function readHidden(userId: string) {
  try {
    return window.localStorage.getItem(hiddenKey(userId)) === "1";
  } catch {
    return false;
  }
}

type GettingStartedProps = {
  userId: string;
  isPluginConnected: boolean;
  hasGeneratedFirstAltText: boolean;
};

export default function GettingStarted({ userId, isPluginConnected, hasGeneratedFirstAltText }: GettingStartedProps) {
  const [hidden, setHidden] = useState(() => readHidden(userId));
  if (hidden) return null;

  const steps: Step[] = [
    {
      title: "Create your account",
      description: "Done. You have free credits to start with.",
      done: true,
    },
    {
      title: "Install the plugin",
      description: 'In WordPress, go to Plugins, Add New, and search for "Alt Text Pro". Or get it from WordPress.org.',
      // A connected site means the plugin is installed; before that the
      // dashboard cannot tell, so it counts as not done.
      done: isPluginConnected,
      action: isPluginConnected ? undefined : { label: "Get the plugin", href: PLUGIN_URL, external: true },
    },
    {
      title: "Connect your site",
      description: "In the plugin, click Connect Account and sign in with this account. Your API key is saved for you.",
      done: isPluginConnected,
      action: isPluginConnected ? undefined : { label: "Setup guide", href: "/docs#installation" },
    },
    {
      title: "Generate your first alt text",
      description: "Click Generate on any image in WordPress, or try one image here first.",
      done: hasGeneratedFirstAltText,
      action: hasGeneratedFirstAltText ? undefined : { label: "Try one here", href: "#generate" },
    },
    {
      title: "Fix the rest of your library",
      description: "In WordPress, open Alt Text Pro, then Bulk. It shows how many images need alt text and whether your credits cover them.",
      done: null,
      action: { label: "How bulk works", href: "/bulk-generate-alt-text-wordpress" },
    },
  ];
  const completed = steps.filter((step) => step.done === true).length;
  const tracked = steps.filter((step) => step.done !== null).length;

  const hide = () => {
    try {
      window.localStorage.setItem(hiddenKey(userId), "1");
    } catch {
      // Without storage it simply shows again next visit.
    }
    setHidden(true);
  };

  return (
    <section aria-labelledby="setup-heading" className="mb-6 rounded-2xl border border-line-strong bg-yellow-tint p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="setup-heading" className="font-lato text-lg font-semibold text-ink">Get started</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {completed} of {tracked} done
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0")}
          aria-label="Hide the getting started checklist"
        >
          <X className="h-4 w-4" aria-hidden /> Hide
        </button>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
              )}
              <div>
                <p className={cn("text-sm font-semibold text-ink", step.done && "text-ink-muted line-through")}>
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </p>
                {!step.done && <p className="mt-1 text-sm leading-6 text-ink-muted">{step.description}</p>}
              </div>
            </div>
            {step.action && (
              <a
                href={step.action.href}
                {...(step.action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "self-start sm:self-auto")}
              >
                {step.action.label}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
