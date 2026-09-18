/**
 * Security & Defense Module for Web-to-Markdown API
 * Implements strict SSRF protection, URL validation, and input sanitization.
 */

// Forbidden IP patterns and private network blocks
const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "instance-data",
  "metadata.google.internal"
]);

const FORBIDDEN_IP_PREFIXES = [
  "127.",        // Loopback
  "10.",         // Class A private
  "192.168.",    // Class C private
  "169.254.",    // Link-local / Cloud metadata (AWS, GCP, Azure, DO)
  "0.",          // Current network
  "fc00:",       // IPv6 Unique Local
  "fe80:",       // IPv6 Link-Local
  "::ffff:127.", // IPv4-mapped IPv6 loopback
];

// Check 172.16.0.0 - 172.31.255.255 (Class B private)
function isClassBPrivate(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length === 4 && parts[0] === "172") {
    const second = parseInt(parts[1], 10);
    return !isNaN(second) && second >= 16 && second <= 31;
  }
  return false;
}

/**
 * Validates whether a target URL is safe to fetch (Anti-SSRF).
 * Throws an Error with a safe message if the URL violates security policies.
 */
export function validateSafeUrl(rawUrl: string): URL {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Missing or invalid 'url' parameter");
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new Error("URL is too long (max 2048 characters)");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL format. Must include http:// or https://");
  }

  // Must only allow HTTP or HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Forbidden protocol '${parsed.protocol}'. Only http and https are permitted`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block obvious forbidden hosts
  if (FORBIDDEN_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error(`SSRF Protection: Access to private or local host '${hostname}' is strictly forbidden`);
  }

  // Block private IP ranges
  for (const prefix of FORBIDDEN_IP_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      throw new Error("SSRF Protection: Access to private/internal network IP ranges is strictly forbidden");
    }
  }

  if (isClassBPrivate(hostname)) {
    throw new Error("SSRF Protection: Access to 172.16.0.0/12 private network is strictly forbidden");
  }

  // Block numeric IP representations (decimal/hex obfuscation e.g. 2130706433 or 0x7f000001)
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    throw new Error("SSRF Protection: Obfuscated numeric IP addresses are forbidden");
  }

  return parsed;
}

/**
 * Maximum content size allowed to be fetched (5 MB).
 */
export const MAX_CONTENT_LENGTH = 5 * 1024 * 1024;

/**
 * Request timeout in milliseconds (7 seconds).
 */
export const FETCH_TIMEOUT_MS = 7000;
