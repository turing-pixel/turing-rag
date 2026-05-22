/**
 * Public URLs baked at build (NEXT_PUBLIC_*) or inferred in the browser.
 * Production: set API_BASE_URL / WEB_BASE_URL in .env.production (passed as build args).
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Avoid Mixed Content when the app is HTTPS but build-time API URL was http:// */
function upgradeToHttpsIfPageIsSecure(url: string): string {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http://")
  ) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

/** Browser -> FastAPI base (no trailing slash). */
export function getApiBase(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return upgradeToHttpsIfPageIsSecure(trimTrailingSlash(fromEnv));
  }
  if (typeof window !== "undefined") {
    const port = process.env.NEXT_PUBLIC_BACKEND_PORT || "8000";
    // Prefer 127.0.0.1 when the page is on localhost: on macOS, localhost:8000
    // often resolves to IPv6 [::1] where Chroma may listen, not the API on IPv4.
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1"
        : window.location.hostname;
    return upgradeToHttpsIfPageIsSecure(
      `${window.location.protocol}//${host}:${port}`
    );
  }
  return "http://127.0.0.1:8000";
}

/** Public web app origin (e.g. marketing / app shell). */
export function getWebBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim();
  if (fromEnv) {
    return upgradeToHttpsIfPageIsSecure(trimTrailingSlash(fromEnv));
  }
  if (typeof window !== "undefined") {
    return upgradeToHttpsIfPageIsSecure(
      `${window.location.protocol}//${window.location.host}`
    );
  }
  return "http://localhost:3000";
}
