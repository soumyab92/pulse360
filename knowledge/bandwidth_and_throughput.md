# Bandwidth, Throughput & Application Demands

> PLACEHOLDER FILE: Technical reference for download/upload asymmetry, streaming bitrates, and transfer dynamics.

## Bandwidth vs Real Throughput

Bandwidth is the maximum theoretical capacity of the link. Throughput is the actual volume of payload data successfully transferred per unit of time after accounting for protocol overhead (TCP headers, TLS encryption, ACK packet delays, and congestion control).

## Asymmetric vs Symmetric Connections

- **Cable / DOCSIS**: Often highly asymmetric (e.g. 300 Mbps download, but only 10 to 20 Mbps upload). In asymmetric connections, saturated uploads can strangle download performance because TCP ACK acknowledgment packets get delayed in outbound queues.
- **Fiber to the Home (FTTH)**: Typically symmetric (e.g. 300 Mbps download and 300 Mbps upload), offering optimal headroom for concurrent cloud synchronization, live streaming, and high-quality video calls.

## Application Bitrate Benchmarks

- **4K HDR Streaming (Netflix/YouTube/Apple TV)**: Requires 25 Mbps to 35 Mbps sustained bandwidth per stream.
- **1080p60 Video Conferencing (Zoom/Teams)**: Requires 3 Mbps to 5 Mbps up and down.
- **Competitive Multiplayer (Valorant/CS2)**: Requires very low bandwidth (~1 Mbps to 2 Mbps), but demands sub-20ms latency and sub-3ms jitter.
- **Cloud Backup (Google Drive, iCloud, OneDrive)**: Benefit dramatically from upload speeds >= 50 Mbps. A 10 GB file takes ~27 minutes at 50 Mbps, but over 2.2 hours at 10 Mbps.

