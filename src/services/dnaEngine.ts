import { NetworkDnaScores, BufferbloatStats, DnsBenchmark } from '../types';

export function calculateNetworkDna(
  downloadMbps: number,
  uploadMbps: number,
  idleLatency: number,
  jitter: number,
  packetLoss: number,
  bufferbloat: BufferbloatStats,
  dnsBenchmarks: DnsBenchmark[]
): NetworkDnaScores {
  // 1. Speed (Download) 0 - 100
  // 1 Mbps -> 20, 25 Mbps -> 55, 100 Mbps -> 80, 500 Mbps -> 95, 1000 Mbps -> 100
  let speedScore = 20;
  if (downloadMbps > 0) {
    const logVal = Math.log10(Math.max(1, downloadMbps)); // 0 to 3 for 1 to 1000 Mbps
    speedScore = Math.min(100, Math.round(15 + (logVal / 3) * 85));
  }

  // 2. Upload 0 - 100
  // 1 Mbps -> 15, 10 Mbps -> 50, 50 Mbps -> 80, 200 Mbps -> 95, 1000 Mbps -> 100
  let uploadScore = 15;
  if (uploadMbps > 0) {
    const logUp = Math.log10(Math.max(1, uploadMbps));
    uploadScore = Math.min(100, Math.round(10 + (logUp / 2.7) * 90));
  }

  // 3. Latency 0 - 100
  // <10ms -> 100, 25ms -> 85, 50ms -> 65, 100ms -> 40, >250ms -> 10
  let latencyScore = 40;
  if (idleLatency > 0) {
    if (idleLatency <= 8) latencyScore = 100;
    else if (idleLatency <= 20) latencyScore = 95 - (idleLatency - 8) * 0.8;
    else if (idleLatency <= 50) latencyScore = 85 - (idleLatency - 20) * 0.7;
    else if (idleLatency <= 120) latencyScore = 64 - (idleLatency - 50) * 0.4;
    else latencyScore = Math.max(10, 36 - (idleLatency - 120) * 0.15);
  }
  latencyScore = Math.round(latencyScore);

  // 4. Stability 0 - 100 (Jitter + Packet Loss)
  let stabilityScore = 95;
  stabilityScore -= Math.min(40, jitter * 4); // each ms jitter costs 4 pts
  stabilityScore -= Math.min(50, packetLoss * 10); // each % packet loss costs 10 pts
  stabilityScore = Math.max(10, Math.min(100, Math.round(stabilityScore)));

  // 5. Bufferbloat 0 - 100
  const bloatMap: Record<string, number> = {
    'A+': 100,
    'A': 90,
    'B': 74,
    'C': 54,
    'D': 35,
    'F': 15
  };
  const bufferbloatScore = bloatMap[bufferbloat.grade] || 60;

  // 6. DNS 0 - 100
  // Find fastest DNS time
  const successfulDns = dnsBenchmarks.filter(d => d.status === 'success' && d.timeMs !== null);
  let fastestDns = 35;
  if (successfulDns.length > 0) {
    fastestDns = Math.min(...successfulDns.map(d => d.timeMs!));
  }
  let dnsScore = 80;
  if (fastestDns <= 12) dnsScore = 100;
  else if (fastestDns <= 25) dnsScore = 92;
  else if (fastestDns <= 50) dnsScore = 80;
  else if (fastestDns <= 90) dnsScore = 65;
  else dnsScore = Math.max(20, Math.round(50 - (fastestDns - 90) * 0.2));

  // Composite weighted score
  const compositeScore = Math.round(
    speedScore * 0.25 +
    uploadScore * 0.15 +
    latencyScore * 0.20 +
    stabilityScore * 0.15 +
    bufferbloatScore * 0.15 +
    dnsScore * 0.10
  );

  return {
    speed: speedScore,
    upload: uploadScore,
    latency: latencyScore,
    stability: stabilityScore,
    bufferbloat: bufferbloatScore,
    dns: dnsScore,
    compositeScore
  };
}

