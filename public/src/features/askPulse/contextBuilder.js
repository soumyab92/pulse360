/**
 * PULSE360 — Context Builder for Grounded RAG
 * Formats real telemetry, latest test metrics, plan vs reality, and retrieved chunks.
 */

export function buildGroundedContext({
  telemetry,
  metrics,
  planAudit,
  dnsBenchmarks,
  history,
  retrievedChunks
}) {
  return {
    telemetry: {
      ip: telemetry?.ip || 'Protected / Masked',
      isp: telemetry?.isp || 'Cloudflare Anycast Backbone',
      asn: telemetry?.asn || 'AS13335 (Cloudflare)',
      colo: telemetry?.colo || 'EDGE',
      city: telemetry?.city || 'Global Edge Node',
      protocol: `${telemetry?.httpVersion || 'HTTP/2'} • ${telemetry?.tlsVersion || 'TLSv1.3'}`
    },
    latest_metrics: {
      download_mbps: metrics?.download || 0,
      upload_mbps: metrics?.upload || 0,
      ping_ms: metrics?.latency || 0,
      jitter_ms: metrics?.jitter || 0,
      loss_pct: metrics?.packetLoss || 0,
      bufferbloat_grade: metrics?.bufferbloat?.grade || 'B',
      worst_delta_ms: metrics?.bufferbloat?.worstDelta || 0
    },
    plan_audit: {
      promised_down: planAudit?.promisedDown || 0,
      promised_up: planAudit?.promisedUp || 0,
      delivered_ratio_pct: planAudit?.deliveredRatio || 0,
      deficit_mbps: planAudit?.deficit || 0
    },
    dns_benchmarks: (dnsBenchmarks || []).map(d => ({
      provider: d.name || d.provider,
      time_ms: d.timeMs,
      fastest: !!d.isFastest
    })),
    recent_history: (history || []).slice(0, 3).map(h => ({
      date: h.dateStr,
      down: h.download,
      up: h.upload,
      ping: h.latency
    })),
    retrieved_knowledge: (retrievedChunks || []).map(c => ({
      source: `${c.file}#${c.heading}`,
      heading: c.heading,
      content: c.content,
      similarity: Math.round((c.score || 0) * 100) / 100
    }))
  };
}

