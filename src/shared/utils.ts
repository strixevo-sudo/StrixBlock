// StrixBlock v2 — Shared utility functions

/**
 * Extract the eTLD+1 domain from a URL string.
 * Returns empty string on failure.
 */
export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    // Try to handle non-URL strings (e.g. bare domain)
    const match = url.match(/^(?:https?:\/\/)?([^/?#\s]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

/**
 * Returns true if requestUrl is third-party relative to initiatorUrl.
 * Two URLs are first-party if they share the same eTLD+1.
 */
export function isThirdParty(requestUrl: string, initiatorUrl: string): boolean {
  const reqDomain = extractDomain(requestUrl);
  const initDomain = extractDomain(initiatorUrl);
  if (!reqDomain || !initDomain) return false;
  return getBaseDomain(reqDomain) !== getBaseDomain(initDomain);
}

/**
 * Get base domain (last two parts) from a hostname.
 * e.g. "sub.example.co.uk" -> "example.co.uk"
 */
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Handle common second-level TLDs like co.uk, com.au
  const twoPartTlds = ['co.uk', 'com.au', 'co.nz', 'org.uk', 'me.uk', 'net.au', 'gov.au'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTlds.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Check if a domain matches a pattern (which may contain a leading wildcard).
 * Pattern "*.example.com" matches "sub.example.com" but not "example.com".
 * Pattern "example.com" matches "example.com" and "sub.example.com".
 */
export function matchesDomain(domain: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return domain === base || domain.endsWith('.' + base);
  }
  return domain === pattern || domain.endsWith('.' + pattern);
}

/**
 * Validate and sanitize a CSS selector string.
 * Returns the selector if valid, or empty string if invalid.
 */
export function sanitizeSelector(selector: string): string {
  if (!selector || typeof selector !== 'string') return '';
  const trimmed = selector.trim();
  if (!trimmed) return '';
  // Basic length guard
  if (trimmed.length > 2000) return '';
  // Try to validate by parsing
  try {
    document.createDocumentFragment().querySelector(trimmed);
    return trimmed;
  } catch {
    return '';
  }
}

/**
 * Create a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delay);
  };
}

/**
 * Generate a short random ID string.
 */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Format a number for display (e.g. 1500 -> "1.5K")
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

/**
 * Format a date timestamp as a relative time string.
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON, returning undefined on failure.
 */
export function safeJsonParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
