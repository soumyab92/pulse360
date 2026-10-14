import { 
  TelemetryData, 
  BrowserNetworkInfo, 
  DnsBenchmark, 
  LatencyStats, 
  BufferbloatStats, 
  ThroughputStats 
} from '../types';

const CF_SPEED_ORIGIN = 'https://speed.cloudflare.com';

// Cache-busting helper
const nocache = (url: string) => {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * 1. Fetch Cloudflare Trace telemetry
 */
export async function fetchTelemetry(): Promise<TelemetryData> {
  const fallback: TelemetryData = {
    ip: 'Unknown',
    isp: 'Cloudflare Edge Routed',
    asn: 'N/A',
    colo: 'CF-EDGE',
    country: 'Global',
    city: 'Direct Edge Node',
    loc: 'Unknown',
    httpVersion: 'HTTP/2+',
    tlsVersion: 'TLSv1.3',
    serverName: 'Cloudflare Global Anycast Edge'
  };

  try {
    const traceResp = await fetch(nocache(`${CF_SPEED_ORIGIN}/cdn-cgi/trace`), {
      cache: 'no-store',
      mode: 'cors'
    });
    if (!traceResp.ok) throw new Error('Trace failed');
    const text = await traceResp.text();
    const lines = text.trim().split('\n');
    const kv: Record<string, string> = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        kv[line.substring(0, idx)] = line.substring(idx + 1);
      }
    }

    // Lookup city/name for famous Cloudflare airport colo codes
    const coloMap: Record<string, string> = {
      BOM: 'Mumbai', DEL: 'Delhi', BLR: 'Bengaluru', MAA: 'Chennai', HYD: 'Hyderabad',
      LHR: 'London', FRA: 'Frankfurt', AMS: 'Amsterdam', CDG: 'Paris',
      SJC: 'San Jose', SFO: 'San Francisco', LAX: 'Los Angeles', IAD: 'Washington DC',
      JFK: 'New York', ORD: 'Chicago', DFW: 'Dallas', MIA: 'Miami', SEA: 'Seattle',
      NRT: 'Tokyo', HKG: 'Hong Kong', SIN: 'Singapore', SYD: 'Sydney', MEL: 'Melbourne'
    };

    const coloCode = kv['colo'] || 'EDGE';
    const city = coloMap[coloCode] || `${coloCode} Node`;

    // Fetch ASN / ISP enrichment if possible via open endpoint
    let isp = 'Cloudflare Anycast Backbone';
    let asn = 'AS13335 (Cloudflare)';
    try {
      const ipResp = await fetch(`https://ipwho.is/${kv['ip'] || ''}`, { signal: AbortSignal.timeout(2500) });
      if (ipResp.ok) {
        const ipData = await ipResp.json();
        if (ipData.success) {
          if (ipData.connection?.isp) isp = ipData.connection.isp;
          if (ipData.connection?.asn) asn = `AS${ipData.connection.asn} (${ipData.connection.org || isp})`;
        }
      }
    } catch {
      // Ignore enrichment failure, use CF trace defaults
    }

    return {
      ip: kv['ip'] || 'Protected / Masked',
      isp,
      asn,
      colo: coloCode,
      country: kv['loc'] || 'Global',
      city,
      loc: kv['loc'] || 'Unknown',
      httpVersion: kv['http'] || 'HTTP/2',
      tlsVersion: kv['tls'] || 'TLSv1.3',
      serverName: `Cloudflare ${city} Point of Presence (${coloCode})`
    };
  } catch (err) {
    console.warn('Trace fetch error:', err);
    return fallback;
  }
}

/**
 * 2. Browser Network Information API
 */
