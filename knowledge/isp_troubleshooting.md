# ISP Service Level Agreements & Dispute Evidence

> PLACEHOLDER FILE: Technical reference for Plan vs Reality analysis, peak congestion hours, and ISP complaint letters.

## Contracted Plan vs Actual Delivered Throughput

Internet Service Providers advertise speeds with qualifiers like "up to X Mbps". However, regulatory bodies (FCC, Ofcom, TRAI) require broadband providers to consistently deliver a reasonable percentage of advertised speeds during peak hours.
- **>= 90% Delivered**: ISP is operating within contractual commitments.
- **70% to 89%**: Noticeable degradation, frequently during peak neighborhood utilization hours (8 PM - 11 PM).
- **< 70% Delivered**: Substantial service breach. Legitimate grounds for billing escalation, credit requests, or formal complaints.

## Peak-Hour Congestion Signatures

When neighborhood aggregation nodes or local optical splitters are oversubscribed, speeds drop and jitter surges during evening leisure hours.
Tracking measurements across a 24-hour cycle provides definitive evidence of ISP oversubscription versus local home network hardware faults.

## Elements of an Effective ISP Dispute Letter

To resolve performance disputes with ISP support tiers, provide:
1. **Account Identification**: Account number and registered customer name.
2. **Subscription Tier**: Promised downstream and upstream bandwidth.
3. **Objective Diagnostic Evidence**: Measured average download, upload, and latency across multiple verified test runs.
4. **Test Server Details**: Measurement point (Cloudflare Anycast edge point of presence, Colo code, IP, and timestamp).
5. **Clear Demand**: Request for line inspection, technician visit to verify signal-to-noise ratio (SNR), or account credit for unfulfilled service tiers.

