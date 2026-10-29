// An image picked in the homepage demo has to survive email confirmation,
// which usually opens the dashboard in a new tab. Like a pending checkout, it
// is kept in localStorage for a limited time and consumed once by the
// dashboard. prepareImageForUpload keeps it under 3 MB, which fits.
const STORAGE_KEY = "altTextPro.pendingDemoImage";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredDemoImage = { dataUrl: string; savedAt: number };

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Returns true when the image was saved. */
export function savePendingDemoImage(dataUrl: string, now = Date.now()): boolean {
  if (!dataUrl.startsWith("data:image/")) return false;
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ dataUrl, savedAt: now } satisfies StoredDemoImage));
    return true;
  } catch {
    // Storage can be unavailable or full (private mode, blocked site data).
    return false;
  }
}

/** Reads and removes the saved image so it is offered at most once. */
export function consumePendingDemoImage(now = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = getStorage()?.getItem(STORAGE_KEY) ?? null;
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredDemoImage;
    if (
      typeof stored.dataUrl !== "string" ||
      !stored.dataUrl.startsWith("data:image/") ||
      typeof stored.savedAt !== "number" ||
      stored.savedAt > now ||
      now - stored.savedAt > MAX_AGE_MS
    ) {
      return null;
    }
    return stored.dataUrl;
  } catch {
    return null;
  }
}