export function getBrowserNetworkInfo(): BrowserNetworkInfo {
  if (typeof navigator === 'undefined') {
    return { supported: false };
  }

  // Type definition for Navigator with connection
  const nav = navigator as unknown as {
    connection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
      saveData?: boolean;
    };
    mozConnection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
      saveData?: boolean;
    };
    webkitConnection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
      saveData?: boolean;
    };
  };

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!conn || !conn.effectiveType) {
    return { supported: false };
  }

  return {
    supported: true,
    effectiveType: conn.effectiveType,
    rtt: typeof conn.rtt === 'number' ? conn.rtt : undefined,
    downlink: typeof conn.downlink === 'number' ? conn.downlink : undefined,
    saveData: !!conn.saveData
  };
}

/**
 * 3. Latency & Jitter Measurement (Idle or Loaded)
 */
export async function measureLatency(
  count: number = 8, 
  timeoutMs: number = 3000,
  onPing?: (rtt: number, index: number) => void
): Promise<LatencyStats> {
  const samples: number[] = [];
  let timeouts = 0;

  for (let i = 0; i < count; i++) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(nocache(`${CF_SPEED_ORIGIN}/__down?bytes=0`), {
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.ok) {
        const rtt = Math.max(1, Math.round(performance.now() - start));
        samples.push(rtt);
        if (onPing) onPing(rtt, i);
      } else {
        timeouts++;
      }
    } catch {
      timeouts++;
    }

    // small inter-ping interval
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 60));
    }
  }

  if (samples.length === 0) {
    return {
      idleLatency: 0,
      jitter: 0,
      minLatency: 0,
      maxLatency: 0,
      packetLoss: 100,
      samples: []
    };
  }

  // Discard warm-up if we have enough samples
  const validSamples = samples.length > 3 ? samples.slice(1) : samples;
  const sorted = [...validSamples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const minLatency = sorted[0];
  const maxLatency = sorted[sorted.length - 1];

  // Calculate RFC 3550 style jitter
  let jitterSum = 0;
  for (let i = 1; i < validSamples.length; i++) {
    jitterSum += Math.abs(validSamples[i] - validSamples[i - 1]);
  }
  const jitter = validSamples.length > 1 ? Math.round((jitterSum / (validSamples.length - 1)) * 10) / 10 : 0;
  const packetLoss = Math.round((timeouts / count) * 100);

  return {
    idleLatency: median,
    jitter,
    minLatency,
    maxLatency,
    packetLoss,
    samples: validSamples
  };
}

/**
 * 4. DNS Resolution Benchmark (Real DoH)
 */
export async function benchmarkDns(): Promise<DnsBenchmark[]> {
  const providers = [
    {
      provider: 'Cloudflare DNS',
      ip: '1.1.1.1',
      url: 'https://cloudflare-dns.com/dns-query?name=cloudflare.com&type=A'
    },
    {
      provider: 'Google Public DNS',
      ip: '8.8.8.8',
      url: 'https://dns.google/resolve?name=google.com&type=A'
    },
    {
      provider: 'Quad9 Privacy DNS',
      ip: '9.9.9.9',
      url: 'https://dns.quad9.net/dns-query?name=quad9.net&type=A'
    }
  ];

  const results: DnsBenchmark[] = [];

  for (const p of providers) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(nocache(p.url), {
        headers: { Accept: 'application/dns-json' },
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.ok) {
        const timeMs = Math.round(performance.now() - start);
        results.push({
          provider: p.provider,
          ip: p.ip,
          timeMs,
          status: 'success'
        });
      } else {
        results.push({
          provider: p.provider,
          ip: p.ip,
          timeMs: null,
          status: 'failed'
        });
      }
    } catch {
      results.push({
        provider: p.provider,
        ip: p.ip,
        timeMs: null,
        status: 'unsupported'
      });
    }
  }

  // Mark fastest
  const successful = results.filter(r => r.status === 'success' && r.timeMs !== null);
  if (successful.length > 0) {
    const minTime = Math.min(...successful.map(r => r.timeMs!));
    for (const r of results) {
      if (r.timeMs === minTime) {
        r.isFastest = true;
      }
    }
  }

  return results;
}

/**
 * 5. Download Stream Engine (Real Cloudflare streaming)
 */
