# 🚀 Universal Web-to-Markdown & B2B Lead Intelligence API

High-performance, edge-accelerated API designed specifically for **AI Agents, LLM RAG pipelines, and B2B Automation Workflows (Make.com, n8n, Zapier)**.

Convert any webpage into clean, noise-free, token-optimized **Markdown** while simultaneously extracting **business leads (emails, phone numbers, social networks)** in under 200 milliseconds.

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

## 💰 Recommended RapidAPI Pricing Tiers

1. **Free Tier (Freemium)** : 50 requests / month ($0.00) — Perfect for developers testing their agent pipelines.
2. **Starter Tier** : 2,500 requests / month ($19.00 / mo) — For indie hackers and single-agent workflows.
3. **Pro Tier (Most Popular)** : 10,000 requests / month ($49.00 / mo) — For B2B agencies and automated scrapers.
4. **Agency / Ultra Tier** : 50,000 requests / month ($149.00 / mo) — For high-volume SaaS applications.
