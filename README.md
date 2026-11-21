# 🚀 Universal Web-to-Markdown & B2B Lead Intelligence API

High-performance, edge-accelerated API designed specifically for **AI Agents, LLM RAG pipelines, and B2B Automation Workflows (Make.com, n8n, Zapier)**.

Convert any webpage into clean, noise-free, token-optimized **Markdown** while simultaneously extracting **business leads (emails, phone numbers, social networks)** in under 200 milliseconds.

---

## Quick Try in 5 Seconds (Zero Signup)

Test the live `topaigateway.com` edge endpoint right now with zero API key:

```bash
# Clean Web-to-Markdown Extraction
curl -s -X POST https://topaigateway.com/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Compress extracted Markdown tokens before RAG/LLM calls
curl -s -X POST https://topaigateway.com/v1/compress \
  -H "Content-Type: application/json" \
  -d '{"text":"Sample extracted documentation paragraph with redundant whitespace."}'

# Heal malformed scraped JSON blocks
curl -s -X POST https://topaigateway.com/v1/api/12-json-surgeon \
  -H "Content-Type: application/json" \
  -d '{"broken_json":"{\"title\": \"Example\",}"}'
```

- **Live Sample n8n Workflow**: [topai-n8n-starter.json](https://topaigateway.com/samples/topai-n8n-starter.json?utm_source=github&utm_campaign=web-to-markdown-api)
- **Live Sample Cursor Rules**: [topai-cursor-rules.txt](https://topaigateway.com/download/samples/topai-cursor-rules.txt?utm_source=github&utm_campaign=web-to-markdown-api)

---

## ⚡ Key Highlights
- **Zero Token Waste** : Strips 100% of non-content clutter (scripts, styles, cookie banners, navigation boilerplate, ads).
- **Automated B2B Lead Intelligence** : Automatically surfaces verified email addresses, phone numbers, and social links (LinkedIn, Twitter/X, GitHub, Instagram).
- **Built-in Bot Bypass** : Uses modern Chrome fingerprints and header rotation to read pages without Cloudflare/anti-bot blocks.
- **SSRF & Security Shield** : Protected against internal network attacks and abusive payloads.
- **Global Edge Architecture** : Powered by Cloudflare Workers serverless edge with sub-5ms cold start.

---

## 📖 Endpoints

### 1. `POST /v1/extract`
Extracts Markdown and Leads from a target website.

**Request Body:**
```json
{
  "url": "https://stripe.com",
  "extract_leads": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "url": "https://stripe.com",
  "metadata": {
    "title": "Stripe | Financial Infrastructure for the Internet",
    "description": "Online payment processing for internet businesses.",
    "favicon": "https://stripe.com/favicon.ico"
  },
  "markdown": "# Stripe\n\nFinancial infrastructure for the internet...",
  "word_count": 850,
  "estimated_tokens": 1120,
  "leads": {
    "emails": ["support@stripe.com"],
    "phones": ["+1 888 963 8872"],
    "socials": {
      "twitter": "https://twitter.com/stripe",
      "linkedin": "https://linkedin.com/company/stripe",
      "github": "https://github.com/stripe"
    }
  },
  "execution_time_ms": 165
}
```

---

## 💻 Code Examples

### cURL
```bash
curl -X POST https://web-to-markdown-api.topaisaas.workers.dev/v1/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://news.ycombinator.com"}'
```

### Python
```python
import requests

response = requests.post(
    "https://web-to-markdown-api.topaisaas.workers.dev/v1/extract",
    json={"url": "https://github.com/features", "extract_leads": True}
)

data = response.json()
print("Clean Markdown:\n", data["markdown"][:300])
print("Leads Found:", data["leads"])
```

### JavaScript / Node.js
```javascript
const res = await fetch("https://web-to-markdown-api.topaisaas.workers.dev/v1/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://stripe.com" })
});
const data = await res.json();
console.log(data);
```

---

---

## Toolkits & Plans (100% USD · Zero Subscription Lock-In)

All toolkits include our **14-Day No-Questions-Asked Money-Back Guarantee** and instant key/download delivery:

| Toolkit / Plan | Price | What You Get | Direct USD Checkout |
|:---|:---|:---|:---|
| **Pack 1: DevEx & FinOps** | **$0** (7-Day Free Trial, then $14/mo) | 101 Edge APIs · 10,000 req/mo · Rollover quota | [Start $0 Free Trial](https://topaigateway.com/checkout?pack=pack_1_devex&direct=true&utm_source=github&utm_medium=readme&utm_campaign=web-to-markdown-api) |
| **n8n & Make Super-Pack** | **$19** one-time (Lifetime) | 50 turnkey automation workflows + full JSON pack | [Get $19 Super-Pack](https://topaigateway.com/checkout?pack=bundle_n8n_make&direct=true&utm_source=github&utm_medium=readme&utm_campaign=web-to-markdown-api) |
| **Runaway Token Breaker** | **$29** one-time (Lifetime) | AST pruning optimizer + sub-1ms runaway cost guardrails | [Get $29 Token Breaker](https://topaigateway.com/checkout?pack=runaway_token_breaker&direct=true&utm_source=github&utm_medium=readme&utm_campaign=web-to-markdown-api) |
| **Cursor & Claude Harness Kit** | **$49** one-time (Lifetime) | 169 agent harness tools + multi-stack `.cursorrules` & MCP | [Get $49 Harness Kit](https://topaigateway.com/checkout?pack=bundle_cursor_harness&direct=true&utm_source=github&utm_medium=readme&utm_campaign=web-to-markdown-api) |

- **Free Interactive Sample Hubs**: [Download Starter n8n Workflow JSON](https://topaigateway.com/samples/topai-n8n-starter.json?utm_source=github&utm_campaign=web-to-markdown-api) · [Download Starter `.cursorrules` Pack](https://topaigateway.com/download/samples/topai-cursor-rules.txt?utm_source=github&utm_campaign=web-to-markdown-api)
- **Native MCP Server (npm)**: `npx -y @topaisaas/mcp-server`