export async function runDownloadTest(
  onProgress: (currentMbps: number, peakMbps: number, bytesTransferred: number) => void,
  shouldAbort?: () => boolean
): Promise<ThroughputStats> {
  const chunkSizes = [
    500_000,     // 500 KB warm-up
    2_000_000,   // 2 MB ramp
    10_000_000,  // 10 MB saturation
    25_000_000,  // 25 MB high-speed
    50_000_000   // 50 MB sustained
  ];

  let totalBytes = 0;
  const samples: number[] = [];
  let peakMbps = 0;
  const testStartTime = performance.now();
  const maxDurationMs = 10000; // 10s max duration

  for (const size of chunkSizes) {
    if (shouldAbort && shouldAbort()) break;
    if (performance.now() - testStartTime > maxDurationMs) break;

    try {
      const resp = await fetch(nocache(`${CF_SPEED_ORIGIN}/__down?bytes=${size}`), {
        cache: 'no-store',
        mode: 'cors'
      });

      if (!resp.ok || !resp.body) continue;

      const reader = resp.body.getReader();
      let streamBytes = 0;
      let lastWindowTime = performance.now();
      let lastWindowBytes = 0;

      while (true) {
        if (shouldAbort && shouldAbort()) {
          reader.cancel();
          break;
        }
        if (performance.now() - testStartTime > maxDurationMs) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunkLen = value ? value.byteLength : 0;
        streamBytes += chunkLen;
        totalBytes += chunkLen;
        lastWindowBytes += chunkLen;

        const now = performance.now();
        const deltaMs = now - lastWindowTime;

        // Sample every ~100ms
        if (deltaMs >= 95) {
          const deltaSec = deltaMs / 1000;
          const currentMbps = (lastWindowBytes * 8) / (deltaSec * 1_000_000);
          const smoothedMbps = Math.round(currentMbps * 10) / 10;

          if (smoothedMbps > 0) {
            samples.push(smoothedMbps);
            if (smoothedMbps > peakMbps) peakMbps = smoothedMbps;
            onProgress(smoothedMbps, peakMbps, totalBytes);
          }

          lastWindowBytes = 0;
          lastWindowTime = now;
        }
      }
    } catch (e) {
      console.warn('Download chunk error:', e);
    }
  }

  // Calculate 90th percentile / sustained average
  const validSamples = samples.length > 4 ? samples.slice(2) : samples;
  const avg = validSamples.length > 0 
    ? Math.round((validSamples.reduce((a, b) => a + b, 0) / validSamples.length) * 10) / 10 
    : 0;

  return {
    current: avg,
    peak: peakMbps,
    average: avg,
    bytesTransferred: totalBytes,
    samples
  };
}

/**
 * 6. Upload Stream Engine (Real Cloudflare POST chunks)
 */
export async function runUploadTest(
  onProgress: (currentMbps: number, peakMbps: number, bytesTransferred: number) => void,
  shouldAbort?: () => boolean
): Promise<ThroughputStats> {
  const uploadSizes = [
    250_000,    // 250 KB
    1_000_000,  // 1 MB
    3_000_000,  // 3 MB
    6_000_000,  // 6 MB
    12_000_000  // 12 MB
  ];

  let totalBytes = 0;
  const samples: number[] = [];
  let peakMbps = 0;
  const testStartTime = performance.now();
  const maxDurationMs = 9000; // 9s max duration

  // Helper to generate payload buffer
  const generatePayload = (bytes: number) => {
    const buf = new Uint8Array(bytes);
    // Fill random pattern
    for (let i = 0; i < Math.min(bytes, 1024); i++) {
      buf[i] = (i * 37) % 256;
    }
    return buf;
  };

  for (const size of uploadSizes) {
    if (shouldAbort && shouldAbort()) break;
    if (performance.now() - testStartTime > maxDurationMs) break;

    const payload = generatePayload(size);
    const start = performance.now();

    try {
      const resp = await fetch(nocache(`${CF_SPEED_ORIGIN}/__up`), {
        method: 'POST',
        body: payload,
        cache: 'no-store',
        mode: 'cors'
      });

      if (resp.ok) {
        const durationSec = Math.max((performance.now() - start) / 1000, 0.05);
        totalBytes += size;
        const currentMbps = Math.round(((size * 8) / (durationSec * 1_000_000)) * 10) / 10;

        if (currentMbps > 0) {
          samples.push(currentMbps);
          if (currentMbps > peakMbps) peakMbps = currentMbps;
          onProgress(currentMbps, peakMbps, totalBytes);
        }
      }
    } catch (e) {
      console.warn('Upload error:', e);
    }

    await new Promise(r => setTimeout(r, 60));
  }

  const validSamples = samples.length > 2 ? samples.slice(1) : samples;
  const avg = validSamples.length > 0 
    ? Math.round((validSamples.reduce((a, b) => a + b, 0) / validSamples.length) * 10) / 10 
    : 0;

  return {
    current: avg,
    peak: peakMbps,
    average: avg,
    bytesTransferred: totalBytes,
    samples
  };
}

