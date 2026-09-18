import { Hono } from "hono";
import { cors } from "hono/cors";
import { validateSafeUrl, FETCH_TIMEOUT_MS, MAX_CONTENT_LENGTH } from "./security";
import { extractLeads, extractMetadata, extractLinks, htmlToMarkdown, countTokens } from "./extractor";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-RapidAPI-Key", "X-RapidAPI-Host"]
}));

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.header("X-Response-Time", `${ms}ms`);
  c.header("X-Powered-By", "TopAI-SaaS-Engine");
});

app.get("/v1/health", (c) => {
  return c.json({
    status: "healthy",
    service: "web-to-markdown-lead-api",
    version: "1.1.0",
    timestamp: new Date().toISOString()
  });
});

/**
 * Helper to fetch a target website safely
 */
async function fetchTarget(rawUrl: string): Promise<{ targetUrl: URL; rawHtml: string }> {
  const targetUrl = validateSafeUrl(rawUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      }
    });

    if (!response.ok) {
      throw new Error(`Target server responded with HTTP status ${response.status} (${response.statusText})`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
      throw new Error(`Unsupported content-type '${contentType}'. Expected HTML/text.`);
    }

    const rawHtml = await response.text();
    if (rawHtml.length > MAX_CONTENT_LENGTH) {
      throw new Error("Payload Too Large: Target page exceeds 5MB limit");
    }

    return { targetUrl, rawHtml };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Endpoint 1 : POST /v1/extract (Complete Extraction)
 */
app.post("/v1/extract", async (c) => {
  const startTime = Date.now();
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.url) return c.json({ success: false, error: "Missing required 'url' field" }, 400);

    const { targetUrl, rawHtml } = await fetchTarget(body.url);
    const metadata = extractMetadata(rawHtml, targetUrl);
    const markdown = htmlToMarkdown(rawHtml);
    const leads = body.extract_leads !== false ? extractLeads(rawHtml, targetUrl.href) : { emails: [], phones: [], socials: {} };

    return c.json({
      success: true,
      url: targetUrl.href,
      metadata,
      markdown,
      word_count: markdown.split(/\s+/).filter(Boolean).length,
      estimated_tokens: countTokens(markdown),
      leads,
      execution_time_ms: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * Endpoint 2 : POST /v1/extract/leads (B2B Lead Hunter Only)
 */
app.post("/v1/extract/leads", async (c) => {
  const startTime = Date.now();
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.url) return c.json({ success: false, error: "Missing required 'url' field" }, 400);

    const { targetUrl, rawHtml } = await fetchTarget(body.url);
    const leads = extractLeads(rawHtml, targetUrl.href);

    return c.json({
      success: true,
      url: targetUrl.href,
      leads,
      execution_time_ms: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * Endpoint 3 : POST /v1/extract/metadata (Instant SEO & Social Metadata)
 */
app.post("/v1/extract/metadata", async (c) => {
  const startTime = Date.now();
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.url) return c.json({ success: false, error: "Missing required 'url' field" }, 400);

    const { targetUrl, rawHtml } = await fetchTarget(body.url);
    const metadata = extractMetadata(rawHtml, targetUrl);

    return c.json({
      success: true,
      url: targetUrl.href,
      metadata,
      execution_time_ms: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * Endpoint 4 : POST /v1/extract/links (Crawler & Sitemap Link Discoverer)
 */
app.post("/v1/extract/links", async (c) => {
  const startTime = Date.now();
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.url) return c.json({ success: false, error: "Missing required 'url' field" }, 400);

    const { targetUrl, rawHtml } = await fetchTarget(body.url);
    const links = extractLinks(rawHtml, targetUrl);

    return c.json({
      success: true,
      url: targetUrl.href,
      links,
      execution_time_ms: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * Quick GET fallback
 */
app.get("/v1/extract", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ success: false, error: "Missing 'url' query parameter" }, 400);
  const startTime = Date.now();
  try {
    const { targetUrl, rawHtml } = await fetchTarget(url);
    const markdown = htmlToMarkdown(rawHtml);
    return c.json({
      success: true,
      url: targetUrl.href,
      metadata: extractMetadata(rawHtml, targetUrl),
      markdown,
      leads: extractLeads(rawHtml, targetUrl.href),
      execution_time_ms: Date.now() - startTime
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * Interactive Web Dashboard & Demo
 */
app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Universal Web-to-Markdown & Lead Intelligence API</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #334155; padding: 40px 20px; line-height: 1.6; }
    .box { max-width: 860px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    h1 { color: #0f172a; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; }
    input { width: 70%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; }
    button { background: #2563eb; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; max-height: 350px; }
    .tag { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-size: 12px; margin: 2px; }
  </style>
</head>
<body>
  <div class="box">
    <span class="badge">🚀 4 Specialized Endpoints Live</span>
    <h1>Universal Web-to-Markdown & B2B Lead Intelligence API</h1>
    <p>Suite d'extraction haute performance pour <strong>Agents IA, RAG et Automatisation Commerciale</strong>.</p>
    
    <h3>⚡ Testez en direct :</h3>
    <div style="display:flex; gap:10px;">
      <input type="url" id="u" value="https://stripe.com">
      <button onclick="runTest()">Extraire</button>
    </div>
    <div id="out" style="display:none; margin-top:20px;">
      <p id="stats" style="font-weight:600; color:#2563eb;"></p>
      <h4>Aperçu Markdown épuré :</h4>
      <pre id="md"></pre>
    </div>

    <h3>📚 Les 4 Endpoints Dédiés :</h3>
    <ul>
      <li><code>POST /v1/extract</code> : Extraction Complète (Markdown + Leads + Métadonnées)</li>
      <li><code>POST /v1/extract/leads</code> : Chasseur B2B (E-mails, Téléphones, Réseaux Sociaux)</li>
      <li><code>POST /v1/extract/metadata</code> : Métadonnées SEO & OpenGraph ultra-rapides</li>
      <li><code>POST /v1/extract/links</code> : Découverte de liens & documents PDF</li>
    </ul>
  </div>
  <script>
    async function runTest() {
      const url = document.getElementById('u').value;
      const res = await fetch('/v1/extract', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url})
      });
      const data = await res.json();
      document.getElementById('out').style.display = 'block';
      document.getElementById('stats').innerText = data.word_count + ' mots • ' + data.execution_time_ms + ' ms • ' + data.leads.emails.length + ' emails trouvés';
      document.getElementById('md').innerText = data.markdown.slice(0, 1000) + '...';
    }
  </script>
</body>
</html>`);
});

export default app;
