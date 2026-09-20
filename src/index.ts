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
  const accept = c.req.header("accept") || "";
  const format = c.req.query("format");

  if (format === "json" || (!accept.includes("text/html") && accept.includes("application/json"))) {
    return c.json({
      service: "Universal Web-to-Markdown & Lead Intelligence API",
      tagline: "Ad-free web extraction, clean Markdown for LLMs, and instant B2B contact detection",
      version: "1.1.0",
      health_url: "/v1/health",
      endpoints: {
        "POST /v1/extract": "Complete Extraction (Markdown + Leads + Metadata)",
        "POST /v1/extract/leads": "B2B Lead Hunter (Emails, Phones, Socials)",
        "POST /v1/extract/metadata": "Instant SEO & OpenGraph metadata",
        "POST /v1/extract/links": "Crawler & Sitemap Link Discoverer",
        "GET /v1/extract": "Quick URL extraction query fallback"
      }
    });
  }

  c.header("Cache-Control", "no-cache, no-store, must-revalidate");

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Web-to-Markdown & Lead Intelligence API • Live Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 214, 0, 0.15); color: #ffd600; border: 1px solid rgba(255, 214, 0, 0.3); padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
    .badge::before { content: ''; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e; }
    h1 { font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
    p.subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 24px; }
    .playground { background: #1a2234; border: 1px solid #2d3748; border-radius: 12px; padding: 24px; margin-bottom: 28px; }
    .input-row { display: flex; gap: 12px; margin-bottom: 16px; }
    input[type="url"], input[type="text"] { flex: 1; padding: 14px 16px; background: #0b1120; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s; }
    input[type="url"]:focus, input[type="text"]:focus { border-color: #ffd600; }
    button { background: #ffd600; color: #000; border: none; padding: 14px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.1s, background 0.2s; }
    button:hover { background: #ffea00; }
    button:active { transform: scale(0.98); }
    #output { display: none; margin-top: 16px; }
    pre { background: #070b12; border: 1px solid #1e293b; color: #38bdf8; padding: 16px; border-radius: 8px; overflow-x: auto; max-height: 400px; font-size: 13px; font-family: monospace; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
    .chip { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 13px; text-decoration: none; }
    .links-bar { margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f2937; display: flex; gap: 16px; font-size: 14px; }
    .links-bar a { color: #ffd600; text-decoration: none; font-weight: 600; }
    .links-bar a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Live 24/7 on Cloudflare Global Edge</div>
    <h1>Universal Web-to-Markdown & Lead Intelligence API</h1>
    <p class="subtitle">Ad-free web extraction, clean Markdown for LLMs, and contact detection for autonomous agents.</p>

    <div class="playground">
      <div class="input-row">
        <input type="url" id="targetUrl" value="https://stripe.com" placeholder="https://example.com">
        <button onclick="runExtract()" id="btn">Extract Web Page</button>
      </div>
      <div id="output">
        <div style="margin-bottom: 8px; font-size: 14px; color: #a3e635;" id="stats"></div>
        <pre id="md"></pre>
      </div>
    </div>

    <h3 style="color:#fff; font-size:16px; margin-bottom: 8px;">📚 Official Endpoints</h3>
    <div class="chips">
      <span class="chip"><code>POST /v1/extract</code> (Full Markdown + Leads)</span>
      <span class="chip"><code>POST /v1/extract/leads</code> (B2B Hunter)</span>
      <span class="chip"><code>POST /v1/extract/metadata</code> (SEO / OpenGraph)</span>
      <span class="chip"><code>POST /v1/extract/links</code> (Crawler / Sitemaps)</span>
      <span class="chip"><code>GET /v1/health</code> (Healthcheck)</span>
    </div>

    <div class="links-bar">
      <a href="https://rapidapi.com/user/topaisaasdev" target="_blank">⚡ RapidAPI Marketplace</a>
      <a href="https://github.com/topaisaas-dev/web-to-markdown-api" target="_blank">📦 GitHub Repository</a>
      <a href="/v1/health" target="_blank">🩺 Healthcheck</a>
    </div>
  </div>

  <script>
    async function runExtract() {
      const btn = document.getElementById('btn');
      const url = document.getElementById('targetUrl').value.trim();
      if (!url) return;

      btn.innerText = 'Extracting...';
      btn.disabled = true;

      try {
        const start = Date.now();
        const res = await fetch('/v1/extract', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        const elapsed = Date.now() - start;

        document.getElementById('output').style.display = 'block';
        if (data.success) {
          document.getElementById('stats').innerText = '⚡ ' + data.word_count + ' words • ' + data.estimated_tokens + ' tokens • ' + data.leads.emails.length + ' emails found (' + elapsed + ' ms)';
          document.getElementById('md').innerText = data.markdown.slice(0, 1500) + (data.markdown.length > 1500 ? '\n\n... [truncated preview]' : '');
        } else {
          document.getElementById('stats').innerText = '❌ Error: ' + (data.error || 'Failed to extract');
          document.getElementById('md').innerText = JSON.stringify(data, null, 2);
        }
      } catch (err) {
        alert('Extraction failed: ' + err.message);
      } finally {
        btn.innerText = 'Extract Web Page';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`);
});

export default app;