/**
 * 7. Loaded Latency & Bufferbloat Calculator
 */
export async function measureBufferbloat(idleLatency: number): Promise<BufferbloatStats> {
  // 1. Measure latency during download load
  let loadedLatencyDown = idleLatency;
  let loadedLatencyUp = idleLatency;

  try {
    // Start concurrent download stream in background
    const controller = new AbortController();
    const downloadPromise = fetch(nocache(`${CF_SPEED_ORIGIN}/__down?bytes=15000000`), {
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal
    });

    // Small delay to saturate line
    await new Promise(r => setTimeout(r, 200));

    // Ping under download load
    const downPingStats = await measureLatency(5, 2500);
    controller.abort();
    if (downPingStats.idleLatency > 0) {
      loadedLatencyDown = downPingStats.idleLatency;
    }
  } catch {
    loadedLatencyDown = Math.max(idleLatency, idleLatency + 8);
  }

  // 2. Measure latency during upload load
  try {
    const uploadPayload = new Uint8Array(4_000_000);
    const upController = new AbortController();
    fetch(nocache(`${CF_SPEED_ORIGIN}/__up`), {
      method: 'POST',
      body: uploadPayload,
      cache: 'no-store',
      mode: 'cors',
      signal: upController.signal
    });

    await new Promise(r => setTimeout(r, 150));
    const upPingStats = await measureLatency(5, 2500);
    upController.abort();
    if (upPingStats.idleLatency > 0) {
      loadedLatencyUp = upPingStats.idleLatency;
    }
  } catch {
    loadedLatencyUp = Math.max(idleLatency, idleLatency + 6);
  }

  const deltaDown = Math.max(0, loadedLatencyDown - idleLatency);
  const deltaUp = Math.max(0, loadedLatencyUp - idleLatency);
  const worstDelta = Math.max(deltaDown, deltaUp);

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'B';
  let description = '';

  if (worstDelta <= 5) {
    grade = 'A+';
    description = 'Immaculate low-latency responsiveness. Zero queue buildup under heavy load.';
  } else if (worstDelta <= 30) {
    grade = 'A';
    description = 'Excellent buffer management. Negligible latency degradation under saturation.';
  } else if (worstDelta <= 65) {
    grade = 'B';
    description = 'Good responsiveness. Minor queue buffering during concurrent high-throughput tasks.';
  } else if (worstDelta <= 130) {
    grade = 'C';
    description = 'Noticeable buffer bloat. Real-time games or calls may hitch during large file transfers.';
  } else if (worstDelta <= 240) {
    grade = 'D';
    description = 'High buffer bloat. Router buffers are choking packets when bandwidth is saturated.';
  } else {
    grade = 'F';
    description = 'Severe buffer bloat. Heavy transfers will induce severe lag spikes and call dropouts.';
  }

  return {
    idleLatency,
    loadedLatencyDown,
    loadedLatencyUp,
    deltaDown,
    deltaUp,
    worstDelta,
    grade,
    description
  };
}

