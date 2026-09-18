import { Hono } from "hono";
import { cors } from "hono/cors";
import { validateSafeUrl, FETCH_TIMEOUT_MS, MAX_CONTENT_LENGTH } from "./security";
import { extractLeads, extractMetadata, htmlToMarkdown, countTokens } from "./extractor";

const app = new Hono();

// Enable Global CORS for developers and client-side applications
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-RapidAPI-Key", "X-RapidAPI-Host"]
}));

// Timing & Observability middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.header("X-Response-Time", `${ms}ms`);
  c.header("X-Powered-By", "TopAI-SaaS-Engine");
});

/**
 * Healthcheck endpoint
 */
app.get("/v1/health", (c) => {
  return c.json({
    status: "healthy",
    service: "web-to-markdown-lead-api",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

/**
 * Core Extraction Handler
 */
async function handleExtraction(c: any, rawUrl: string, options?: { format?: string; extract_leads?: boolean }) {
  const startTime = Date.now();

  // 1. SSRF and URL validation
  const targetUrl = validateSafeUrl(rawUrl);

  // 2. Fetch the target page with Anti-Bot headers and timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(targetUrl.href, {
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
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return c.json({ success: false, error: "Gateway Timeout: Target site took longer than 7s to respond" }, 504);
    }
    return c.json({ success: false, error: `Network error reaching target URL: ${err.message}` }, 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return c.json({
      success: false,
      error: `Target server responded with HTTP status ${response.status} (${response.statusText})`,
      status: response.status
    }, 422);
  }

  // 3. Check content type and size
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
    return c.json({
      success: false,
      error: `Unsupported target content-type '${contentType}'. Only HTML and text documents can be converted to Markdown.`
    }, 415);
  }

  const rawHtml = await response.text();
  if (rawHtml.length > MAX_CONTENT_LENGTH) {
    return c.json({ success: false, error: "Payload Too Large: Target page exceeds 5MB limit" }, 413);
  }

  // 4. Extract data
  const metadata = extractMetadata(rawHtml, targetUrl);
  const markdown = htmlToMarkdown(rawHtml);
  const leads = options?.extract_leads === false ? { emails: [], phones: [], socials: {} } : extractLeads(rawHtml, targetUrl.href);

  const words = markdown.split(/\s+/).filter(Boolean).length;
  const tokens = countTokens(markdown);
  const duration = Date.now() - startTime;

  return c.json({
    success: true,
    url: targetUrl.href,
    metadata,
    markdown,
    word_count: words,
    estimated_tokens: tokens,
    leads,
    execution_time_ms: duration
  });
}

/**
 * POST /v1/extract
 * Body: { "url": "https://example.com", "extract_leads": true }
 */
app.post("/v1/extract", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.url) {
      return c.json({ success: false, error: "Missing required 'url' field in JSON body" }, 400);
    }
    return await handleExtraction(c, body.url, { extract_leads: body.extract_leads !== false });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * GET /v1/extract?url=...
 */
app.get("/v1/extract", async (c) => {
  try {
    const url = c.req.query("url");
    if (!url) {
      return c.json({ success: false, error: "Missing required 'url' query parameter. Example: /v1/extract?url=https://example.com" }, 400);
    }
    const leads = c.req.query("leads") !== "false";
    return await handleExtraction(c, url, { extract_leads: leads });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

/**
 * GET / : Interactive Web Dashboard & Demo
 */
app.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Web-to-Markdown & Lead Intelligence API</title>
  <style>
    :root { --primary: #2563eb; --dark: #0f172a; --bg: #f8fafc; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: #334155; margin: 0; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 860px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    h1 { color: var(--dark); margin-top: 0; font-size: 28px; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; display: inline-block; }
    .card { background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0; border-left: 4px solid var(--primary); }
    input[type="url"] { width: 70%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 15px; }
    button { background: var(--primary); color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
    pre { background: var(--dark); color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; max-height: 400px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
    .stat { background: #fff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">🚀 AI Agent Ready • Ultra-Fast Edge API</span>
    <h1>Universal Web-to-Markdown & B2B Lead Intelligence API</h1>
    <p>Convertissez n'importe quelle page web en <strong>Markdown propre optimisé pour les LLM</strong> et extrayez instantanément les <strong>coordonnées professionnelles</strong> (emails, téléphones, réseaux sociaux).</p>

    <div class="card">
      <h3 style="margin-top:0">⚡ Testez en direct :</h3>
      <div style="display:flex; gap:10px;">
        <input type="url" id="testUrl" value="https://stripe.com" placeholder="https://example.com">
        <button onclick="testExtract()">Extraire</button>
      </div>
      <div id="loader" style="display:none; margin-top:12px; color:var(--primary); font-weight:600;">Extraction en cours sur le Cloudflare Edge...</div>
      <div id="results" style="display:none; margin-top:20px;">
        <div class="grid">
          <div class="stat"><strong>Mots / Tokens :</strong> <span id="statTokens">0</span></div>
          <div class="stat"><strong>Temps d'exécution :</strong> <span id="statTime">0 ms</span></div>
        </div>
        <h4>Contacts détectés :</h4>
        <div id="statLeads" style="background:#fff; border:1px solid #e2e8f0; padding:12px; border-radius:8px;"></div>
        <h4>Aperçu Markdown :</h4>
        <pre id="outputMarkdown"></pre>
      </div>
    </div>

    <h3>📖 Endpoints de l'API</h3>
    <ul>
      <li><code>POST /v1/extract</code> : Extraction principale (JSON body: <code>{"url": "https://..."}</code>)</li>
      <li><code>GET /v1/extract?url=https://...</code> : Extraction rapide par requête GET</li>
      <li><code>GET /v1/health</code> : Vérification de statut et uptime</li>
      <li><code>GET /openapi.json</code> : Spécification OpenAPI 3.0 officielle</li>
    </ul>
  </div>

  <script>
    async function testExtract() {
      const url = document.getElementById('testUrl').value;
      const loader = document.getElementById('loader');
      const results = document.getElementById('results');
      loader.style.display = 'block';
      results.style.display = 'none';

      try {
        const res = await fetch('/v1/extract?url=' + encodeURIComponent(url));
        const data = await res.json();
        loader.style.display = 'none';
        results.style.display = 'block';

        document.getElementById('statTokens').innerText = data.word_count + ' mots (~' + data.estimated_tokens + ' tokens)';
        document.getElementById('statTime').innerText = data.execution_time_ms + ' ms';
        document.getElementById('statLeads').innerHTML = 
          '<strong>Emails :</strong> ' + (data.leads.emails.join(', ') || 'Aucun') + '<br>' +
          '<strong>Téléphones :</strong> ' + (data.leads.phones.join(', ') || 'Aucun') + '<br>' +
          '<strong>Réseaux :</strong> ' + JSON.stringify(data.leads.socials);
        document.getElementById('outputMarkdown').innerText = data.markdown.slice(0, 1500) + (data.markdown.length > 1500 ? '\\n\\n... [Tronqué pour aperçu]' : '');
      } catch (err) {
        loader.style.display = 'none';
        alert('Erreur: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
  return c.html(html);
});

/**
 * GET /openapi.json : OpenAPI 3.0 Specification
 */
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.3",
    info: {
      title: "Universal Web-to-Markdown & Lead Intelligence API",
      version: "1.0.0",
      description: "Fast, token-efficient web content converter for AI agents and RAG pipelines with automated B2B lead detection."
    },
    paths: {
      "/v1/extract": {
        post: {
          summary: "Extract clean Markdown and B2B leads from a URL",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", example: "https://stripe.com" },
                    extract_leads: { type: "boolean", default: true }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: "Successful extraction" },
            400: { description: "Invalid URL or parameters" },
            403: { description: "SSRF forbidden host/IP" }
          }
        },
        get: {
          summary: "Extract clean Markdown from a URL query parameter",
          parameters: [
            { name: "url", in: "query", required: true, schema: { type: "string" } },
            { name: "leads", in: "query", required: false, schema: { type: "boolean", default: true } }
          ],
          responses: {
            200: { description: "Successful extraction" }
          }
        }
      },
      "/v1/health": {
        get: {
          summary: "Service Healthcheck",
          responses: { 200: { description: "Service is operational" } }
        }
      }
    }
  });
});

export default app;
