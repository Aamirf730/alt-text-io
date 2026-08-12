export function sanitizeServerLogText(value: unknown): string {
  return String(value || "Unknown error")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\b(?:alt|altai)_[A-Za-z0-9_-]{8,}\b/g, "[redacted-api-key]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[redacted-id]")
    .replace(/([?&](?:token|key|secret|authorization)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 1000);
}

export function safeServerError(error: unknown): string {
  return sanitizeServerLogText(error instanceof Error ? error.message : error);
}
