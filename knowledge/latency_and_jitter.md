# Latency, Jitter & Packet Loss Dynamics

> PLACEHOLDER FILE: Technical reference for RFC 3550 jitter, round-trip times, and real-time multiplayer gaming.

## Latency vs Bandwidth

Bandwidth determines how much data can move in a given time window (volume), while latency determines how quickly a packet travels from your client to the destination host and back (speed of light & routing delays).
High bandwidth does not cure high latency. A 1 Gbps connection with 100ms latency will feel much slower for interactive browsing and esports than a 50 Mbps connection with 10ms latency.

## Packet Jitter (RFC 3550 Standard)

Jitter is the variance in latency between successive packets:
`Jitter = Sum(|RTT(i) - RTT(i-1)|) / (N - 1)`.

- **Esports & Competitive Gaming**: Requires sub-3ms jitter. Uneven packet arrival causes desynchronization between player client prediction and the game server authoritative state (peeker's advantage anomalies, missed hit registration).
- **Voice over IP (VoIP) & Video Calls**: Jitter buffers can tolerate up to 20ms to 30ms before introducing robotic audio distortion or dropped syllables.

## Packet Loss Diagnostics

Packet loss indicates packets that failed to reach the destination and required retransmission.
- **0% Loss**: Ideal state.
- **1% to 2% Loss**: Introduces noticeable hitches, web page stalling, and micro-freezes.
- **>3% Loss**: Severe network degradation.
- **Common root causes**: Degraded Ethernet cables, Wi-Fi radio interference (crowded 2.4 GHz bands), overheating optical network terminals (ONT), or ISP upstream routing congestion.

