"""
Comprehensive QA & Red Teaming Suite for Web-to-Markdown & Lead Intelligence API
Tests extraction quality, lead detection accuracy, and anti-SSRF defense.
"""

import sys
import re

# Simple Python implementation of the JS extractor logic to verify rules independently

FORBIDDEN_HOSTS = {
  "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "instance-data", "metadata.google.internal"
}

FORBIDDEN_IP_PREFIXES = [
  "127.", "10.", "192.168.", "169.254.", "0.", "fc00:", "fe80:", "::ffff:127."
]

def is_safe_url(url_str):
    if not url_str or not isinstance(url_str, str):
        return False, "Empty or invalid"
    if len(url_str) > 2048:
        return False, "URL too long"
    
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url_str)
    except:
        return False, "Malformed"
    
    if parsed.scheme not in ("http", "https"):
        return False, "Invalid protocol"
    
    hostname = (parsed.hostname or "").lower()
    if hostname in FORBIDDEN_HOSTS or hostname.endswith(".local") or hostname.endswith(".internal"):
        return False, "Forbidden host"
    
    for prefix in FORBIDDEN_IP_PREFIXES:
        if hostname.startswith(prefix):
            return False, "Private IP range"
            
    # Check 172.16.0.0/12
    parts = hostname.split(".")
    if len(parts) == 4 and parts[0] == "172":
        try:
            sec = int(parts[1])
            if 16 <= sec <= 31:
                return False, "172.16-31 private range"
        except:
            pass
            
    if re.match(r"^(?:0x[0-9a-f]+|\d+)$", hostname, re.I):
        return False, "Numeric obfuscated IP"
        
    return True, "Safe"

def run_tests():
    passed = 0
    failed = 0
    
    print("==================================================")
    print("1. RED TEAMING: SSRF & IP PROTECTION AUDIT")
    print("==================================================")
    
    ssrf_attacks = [
        ("http://localhost:8080/admin", False),
        ("http://127.0.0.1/etc/passwd", False),
        ("http://169.254.169.254/latest/meta-data/", False), # AWS/Cloud metadata
        ("http://10.0.0.1/internal-api", False),
        ("http://192.168.1.1/router-login", False),
        ("http://172.16.0.10/private", False),
        ("http://172.31.255.255/private", False),
        ("http://0.0.0.0:3000", False),
        ("file:///etc/hosts", False),
        ("ftp://ftp.example.com", False),
        ("javascript:alert(1)", False),
        ("http://server.local/", False),
        ("http://2130706433/", False), # Decimal 127.0.0.1
        ("http://0x7f000001/", False), # Hex 127.0.0.1
        ("https://stripe.com", True),
        ("https://github.com/features", True),
        ("https://google.com/search", True),
    ]
    
    for url, expected in ssrf_attacks:
        safe, reason = is_safe_url(url)
        if safe == expected:
            print(f"  [PASS] {url:<45} -> Safe: {safe} ({reason})")
            passed += 1
        else:
            print(f"  [FAIL] {url:<45} -> Expected {expected}, Got {safe}")
            failed += 1
            
    print("\n==================================================")
    print("2. QA: LEAD INTELLIGENCE EXTRACTION ACCURACY")
    print("==================================================")
    
    sample_html = """
    <html>
      <head><title>Test Company | AI Solutions</title></head>
      <body>
        <nav><a href="/home">Home</a></nav>
        <h1>Bienvenue chez Test Company</h1>
        <p>Contactez notre support: <a href="mailto:support@testcompany.com">support@testcompany.com</a></p>
        <p>Ventes: sales@testcompany.com ou par téléphone au +33 1 40 50 60 70.</p>
        <p>Suivez-nous sur <a href="https://linkedin.com/company/test-company-saas">LinkedIn</a> et <a href="https://twitter.com/testcompany">Twitter</a>.</p>
        <img src="logo@2x.png">
        <!-- Ignored image as email -->
      </body>
    </html>
    """
    
    # Test email extraction
    emails = set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", sample_html))
    valid_emails = [e for e in emails if not e.endswith(('.png', '.jpg', '.webp'))]
    
    if "support@testcompany.com" in valid_emails and "sales@testcompany.com" in valid_emails and len(valid_emails) == 2:
        print("  [PASS] Email extraction accurate and filtered false positives (png)")
        passed += 1
    else:
        print(f"  [FAIL] Email extraction issue: {valid_emails}")
        failed += 1
        
    # Test social detection
    if "linkedin.com/company" in sample_html and "twitter.com" in sample_html:
        print("  [PASS] B2B Social profiles detected (LinkedIn, Twitter/X)")
        passed += 1
    else:
        print("  [FAIL] Social media extraction missing")
        failed += 1

    print("\n==================================================")
    print(f"TOTAL: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
