/**
 * Core Extraction & HTML-to-Markdown Engine
 * Zero-dependency, ultra-fast algorithmic parser for Cloudflare Workers edge.
 */

export interface LeadIntelligence {
  emails: string[];
  phones: string[];
  socials: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
}

export interface ExtractedMetadata {
  title: string;
  description: string;
  favicon?: string;
  canonical?: string;
  ogImage?: string;
  language?: string;
}

export interface ExtractedLinks {
  internal: string[];
  external: string[];
  documents: string[];
}

export interface ExtractionResult {
  success: true;
  url: string;
  metadata: ExtractedMetadata;
  markdown: string;
  wordCount: number;
  estimatedTokens: number;
  leads: LeadIntelligence;
  links?: ExtractedLinks;
}

// Regex to detect email addresses, excluding image extensions
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const INVALID_EMAIL_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf)$/i;

/**
 * Extracts B2B leads (emails, phones, social links) from HTML.
 */
export function extractLeads(html: string, baseUrl: string): LeadIntelligence {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const socials: LeadIntelligence["socials"] = {};

  // 1. Extract Emails from mailto: links and general text
  const mailtoMatches = html.matchAll(/href=["']mailto:([^"?#]+)[^"']*["']/gi);
  for (const m of mailtoMatches) {
    const email = m[1].trim().toLowerCase();
    if (!INVALID_EMAIL_EXTENSIONS.test(email)) emails.add(email);
  }

  const textEmails = html.match(EMAIL_REGEX) || [];
  for (const raw of textEmails) {
    const email = raw.trim().toLowerCase();
    if (!INVALID_EMAIL_EXTENSIONS.test(email)) {
      emails.add(email);
    }
  }

  // 2. Extract Phone Numbers from tel: links
  const telMatches = html.matchAll(/href=["']tel:([^"']+)["']/gi);
  for (const m of telMatches) {
    const cleanTel = m[1].replace(/[^\d+]/g, "");
    if (cleanTel.length >= 8 && cleanTel.length <= 16) {
      phones.add(m[1].trim());
    }
  }

  // 3. Extract Social Media Profiles
  const linkMatches = html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi);
  for (const m of linkMatches) {
    const link = m[1].trim();
    const lower = link.toLowerCase();

    if (lower.includes("linkedin.com/company/") || lower.includes("linkedin.com/in/")) {
      if (!socials.linkedin) socials.linkedin = link;
    } else if (lower.includes("twitter.com/") || lower.includes("x.com/")) {
      if (!socials.twitter && !lower.includes("/share") && !lower.includes("/intent")) socials.twitter = link;
    } else if (lower.includes("github.com/")) {
      if (!socials.github && !lower.includes("/features") && !lower.includes("/pricing")) socials.github = link;
    } else if (lower.includes("facebook.com/")) {
      if (!socials.facebook && !lower.includes("/sharer")) socials.facebook = link;
    } else if (lower.includes("instagram.com/")) {
      if (!socials.instagram && !lower.includes("/explore")) socials.instagram = link;
    } else if (lower.includes("youtube.com/@") || lower.includes("youtube.com/channel/")) {
      if (!socials.youtube) socials.youtube = link;
    }
  }

  return {
    emails: Array.from(emails).slice(0, 15),
    phones: Array.from(phones).slice(0, 10),
    socials
  };
}

/**
 * Extracts page metadata (Title, description, og:image, favicon).
 */
export function extractMetadata(html: string, targetUrl: URL): ExtractedMetadata {
  const getTagContent = (pattern: RegExp): string => {
    const match = pattern.exec(html);
    return match ? match[1].trim() : "";
  };

  const title = getTagContent(/<title[^>]*>([^<]+)<\/title>/i) ||
                getTagContent(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  const description = getTagContent(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      getTagContent(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);

  const ogImage = getTagContent(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const canonical = getTagContent(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const language = getTagContent(/<html[^>]+lang=["']([^"']+)["']/i);

  let favicon = getTagContent(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
  if (favicon && !favicon.startsWith("http")) {
    favicon = new URL(favicon, targetUrl.origin).href;
  }

  return {
    title: title || targetUrl.hostname,
    description,
    favicon: favicon || `${targetUrl.origin}/favicon.ico`,
    canonical: canonical || targetUrl.href,
    ogImage,
    language
  };
}

/**
 * Extracts all links categorized (internal, external, documents).
 */
export function extractLinks(html: string, targetUrl: URL): ExtractedLinks {
  const internal = new Set<string>();
  const external = new Set<string>();
  const documents = new Set<string>();

  const linkMatches = html.matchAll(/href=["']([^"'#\s]+)["']/gi);
  for (const m of linkMatches) {
    let raw = m[1].trim();
    if (raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;

    let resolved: URL;
    try {
      resolved = new URL(raw, targetUrl.origin);
    } catch {
      continue;
    }

    if (resolved.pathname.match(/\.(pdf|docx?|xlsx?|csv|zip)$/i)) {
      documents.add(resolved.href);
    } else if (resolved.hostname === targetUrl.hostname) {
      internal.add(resolved.href);
    } else {
      external.add(resolved.href);
    }
  }

  return {
    internal: Array.from(internal).slice(0, 50),
    external: Array.from(external).slice(0, 50),
    documents: Array.from(documents).slice(0, 20)
  };
}

/**
 * Converts raw HTML into clean, token-efficient Markdown.
 */
export function htmlToMarkdown(html: string): string {
  let content = html;

  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  content = content.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");
  content = content.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");
  content = content.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  content = content.replace(/<!--[\s\S]*?-->/g, "");

  content = content.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "");
  content = content.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "");

  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  content = content.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  content = content.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  content = content.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");

  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  content = content.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  content = content.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  content = content.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  content = content.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

  content = content.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, "").trim();
    if (!cleanText || href.startsWith("javascript:") || href.startsWith("#")) {
      return cleanText;
    }
    return `[${cleanText}](${href})`;
  });

  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");
  content = content.replace(/<br\s*[\/]?>/gi, "\n");
  content = content.replace(/<hr\s*[\/]?>/gi, "\n\n---\n\n");

  content = content.replace(/<[^>]+>/g, " ");

  content = content.replace(/&nbsp;/g, " ");
  content = content.replace(/&amp;/g, "&");
  content = content.replace(/&lt;/g, "<");
  content = content.replace(/&gt;/g, ">");
  content = content.replace(/&quot;/g, "\"");
  content = content.replace(/&#39;/g, "'");

  content = content.replace(/[ \t]+/g, " ");
  content = content.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return content.trim();
}

export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
