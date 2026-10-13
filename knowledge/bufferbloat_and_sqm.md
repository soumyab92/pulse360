# Bufferbloat & Smart Queue Management (SQM)

> PLACEHOLDER FILE: Technical reference for queue latency, bufferbloat grading, and router queue management.

## Understanding Bufferbloat

Bufferbloat is the undesirable latency introduced when network equipment buffers excessive amounts of data during high-bandwidth transfers. 
When buffers are too large and unmanaged, packets wait in line for hundreds of milliseconds.
While raw download speeds look high, real-time interactive traffic (like voice calls, Zoom, Discord, and competitive gaming) suffers severe lag spikes, jitter, and rubberbanding.

## Bufferbloat Grading Thresholds

PULSE360 evaluates bufferbloat by comparing idle round-trip latency against loaded latency during simultaneous throughput saturation.
The delta is calculated as: `Worst Delta = Max(Loaded Latency Down - Idle Latency, Loaded Latency Up - Idle Latency)`.

- **Grade A+ (Delta <= 5ms)**: Flawless buffer management. No measurable latency penalty under saturation.
- **Grade A (Delta <= 30ms)**: Excellent buffer control. Minor latency rise, negligible impact on voice or games.
- **Grade B (Delta <= 65ms)**: Moderate buffer queueing. Real-time tasks remain mostly stable.
- **Grade C (Delta <= 130ms)**: Noticeable bufferbloat. Gaming ping spikes and voice glitches will occur when a large file download starts.
- **Grade D (Delta <= 240ms)**: High bufferbloat. Router buffers are overflowing; severe hitches during transfers.
- **Grade F (Delta > 240ms)**: Critical bufferbloat. Calls disconnect, multiplayer games desync.

## Remediation: Enabling SQM on Routers

The definitive solution to bufferbloat is **Smart Queue Management (SQM)**:
1. Log into your router's administrative dashboard (e.g. OpenWrt, AsusWRT-Merlin, Ubiquiti UniFi, pfSense/OPNsense, eero).
2. Enable SQM or modern QoS algorithms:
   - **CAKE (Common Applications Kept Enhanced)**: The most advanced modern queuing discipline. Automatically isolates packet flows and prevents high-bandwidth flows from starving latency-sensitive traffic.
   - **FQ-CoDel (Fair Queueing Controlled Delay)**: Excellent queue scheduler available on most modern routers.
3. Configure the bandwidth queue limits to **90% to 95%** of your verified ISP line speed. By capping the queue slightly below the modem's physical bottleneck, your router retains control of the queue rather than the unmanaged ISP modem buffer.

