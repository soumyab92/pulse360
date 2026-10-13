# DNS Resolution & Public Resolvers

> PLACEHOLDER FILE: Technical reference for DNS over HTTPS (DoH), resolver latency, and initial page load overhead.

## The Role of DNS in Connection Responsiveness

Domain Name System (DNS) translates human-friendly hostnames (like `cloudflare.com`) into routable IP addresses.
Every new web connection begins with a DNS lookup. If your DNS resolution takes 90ms, every single new website or API endpoint you visit will experience a mandatory 90ms delay before TCP/TLS handshakes can even start.

## Public Resolvers Compared

1. **Cloudflare DNS (`1.1.1.1`)**: Emphasizes minimal latency through Cloudflare's massive Anycast network across 300+ global cities, alongside strict zero-logging privacy policies.
2. **Google Public DNS (`8.8.8.8`)**: High reliability, vast global infrastructure, fast cache population for popular worldwide services.
3. **Quad9 Privacy DNS (`9.9.9.9`)**: Non-profit Swiss foundation that blocks known malicious domains (phishing, malware) at the DNS level while maintaining strong data privacy protections.

## DNS over HTTPS (DoH) vs Plain DNS

Traditional DNS transmits queries unencrypted over UDP port 53, allowing local ISPs and network observers to track domain browsing habits.
DoH encrypts DNS queries inside standard HTTPS traffic (port 443), protecting against tampering, ISP eavesdropping, and DNS hijacking.
PULSE360 measures true browser-level round-trip DoH response times directly against authoritative endpoints.

