import { BufferbloatStats, DnsBenchmark, TelemetryData } from '../types';

export interface DiagnosisInsight {
  id: string;
  type: 'critical' | 'warning' | 'tip' | 'success';
  title: string;
  summary: string;
  action: string;
}

export function generateSmartDiagnosis(
  downloadMbps: number,
  uploadMbps: number,
  idleLatency: number,
  jitter: number,
  packetLoss: number,
  bufferbloat: BufferbloatStats,
  dnsBenchmarks: DnsBenchmark[],
  telemetry: TelemetryData | null,
  promisedDown?: number,
  promisedUp?: number
): DiagnosisInsight[] {
  const insights: DiagnosisInsight[] = [];

  // 1. Bufferbloat diagnosis
  if (bufferbloat.worstDelta > 65) {
    insights.push({
      id: 'bufferbloat_warning',
      type: 'warning',
      title: `High Bufferbloat Detected (${bufferbloat.grade} Grade, +${bufferbloat.worstDelta}ms)`,
      summary: `Your raw throughput is solid (${downloadMbps} Mbps), but latency balloons under load. Whenever anyone in your household streams or downloads, video calls will hitch and games will rubberband.`,
      action: 'Log into your router and enable SQM (Smart Queue Management) or CAKE / FQ-CoDel QoS. Limit bandwidth queues to 95% of your line speed to eliminate bufferbloat.'
    });
  } else if (bufferbloat.grade === 'A+' || bufferbloat.grade === 'A') {
    insights.push({
      id: 'bufferbloat_excellent',
      type: 'success',
      title: `Superb Buffer Management (${bufferbloat.grade} Grade)`,
      summary: `Your router buffers barely spike under maximum saturation (+${bufferbloat.worstDelta}ms delta). Real-time gaming and video conferences will remain glitch-free even during heavy torrents or large updates.`,
      action: 'No action required — your network queue configuration is operating at peak efficiency.'
    });
  }

  // 2. High Jitter or Packet Loss
  if (packetLoss > 0) {
    insights.push({
      id: 'packet_loss',
      type: 'critical',
      title: `Active Packet Loss Detected (${packetLoss}%)`,
      summary: 'Dropped packets force TCP retransmissions, creating micro-stutters in video calls, audio drops, and noticeable hit-registration lag in games.',
      action: 'Check for degraded Ethernet cables, router overheating, or Wi-Fi channel crowding. Test directly via a cat6 Ethernet cable to rule out wireless interference.'
    });
  } else if (jitter > 8) {
    insights.push({
      id: 'jitter_warning',
      type: 'warning',
      title: `Elevated Latency Jitter (${jitter}ms)`,
      summary: 'High packet arrival variance usually indicates wireless interference, 2.4 GHz congestion, or competing background local traffic.',
      action: 'Connect via 5GHz or 6GHz Wi-Fi, or switch to direct Ethernet. Avoid wireless repeaters or powerline adapters if possible.'
    });
  }

  // 3. DNS Benchmark Diagnosis
  const successfulDns = dnsBenchmarks.filter(d => d.status === 'success' && d.timeMs !== null);
  if (successfulDns.length > 0) {
    const fastest = successfulDns.reduce((prev, curr) => (curr.timeMs! < prev.timeMs! ? curr : prev));
    if (fastest.timeMs! <= 18) {
      insights.push({
        id: 'dns_fast',
        type: 'success',
        title: `Ultra-Responsive DNS (${fastest.provider} @ ${fastest.timeMs}ms)`,
        summary: `Your DNS query resolution is lightning-fast via ${fastest.provider}. Domain name lookups and initial web page handshakes will resolve instantaneously.`,
        action: 'Your DNS configuration is highly optimized.'
      });
    } else if (fastest.timeMs! > 55) {
      insights.push({
        id: 'dns_slow',
        type: 'tip',
        title: `Sluggish DNS Resolution (${fastest.timeMs}ms)`,
        summary: 'DNS lookups are taking longer than recommended (>50ms). This adds noticeable delay to the beginning of every webpage or app connection.',
        action: 'Configure fast public resolvers such as Cloudflare (1.1.1.1) or Google (8.8.8.8) directly in your router DHCP settings or OS network adapter.'
      });
    }
  }

  // 4. Asymmetric Up/Down Ratio
  if (downloadMbps > 50 && uploadMbps < downloadMbps * 0.1) {
    insights.push({
      id: 'asymmetric_ratio',
      type: 'tip',
      title: 'Severely Asymmetric Connection',
      summary: `Your upload speed (${uploadMbps} Mbps) is less than 10% of your download (${downloadMbps} Mbps). This is typical of legacy cable/DOCSIS connections.`,
      action: 'During large cloud photo/video backups or outbound Zoom streams, your download bandwidth may choke as TCP ACK packets fight for upload bandwidth.'
    });
  }

  // 5. Plan vs Reality Insight
  if (promisedDown && promisedDown > 0) {
    const percentage = Math.round((downloadMbps / promisedDown) * 100);
    if (percentage < 70) {
      insights.push({
        id: 'isp_underdelivering',
        type: 'critical',
        title: `Delivering Only ${percentage}% of Promised Speed`,
        summary: `You pay for ${promisedDown} Mbps but are currently receiving ${downloadMbps} Mbps (${promisedDown - downloadMbps} Mbps missing).`,
        action: 'Test again during off-peak hours (e.g. morning). If consistent, export this PULSE360 diagnostic log and submit a formal ticket with your ISP.'
      });
    } else if (percentage >= 95) {
      insights.push({
        id: 'isp_delivering',
        type: 'success',
        title: `ISP Honoring Contract (${percentage}% Delivered)`,
        summary: `Your connection is reaching ${downloadMbps} Mbps against your advertised ${promisedDown} Mbps subscription.`,
        action: 'Your ISP is fulfilling service level expectations.'
      });
    }
  }

  // 6. Anycast Edge Server
  if (telemetry && telemetry.colo) {
    insights.push({
      id: 'edge_telemetry',
      type: 'tip',
      title: `Routing via ${telemetry.city} Point of Presence (${telemetry.colo})`,
      summary: `Traffic is negotiated via ${telemetry.httpVersion} over ${telemetry.tlsVersion} to Cloudflare edge in ${telemetry.city}.`,
      action: `Your ASN is ${telemetry.asn}. Anycast routing ensures nearest geographic peering.`
    });
  }

  return insights;
}

