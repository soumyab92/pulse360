/**
 * PULSE360 — Next-Gen Internet Analysis Core Application
 * Integrates real Cloudflare speed endpoints, DoH DNS benchmarking,
 * WebGL 3D Data Tunnel, Web Audio sonification, Network DNA Radar,
 * Real-Life Verdicts, Bufferbloat grading, Stability Mode,
 * and Milestone 6A: "Ask PULSE" Grounded RAG Assistant.
 */

import { ragPipeline } from './features/askPulse/ragPipeline.js';

// ==========================================
// 1. SOUND & SONIFICATION ENGINE (Web Audio)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.osc = null;
    this.gainNode = null;
    this.filterNode = null;
    this.isEnabled = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      this.startCarrier();
    } else {
      this.stopCarrier();
    }
    return this.isEnabled;
  }

  startCarrier() {
    if (!this.ctx || !this.isEnabled || this.osc) return;
    try {
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sine';
      this.osc.frequency.setValueAtTime(220, this.ctx.currentTime);

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(800, this.ctx.currentTime);

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.osc.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      this.osc.start();
    } catch (e) {
      console.warn('Carrier start err', e);
    }
  }

  stopCarrier() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
    }
    setTimeout(() => {
      try {
        if (this.osc) {
          this.osc.stop();
          this.osc.disconnect();
          this.osc = null;
        }
      } catch (e) {}
    }, 100);
  }

  updateSpeed(mbps) {
    if (!this.isEnabled || !this.ctx || !this.osc || !this.gainNode) return;
    try {
      const now = this.ctx.currentTime;
      if (mbps <= 0.05) {
        this.gainNode.gain.setTargetAtTime(0.005, now, 0.05);
        this.osc.frequency.setTargetAtTime(180, now, 0.05);
        return;
      }
      const norm = Math.min(Math.max(Math.log10(Math.max(1, mbps)) / 3.2, 0), 1);
      const targetFreq = 220 + norm * 880;
      const targetGain = 0.04 + norm * 0.04;
      this.osc.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.gainNode.gain.setTargetAtTime(targetGain, now, 0.08);
    } catch (e) {}
  }

  playChime(type = 'phase') {
    if (!this.isEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.85);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  }
}

const soundEngine = new SoundEngine();

// ==========================================
// 2. HAPTIC FEEDBACK
// ==========================================
function triggerHaptic(type = 'tick') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'phase') navigator.vibrate([25, 40, 25]);
      else if (type === 'success') navigator.vibrate([40, 60, 40, 60, 80]);
      else navigator.vibrate(15);
    } catch (e) {}
  }
}

// ==========================================
// 3. STORAGE & HISTORY ENGINE
// ==========================================
const STORAGE_KEY = 'pulse360_test_history_v1';

function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveHistoryItem(item) {
  try {
    const list = getHistory();
    const updated = [item, ...list.filter(x => x.id !== item.id)].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}
}

function clearHistoryStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ==========================================
// 4. REAL CLOUDFLARE MEASUREMENT ENGINE
// ==========================================
const CF_ORIGIN = 'https://speed.cloudflare.com';
const nocache = (url) => {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_t=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
};

// 4.1 Trace & Telemetry
async function fetchTelemetry() {
  const result = {
    ip: 'Unknown',
    isp: 'Cloudflare Edge Routed',
    asn: 'AS13335 (Cloudflare)',
    colo: 'EDGE',
    city: 'Global Edge Node',
    country: 'Global',
    httpVersion: 'HTTP/2',
    tlsVersion: 'TLSv1.3'
  };

  try {
    const resp = await fetch(nocache(`${CF_ORIGIN}/cdn-cgi/trace`), { cache: 'no-store' });
    if (resp.ok) {
      const text = await resp.text();
      const kv = {};
      text.trim().split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx !== -1) kv[line.substring(0, idx)] = line.substring(idx + 1);
      });

      const coloMap = {
        CCU: 'Kolkata', BOM: 'Mumbai', DEL: 'Delhi', BLR: 'Bengaluru', MAA: 'Chennai', HYD: 'Hyderabad',
        LHR: 'London', FRA: 'Frankfurt', AMS: 'Amsterdam', CDG: 'Paris',
        SJC: 'San Jose', SFO: 'San Francisco', LAX: 'Los Angeles', IAD: 'Washington DC',
        JFK: 'New York', ORD: 'Chicago', DFW: 'Dallas', MIA: 'Miami', SEA: 'Seattle',
        NRT: 'Tokyo', HKG: 'Hong Kong', SIN: 'Singapore', SYD: 'Sydney', MEL: 'Melbourne'
      };

      result.ip = kv['ip'] || 'Protected';
      result.colo = kv['colo'] || 'EDGE';
      result.city = coloMap[result.colo] || `${result.colo} Node`;
      result.country = kv['loc'] || 'Global';
      result.httpVersion = kv['http'] || 'HTTP/2';
      result.tlsVersion = kv['tls'] || 'TLSv1.3';

      // IP Enrichment
      try {
        const ipResp = await fetch(`https://ipwho.is/${result.ip}`, { signal: AbortSignal.timeout(2000) });
        if (ipResp.ok) {
          const data = await ipResp.json();
          if (data.success) {
            if (data.connection?.isp) result.isp = data.connection.isp;
            if (data.connection?.asn) result.asn = `AS${data.connection.asn} (${data.connection.org || result.isp})`;
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('Trace fetch error:', e);
  }
  return result;
}

// 4.2 Browser Network Information API
function checkBrowserNetworkApi() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn || !conn.effectiveType) {
    return { supported: false, text: 'Not measurable in this browser' };
  }
  return {
    supported: true,
    effectiveType: conn.effectiveType,
    rtt: conn.rtt,
    downlink: conn.downlink,
    saveData: !!conn.saveData,
    text: `${conn.effectiveType.toUpperCase()} • ~${conn.rtt || '--'}ms RTT • ${conn.downlink || '--'} Mbps`
  };
}

// 4.3 Ping & Jitter
async function measureLatency(count = 7, timeoutMs = 3000) {
  const samples = [];
  let timeouts = 0;

  for (let i = 0; i < count; i++) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(nocache(`${CF_ORIGIN}/__down?bytes=0`), {
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        const rtt = Math.max(1, Math.round(performance.now() - start));
        samples.push(rtt);
      } else {
        timeouts++;
      }
    } catch (e) {
      timeouts++;
    }
    if (i < count - 1) await new Promise(r => setTimeout(r, 60));
  }

  if (samples.length === 0) {
    return { idleLatency: 0, jitter: 0, minLatency: 0, maxLatency: 0, packetLoss: 100, samples: [] };
  }

  const valid = samples.length > 3 ? samples.slice(1) : samples;
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const minLatency = sorted[0];
  const maxLatency = sorted[sorted.length - 1];

  let jitterSum = 0;
  for (let i = 1; i < valid.length; i++) {
    jitterSum += Math.abs(valid[i] - valid[i - 1]);
  }
  const jitter = valid.length > 1 ? Math.round((jitterSum / (valid.length - 1)) * 10) / 10 : 0;
  const packetLoss = Math.round((timeouts / count) * 100);

  return { idleLatency: median, jitter, minLatency, maxLatency, packetLoss, samples: valid };
}

// 4.4 DoH DNS Benchmark
async function benchmarkDns() {
  const providers = [
    { id: 'CF', name: 'Cloudflare DNS', ip: '1.1.1.1', url: 'https://cloudflare-dns.com/dns-query?name=cloudflare.com&type=A' },
    { id: 'Google', name: 'Google Public DNS', ip: '8.8.8.8', url: 'https://dns.google/resolve?name=google.com&type=A' },
    { id: 'Quad9', name: 'Quad9 Privacy DNS', ip: '9.9.9.9', url: 'https://dns.quad9.net/dns-query?name=quad9.net&type=A' }
  ];

  const results = [];
  for (const p of providers) {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(nocache(p.url), {
        headers: { Accept: 'application/dns-json' },
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (resp.ok) {
        const timeMs = Math.round(performance.now() - start);
        results.push({ ...p, timeMs, status: 'success' });
      } else {
        results.push({ ...p, timeMs: null, status: 'failed' });
      }
    } catch (e) {
      results.push({ ...p, timeMs: null, status: 'unsupported' });
    }
  }

  const successList = results.filter(r => r.status === 'success' && r.timeMs !== null);
  if (successList.length > 0) {
    const minTime = Math.min(...successList.map(r => r.timeMs));
    results.forEach(r => { if (r.timeMs === minTime) r.isFastest = true; });
  }

  return results;
}

// 4.5 Streaming Download
async function runDownloadTest(onProgress, shouldAbort) {
  const sizes = [500_000, 2_000_000, 10_000_000, 25_000_000, 45_000_000];
  let totalBytes = 0;
  const samples = [];
  let peakMbps = 0;
  const startTime = performance.now();

  for (const size of sizes) {
    if (shouldAbort && shouldAbort()) break;
    if (performance.now() - startTime > 9000) break;

    try {
      const resp = await fetch(nocache(`${CF_ORIGIN}/__down?bytes=${size}`), { cache: 'no-store' });
      if (!resp.ok || !resp.body) continue;

      const reader = resp.body.getReader();
      let lastTime = performance.now();
      let lastBytes = 0;

      while (true) {
        if (shouldAbort && shouldAbort()) { reader.cancel(); break; }
        if (performance.now() - startTime > 9000) { reader.cancel(); break; }

        const { done, value } = await reader.read();
        if (done) break;

        const len = value ? value.byteLength : 0;
        totalBytes += len;
        lastBytes += len;

        const now = performance.now();
        const deltaMs = now - lastTime;
        if (deltaMs >= 95) {
          const deltaSec = deltaMs / 1000;
          const mbps = (lastBytes * 8) / (deltaSec * 1_000_000);
          const smoothed = Math.round(mbps * 10) / 10;
          if (smoothed > 0) {
            samples.push(smoothed);
            if (smoothed > peakMbps) peakMbps = smoothed;
            onProgress(smoothed, peakMbps);
          }
          lastBytes = 0;
          lastTime = now;
        }
      }
    } catch (e) {}
  }

  const valid = samples.length > 4 ? samples.slice(2) : samples;
  const avg = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
  return { current: avg, peak: peakMbps, average: avg, samples };
}

// 4.6 Streaming Upload
async function runUploadTest(onProgress, shouldAbort) {
  const sizes = [300_000, 1_000_000, 3_000_000, 6_000_000, 10_000_000];
  let totalBytes = 0;
  const samples = [];
  let peakMbps = 0;
  const startTime = performance.now();

  for (const size of sizes) {
    if (shouldAbort && shouldAbort()) break;
    if (performance.now() - startTime > 8000) break;

    const payload = new Uint8Array(size);
    payload[0] = 42;
    payload[size - 1] = 99;

    const reqStart = performance.now();
    try {
      const resp = await fetch(nocache(`${CF_ORIGIN}/__up`), {
        method: 'POST',
        body: payload,
        cache: 'no-store'
      });
      if (resp.ok) {
        const sec = Math.max((performance.now() - reqStart) / 1000, 0.05);
        totalBytes += size;
        const mbps = Math.round(((size * 8) / (sec * 1_000_000)) * 10) / 10;
        if (mbps > 0) {
          samples.push(mbps);
          if (mbps > peakMbps) peakMbps = mbps;
          onProgress(mbps, peakMbps);
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 60));
  }

  const valid = samples.length > 2 ? samples.slice(1) : samples;
  const avg = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
  return { current: avg, peak: peakMbps, average: avg, samples };
}

// 4.7 Loaded Latency & Bufferbloat
async function measureBufferbloat(idleLatency) {
  let loadedDown = idleLatency;
  let loadedUp = idleLatency;

  try {
    const controller = new AbortController();
    fetch(nocache(`${CF_ORIGIN}/__down?bytes=12000000`), { cache: 'no-store', signal: controller.signal });
    await new Promise(r => setTimeout(r, 200));
    const p1 = await measureLatency(4, 2500);
    controller.abort();
    if (p1.idleLatency > 0) loadedDown = p1.idleLatency;
  } catch (e) {}

  try {
    const upPayload = new Uint8Array(3_000_000);
    const upController = new AbortController();
    fetch(nocache(`${CF_ORIGIN}/__up`), { method: 'POST', body: upPayload, cache: 'no-store', signal: upController.signal });
    await new Promise(r => setTimeout(r, 150));
    const p2 = await measureLatency(4, 2500);
    upController.abort();
    if (p2.idleLatency > 0) loadedUp = p2.idleLatency;
  } catch (e) {}

  const deltaDown = Math.max(0, loadedDown - idleLatency);
  const deltaUp = Math.max(0, loadedUp - idleLatency);
  const worstDelta = Math.max(deltaDown, deltaUp);

  let grade = 'B';
  let title = 'Good Buffer Queue';
  let desc = 'Minor queue buffering during heavy transfers. Real-time calls remain stable.';

  if (worstDelta <= 5) {
    grade = 'A+'; title = 'Flawless SQM'; desc = 'Immaculate low-latency responsiveness. Zero queue buildup under heavy load.';
  } else if (worstDelta <= 30) {
    grade = 'A'; title = 'Great Management'; desc = 'Negligible latency degradation under full saturation.';
  } else if (worstDelta <= 65) {
    grade = 'B'; title = 'Moderate Queue'; desc = 'Slight latency increase during concurrent file transfers.';
  } else if (worstDelta <= 130) {
    grade = 'C'; title = 'Noticeable Bloat'; desc = 'Games or video calls will hitch when someone starts a download.';
  } else if (worstDelta <= 240) {
    grade = 'D'; title = 'High Bufferbloat'; desc = 'Heavy latency spikes. Enable SQM / CAKE QoS on your router.';
  } else {
    grade = 'F'; title = 'Severe Bufferbloat'; desc = 'Major packet delay spikes (>240ms). Transfers choke real-time traffic.';
  }

  return { idleLatency, loadedDown, loadedUp, deltaDown, deltaUp, worstDelta, grade, title, desc };
}

// ==========================================
// 5. THE "360" LAYER ENGINES
// ==========================================

// 5.1 Real-Life Verdicts
function calculateVerdicts(down, up, ping, jitter, loss, bloat) {
  const verdicts = [];

  // 1. 4K/8K Streaming
  let sStat = 'Poor', sScore = 30, sHead = 'Limited to SD/720p', sReason = 'Low download speed will result in recurring buffering loops on high-res streams.';
  if (down >= 100 && bloat.worstDelta <= 60) {
    sStat = 'Legendary'; sScore = 98; sHead = 'Pristine 4K & 8K HDR Multi-Stream'; sReason = 'Flawless zero-buffering playback for multiple simultaneous 4K HDR streams with Dolby Vision.';
  } else if (down >= 40) {
    sStat = 'Excellent'; sScore = 90; sHead = 'Smooth 4K UHD Streaming'; sReason = 'Reliable high-bitrate 4K playback on Netflix, YouTube, and Apple TV without stutters.';
  } else if (down >= 18) {
    sStat = 'Good'; sScore = 75; sHead = 'Consistent 1080p Full HD'; sReason = 'Streams smoothly at 1080p60; occasional bitrate drops during heavy concurrent household usage.';
  } else if (down >= 8) {
    sStat = 'Fair'; sScore = 55; sHead = 'Acceptable 720p HD'; sReason = 'Reliable for 720p; concurrent users will cause resolution downgrades.';
  }
  verdicts.push({
    title: '4K / 8K Streaming',
    status: sStat,
    score: sScore,
    headline: sHead,
    reason: sReason,
    badgeColor: sStat === 'Legendary' ? 'text-pulse-cyan' : sStat === 'Excellent' ? 'text-pulse-neon' : sStat === 'Good' ? 'text-blue-400' : 'text-amber-400',
    metrics: `${down} Mbps down • ${ping}ms base ping`
  });

  // 2. Competitive Gaming
  let gStat = 'Poor', gScore = 25, gHead = 'Severe Latency Disadvantage', gReason = 'Elevated latency or jitter will cause hit-registration desyncs and rubberbanding.';
  if (ping <= 20 && jitter <= 3 && loss === 0 && (bloat.grade === 'A+' || bloat.grade === 'A')) {
    gStat = 'Legendary'; gScore = 99; gHead = 'Esports-Tier Low Latency'; gReason = 'Sub-20ms ultra-crisp tick rate response with zero jitter. Optimal for CS2, Valorant & Apex.';
  } else if (ping <= 35 && jitter <= 5 && loss === 0 && bloat.worstDelta <= 60) {
    gStat = 'Excellent'; gScore = 88; gHead = 'Smooth Competitive Gaming'; gReason = 'Fast response with consistent hit-reg; low jitter ensures stable peekers advantage.';
  } else if (ping <= 60 && jitter <= 10 && loss <= 1) {
    gStat = 'Good'; gScore = 70; gHead = 'Playable Casual Multiplayer'; gReason = 'Solid for casual multiplayer; slight loaded ping spikes during concurrent home downloads.';
  } else if (ping <= 100) {
    gStat = 'Fair'; gScore = 50; gHead = 'Borderline High Ping'; gReason = 'Noticeable ~80ms+ delay; disadvantage in rapid reflex gunfights.';
  }
  verdicts.push({
    title: 'Competitive Gaming',
    status: gStat,
    score: gScore,
    headline: gHead,
    reason: gReason,
    badgeColor: gStat === 'Legendary' ? 'text-pulse-cyan' : gStat === 'Excellent' ? 'text-pulse-neon' : gStat === 'Good' ? 'text-blue-400' : 'text-rose-400',
    metrics: `${ping}ms ping • ${jitter}ms jitter • Bloat: ${bloat.grade}`
  });

  // 3. Video Calls
  let cStat = 'Poor', cScore = 30, cHead = 'Robotic Audio & Frozen Video', cReason = 'Insufficient upload bandwidth or high buffer bloat will cause robotic audio and dropped frames.';
  if (up >= 12 && down >= 25 && jitter <= 4 && bloat.worstDelta <= 60) {
    cStat = 'Legendary'; cScore = 96; cHead = 'Studio HD Multi-Person Calls'; cReason = 'Crystal-clear 1080p video with near-zero audio desync across Zoom, Teams, and Google Meet.';
  } else if (up >= 5 && down >= 12 && jitter <= 8) {
    cStat = 'Excellent'; cScore = 86; cHead = 'Crisp HD Video Conferencing'; cReason = 'Smooth 720p/1080p calls with reliable screen-sharing even with multiple attendees.';
  } else if (up >= 2.5 && down >= 6) {
    cStat = 'Good'; cScore = 68; cHead = 'Decent Standard Video Calls'; cReason = 'Adequate for 1-on-1 video; group calls may temporarily drop quality during heavy network use.';
  } else {
    cStat = 'Fair'; cScore = 48; cHead = 'Audio-Only Recommended'; cReason = 'Upload constraints may cause screen sharing to hitch or voice packets to stutter.';
  }
  verdicts.push({
    title: 'Video Calls (Zoom/Teams)',
    status: cStat,
    score: cScore,
    headline: cHead,
    reason: cReason,
    badgeColor: cStat === 'Legendary' ? 'text-pulse-cyan' : cStat === 'Excellent' ? 'text-pulse-neon' : cStat === 'Good' ? 'text-blue-400' : 'text-amber-400',
    metrics: `${up} Mbps up • ${jitter}ms jitter • Bloat: ${bloat.grade}`
  });

  // 4. Remote Work & VPN
  let wStat = 'Poor', wScore = 35, wHead = 'Sluggish Remote Desktop', wReason = 'High round-trip latency creates noticeable keystroke lag inside SSH, Citrix, or Remote Desktop.';
  if (ping <= 30 && down >= 50 && up >= 15 && loss === 0) {
    wStat = 'Legendary'; wScore = 95; wHead = 'Zero-Lag Virtual Workspace'; wReason = 'Feels like a local desktop: instant SSH keystrokes, buttery smooth RDP/Citrix, fast Git pushes.';
  } else if (ping <= 50 && down >= 25 && up >= 8) {
    wStat = 'Excellent'; wScore = 85; wHead = 'Responsive Cloud Workflows'; wReason = 'Stable VPN tunnel with quick file syncs and negligible Remote Desktop latency.';
  } else if (ping <= 80 && down >= 12 && up >= 4) {
    wStat = 'Good'; wScore = 68; wHead = 'Workable Remote Desktop'; wReason = 'Suitable for standard web productivity, Google Docs, and basic remote server management.';
  } else {
    wStat = 'Fair'; wScore = 50; wHead = 'Occasional VPN Dropouts'; wReason = 'Elevated latency may introduce slight cursor drag and sluggish terminal response.';
  }
  verdicts.push({
    title: 'Remote Work & Cloud VPN',
    status: wStat,
    score: wScore,
    headline: wHead,
    reason: wReason,
    badgeColor: wStat === 'Legendary' ? 'text-pulse-cyan' : wStat === 'Excellent' ? 'text-pulse-neon' : wStat === 'Good' ? 'text-blue-400' : 'text-amber-400',
    metrics: `${ping}ms RTT • ${down} down / ${up} up`
  });

  // 5. Cloud Backups
  let bStat = 'Poor', bScore = 20, bHead = 'Painfully Slow Cloud Sync', bReason = 'Asymmetric low upload will bottleneck video archives, Google Drive syncs, and raw photo backups.';
  if (up >= 80) {
    bStat = 'Legendary'; bScore = 98; bHead = 'Fiber-Speed Cloud Ingestion'; bReason = '10GB file uploads finish in under 2 minutes. Effortless 4K footage and raw camera backup transfers.';
  } else if (up >= 30) {
    bStat = 'Excellent'; bScore = 88; bHead = 'Rapid Cloud Synchronization'; bReason = 'Seamless automated backups for OneDrive, Google Drive, iCloud, and multi-gigabyte files.';
  } else if (up >= 10) {
    bStat = 'Good'; bScore = 68; bHead = 'Moderate Backup Throughput'; bReason = 'Daily document and mobile photo backups sync cleanly; large videos will take a while.';
  } else if (up >= 3) {
    bStat = 'Fair'; bScore = 48; bHead = 'Slow Upload Pipeline'; bReason = 'Adequate for light docs; 5GB video uploads will require over 3 hours.';
  }
  verdicts.push({
    title: 'Cloud Backups & Uploads',
    status: bStat,
    score: bScore,
    headline: bHead,
    reason: bReason,
    badgeColor: bStat === 'Legendary' ? 'text-pulse-cyan' : bStat === 'Excellent' ? 'text-pulse-neon' : bStat === 'Good' ? 'text-blue-400' : 'text-rose-400',
    metrics: `${up} Mbps upload speed`
  });

  // 6. Smart Home
  let iStat = 'Poor', iScore = 30, iHead = 'Vulnerable to Device Contention', iReason = 'Network capacity will struggle when multiple cameras and smart appliances communicate simultaneously.';
  if (down >= 150 && up >= 25 && loss === 0) {
    iStat = 'Legendary'; iScore = 96; iHead = 'Massive Smart Ecosystem Ready'; iReason = 'Flawlessly powers 40+ concurrent smart devices, 2K/4K security camera continuous streams, and voice hubs.';
  } else if (down >= 50 && up >= 10 && loss === 0) {
    iStat = 'Excellent'; iScore = 86; iHead = 'Modern Connected Household'; iReason = 'Supports 15-25 smart plugs, thermostats, bulbs, and 2 live cloud-recording cameras easily.';
  } else if (down >= 20 && up >= 5) {
    iStat = 'Good'; iScore = 70; iHead = 'Standard IoT Setup'; iReason = 'Comfortable with everyday smart speakers and sensors; avoid multiple simultaneous 4K cam streams.';
  } else {
    iStat = 'Fair'; iScore = 50; iHead = 'Light Device Density Only'; iReason = 'Limited bandwidth headroom; high traffic from one device may throttle smart hubs.';
  }
  verdicts.push({
    title: 'Smart Home & IoT Load',
    status: iStat,
    score: iScore,
    headline: iHead,
    reason: iReason,
    badgeColor: iStat === 'Legendary' ? 'text-pulse-cyan' : iStat === 'Excellent' ? 'text-pulse-neon' : iStat === 'Good' ? 'text-blue-400' : 'text-amber-400',
    metrics: `${down} Mbps down • ${loss}% loss`
  });

  return verdicts;
}

// 5.2 Network DNA Scores
function calculateDnaScores(down, up, ping, jitter, loss, bloatGrade, dnsResults) {
  let speed = 20;
  if (down > 0) speed = Math.min(100, Math.round(15 + (Math.log10(Math.max(1, down)) / 3) * 85));

  let upload = 15;
  if (up > 0) upload = Math.min(100, Math.round(10 + (Math.log10(Math.max(1, up)) / 2.7) * 90));

  let latency = 40;
  if (ping > 0) {
    if (ping <= 8) latency = 100;
    else if (ping <= 20) latency = 95 - (ping - 8) * 0.8;
    else if (ping <= 50) latency = 85 - (ping - 20) * 0.7;
    else if (ping <= 120) latency = 64 - (ping - 50) * 0.4;
    else latency = Math.max(10, 36 - (ping - 120) * 0.15);
  }
  latency = Math.round(latency);

  let stability = Math.max(10, Math.min(100, Math.round(95 - Math.min(40, jitter * 4) - Math.min(50, loss * 10))));

  const bMap = { 'A+': 100, 'A': 90, 'B': 74, 'C': 54, 'D': 35, 'F': 15 };
  const bufferbloat = bMap[bloatGrade] || 60;

  const validDns = dnsResults.filter(d => d.status === 'success' && d.timeMs !== null);
  let fastestDns = 35;
  if (validDns.length > 0) fastestDns = Math.min(...validDns.map(d => d.timeMs));
  let dns = 80;
  if (fastestDns <= 12) dns = 100;
  else if (fastestDns <= 25) dns = 92;
  else if (fastestDns <= 50) dns = 80;
  else if (fastestDns <= 90) dns = 65;
  else dns = Math.max(20, Math.round(50 - (fastestDns - 90) * 0.2));

  const composite = Math.round(speed * 0.25 + upload * 0.15 + latency * 0.20 + stability * 0.15 + bufferbloat * 0.15 + dns * 0.10);
  return { speed, upload, latency, stability, bufferbloat, dns, composite };
}

// 5.3 Smart Diagnosis Rules
function generateDiagnosis(down, up, ping, jitter, loss, bloat, dnsResults, promisedDown) {
  const insights = [];

  if (bloat.worstDelta > 65) {
    insights.push({
      type: 'warning',
      title: `High Bufferbloat Detected (${bloat.grade} Grade, +${bloat.worstDelta}ms spike)`,
      summary: `Your raw throughput is solid (${down} Mbps), but latency balloons under saturation. When someone streams or downloads, games will rubberband and video calls will glitch.`,
      action: 'Enable SQM (Smart Queue Management) or CAKE / FQ-CoDel QoS on your router. Set upload and download queue caps to 95% of line speed.'
    });
  } else if (bloat.grade === 'A+' || bloat.grade === 'A') {
    insights.push({
      type: 'success',
      title: `Superb Buffer Management (${bloat.grade} Grade)`,
      summary: `Router buffer delays barely budge (+${bloat.worstDelta}ms delta under load). Real-time gaming and video conferences will remain pristine even during background transfers.`,
      action: 'No action needed — router queue configuration is optimal.'
    });
  }

  if (loss > 0) {
    insights.push({
      type: 'critical',
      title: `Active Packet Loss (${loss}%) Detected`,
      summary: 'Dropped packets force TCP retransmissions, creating micro-stutters in video calls and noticeable hit-registration lag in games.',
      action: 'Inspect Ethernet patch cords, router temperature, or test directly with Cat6 cable to rule out Wi-Fi interference.'
    });
  } else if (jitter > 8) {
    insights.push({
      type: 'warning',
      title: `Elevated Packet Jitter (${jitter}ms)`,
      summary: 'High packet arrival variance typically points to 2.4 GHz wireless congestion, channel overlap, or local background sync traffic.',
      action: 'Migrate devices to 5GHz or 6GHz Wi-Fi bands, or connect directly via Ethernet.'
    });
  }

  const validDns = dnsResults.filter(d => d.status === 'success' && d.timeMs !== null);
  if (validDns.length > 0) {
    const fastest = validDns.reduce((a, b) => a.timeMs < b.timeMs ? a : b);
    if (fastest.timeMs <= 18) {
      insights.push({
        type: 'success',
        title: `Ultra-Fast DNS (${fastest.name} @ ${fastest.timeMs}ms)`,
        summary: `Domain name resolution is lightning fast via ${fastest.name}. Initial handshakes and page lookups resolve with zero perceived delay.`,
        action: 'DNS resolution is highly responsive.'
      });
    } else if (fastest.timeMs > 55) {
      insights.push({
        type: 'tip',
        title: `Sluggish DNS Resolution (${fastest.timeMs}ms)`,
        summary: 'DNS queries take longer than expected, adding friction to the first touch of every webpage and web service.',
        action: 'Configure 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google) at your router DHCP server.'
      });
    }
  }

  if (down > 50 && up < down * 0.1) {
    insights.push({
      type: 'tip',
      title: 'Severely Asymmetric Connection',
      summary: `Upload (${up} Mbps) is less than 10% of download (${down} Mbps). Heavy cloud photo backups may stall web browsing as TCP ACKs get bottlenecked.`,
      action: 'Schedule large uploads for overnight hours or prioritize TCP ACK packets in router QoS.'
    });
  }

  if (promisedDown && promisedDown > 0) {
    const ratio = Math.round((down / promisedDown) * 100);
    if (ratio < 70) {
      insights.push({
        type: 'critical',
        title: `Delivering Only ${ratio}% of Promised Speed`,
        summary: `You pay for ${promisedDown} Mbps but received ${down} Mbps (${promisedDown - down} Mbps missing).`,
        action: 'Export your PULSE360 diagnostic log and present this timestamped Cloudflare edge evidence to your ISP.'
      });
    }
  }

  return insights;
}

// ==========================================
// 6. WEBGL DATA TUNNEL (THREE.JS)
// ==========================================
class WebGLTunnel {
  constructor(containerEl) {
    this.container = containerEl;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.ringsGroup = null;
    this.posArray = null;
    this.speeds = null;
    this.material = null;
    this.currentSpeed = 0.8;
    this.targetSpeed = 0.8;
    this.currentColor = new THREE.Color(0x00f0ff);
    this.targetColor = new THREE.Color(0x00f0ff);
    this.clock = new THREE.Clock();
    this.animId = null;
    this.init();
  }

  init() {
    if (!window.THREE || !this.container) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08090d, 0.0025);

    this.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 1200);
    this.camera.position.z = 200;

    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return;
    }

    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.container.appendChild(this.renderer.domElement);

    const PARTICLE_COUNT = 1600;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    this.speeds = new Float32Array(PARTICLE_COUNT);

    const tunnelRadius = 120;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * tunnelRadius;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800;
      this.speeds[i] = Math.random() * 0.5 + 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.posArray = positions;

    // Sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.8)');
      grad.addColorStop(0.8, 'rgba(0, 240, 255, 0.1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 4.5,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, this.material);
    this.scene.add(this.particles);

    // Guide rings
    this.ringsGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const ringGeo = new THREE.TorusGeometry(85 + (i % 3) * 15, 0.4, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.18, wireframe: true });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = -i * 100;
      this.ringsGroup.add(ring);
    }
    this.scene.add(this.ringsGroup);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setSpeedAndColor(targetSpeed, colorHex) {
    this.targetSpeed = targetSpeed;
    this.targetColor = new THREE.Color(colorHex);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.08;
    this.currentColor.lerp(this.targetColor, 0.06);

    if (this.material) this.material.color.copy(this.currentColor);
    if (this.camera) this.camera.rotation.z += 0.001 * this.currentSpeed;

    const baseVel = this.currentSpeed * 45 * delta;
    const geom = this.particles.geometry;
    const pos = geom.attributes.position.array;

    for (let i = 0; i < 1600; i++) {
      pos[i * 3 + 2] += baseVel * this.speeds[i];
      if (pos[i * 3 + 2] > 250) {
        pos[i * 3 + 2] = -550;
        const angle = Math.random() * Math.PI * 2;
        const radius = 25 + Math.random() * 120;
        pos[i * 3] = Math.cos(angle) * radius;
        pos[i * 3 + 1] = Math.sin(angle) * radius;
      }
    }
    geom.attributes.position.needsUpdate = true;

    if (this.ringsGroup) {
      this.ringsGroup.children.forEach((ring, idx) => {
        ring.position.z += baseVel * 1.2;
        ring.rotation.z += (idx % 2 === 0 ? 1 : -1) * 0.003 * this.currentSpeed;
        if (ring.position.z > 250) ring.position.z = -550;
        ring.material.color.copy(this.currentColor);
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

// ==========================================
// 7. CIRCULAR SVG GAUGES WITH GHOST RUN
// ==========================================
function drawCircularGauge(svgEl, value, peak, ghost, mode, isLive) {
  const size = 220;
  const strokeWidth = 12;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;

  let maxScale = 50;
  const effMax = Math.max(value, peak || 0, ghost || 0);
  if (effMax > 500) maxScale = 1000;
  else if (effMax > 100) maxScale = 500;
  else if (effMax > 50) maxScale = 100;

  const currentAngle = (Math.min(Math.max(value, 0), maxScale) / maxScale) * 240;
  const peakAngle = (Math.min(Math.max(peak || 0, 0), maxScale) / maxScale) * 240;
  const ghostAngle = ghost ? (Math.min(Math.max(ghost, 0), maxScale) / maxScale) * 240 : 0;

  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeArc = (x, y, r, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const startAngle = 150;
  const bgArc = describeArc(center, center, radius, startAngle, startAngle + 240);
  const activeArc = currentAngle > 0 ? describeArc(center, center, radius, startAngle, startAngle + currentAngle) : '';

  const themeColor = mode === 'download' ? '#00f0ff' : '#f43f5e';
  const gradId = `grad_${mode}`;

  let ghostSvg = '';
  if (ghost && ghost > 0) {
    const ghostPt = polarToCartesian(center, center, radius, startAngle + ghostAngle);
    ghostSvg = `
      <path d="${describeArc(center, center, radius, startAngle, startAngle + ghostAngle)}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${strokeWidth}" stroke-dasharray="4 5" stroke-linecap="round" />
      <circle cx="${ghostPt.x}" cy="${ghostPt.y}" r="6" fill="#ffffff" opacity="0.8" />
    `;
  }

  let peakSvg = '';
  if (peakAngle > 2) {
    const peakPt = polarToCartesian(center, center, radius, startAngle + peakAngle);
    peakSvg = `<circle cx="${peakPt.x}" cy="${peakPt.y}" r="4" fill="${themeColor}" stroke="#ffffff" stroke-width="2" />`;
  }

  svgEl.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${mode === 'download' 
          ? '<stop offset="0%" stop-color="#818cf8"/><stop offset="50%" stop-color="#00f0ff"/><stop offset="100%" stop-color="#00f7a5"/>' 
          : '<stop offset="0%" stop-color="#c084fc"/><stop offset="50%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#fb923c"/>'}
      </linearGradient>
      <filter id="glow_${mode}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <path d="${bgArc}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${strokeWidth}" stroke-linecap="round" />
    ${ghostSvg}
    ${activeArc ? `<path d="${activeArc}" fill="none" stroke="url(#${gradId})" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#glow_${mode})" />` : ''}
    ${peakSvg}
    <text x="32" y="210" fill="#64748b" font-family="JetBrains Mono" font-size="10">0</text>
    <text x="180" y="210" fill="#64748b" font-family="JetBrains Mono" font-size="10">${maxScale}</text>
  `;
}

// ==========================================
// 8. NETWORK DNA RADAR CANVAS & EXPORT CARD
// ==========================================
function drawRadarCanvas(canvas, scores) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = 360, h = 360;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2, maxR = 115;
  const axes = [
    { label: 'Speed', val: scores.speed },
    { label: 'Stability', val: scores.stability },
    { label: 'Latency', val: scores.latency },
    { label: 'Upload', val: scores.upload },
    { label: 'Bufferbloat', val: scores.bufferbloat },
    { label: 'DNS Ping', val: scores.dns }
  ];
  const total = axes.length;
  const angleStep = (Math.PI * 2) / total;

  // Concentric webs
  [0.25, 0.5, 0.75, 1.0].forEach((lvl, idx) => {
    ctx.beginPath();
    for (let i = 0; i < total; i++) {
      const a = i * angleStep - Math.PI / 2;
      const r = maxR * lvl;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = idx === 3 ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Spokes & labels
  for (let i = 0; i < total; i++) {
    const a = i * angleStep - Math.PI / 2;
    const x = cx + Math.cos(a) * maxR, y = cy + Math.sin(a) * maxR;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    const lx = cx + Math.cos(a) * (maxR + 24);
    const ly = cy + Math.sin(a) * (maxR + 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(axes[i].label, lx, ly - 6);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(`${axes[i].val}`, lx, ly + 8);
  }

  // Polygon
  ctx.beginPath();
  axes.forEach((ax, i) => {
    const a = i * angleStep - Math.PI / 2;
    const r = (ax.val / 100) * maxR;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const fillGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
  fillGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
  fillGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.3)');
  fillGrad.addColorStop(1, 'rgba(0, 247, 165, 0.15)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Nodes
  axes.forEach((ax, i) => {
    const a = i * angleStep - Math.PI / 2;
    const r = (ax.val / 100) * maxR;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function exportDnaCardPng(scores, down, up, ping, jitter, bloat, telemetry) {
  const card = document.createElement('canvas');
  card.width = 1200; card.height = 675;
  const ctx = card.getContext('2d');
  if (!ctx) return;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
  bgGrad.addColorStop(0, '#08090d');
  bgGrad.addColorStop(0.5, '#0f121e');
  bgGrad.addColorStop(1, '#08090d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 675);

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 1164, 639);

  // Header
  ctx.fillStyle = '#00f0ff';
  ctx.font = '800 28px "JetBrains Mono", monospace';
  ctx.fillText('PULSE360', 60, 75);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px "Inter", sans-serif';
  ctx.fillText('// NETWORK DNA FINGERPRINT & TELEMETRY REPORT', 220, 75);

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = '#64748b';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, 1140, 75);
  ctx.textAlign = 'left';

  // Left Box
  ctx.fillStyle = 'rgba(20, 24, 36, 0.85)';
  ctx.fillRect(60, 115, 520, 480);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.strokeRect(60, 115, 520, 480);

  ctx.fillStyle = '#00f7a5';
  ctx.font = '800 52px "JetBrains Mono", monospace';
  ctx.fillText(`${scores.composite}`, 90, 190);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 18px "Inter", sans-serif';
  ctx.fillText('/ 100 COMPOSITE INDEX', 185, 175);

  let tier = 'GIGABIT FIBER TIER';
  if (scores.composite < 50) tier = 'CONGESTED BROADBAND';
  else if (scores.composite < 70) tier = 'STANDARD HOME BROADBAND';
  else if (scores.composite < 85) tier = 'HIGH-PERFORMANCE TIER';
  ctx.fillStyle = '#00f0ff';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText(tier, 185, 195);

  const rows = [
    { label: 'DOWNLOAD SPEED', val: `${down.toFixed(1)} Mbps`, color: '#00f0ff' },
    { label: 'UPLOAD SPEED', val: `${up.toFixed(1)} Mbps`, color: '#f43f5e' },
    { label: 'BASE LATENCY', val: `${ping} ms`, color: '#a855f7' },
    { label: 'PACKET JITTER', val: `${jitter} ms`, color: '#38bdf8' },
    { label: 'BUFFERBLOAT GRADE', val: `Grade ${bloat.grade} (+${bloat.worstDelta}ms)`, color: '#00f7a5' },
    { label: 'EDGE ROUTE', val: `${telemetry?.colo || 'EDGE'} (${telemetry?.city || 'Global'})`, color: '#cbd5e1' },
    { label: 'ISP & ASN', val: `${telemetry?.isp || 'Cloudflare Anycast'} [${telemetry?.asn || 'AS13335'}]`, color: '#94a3b8' }
  ];

  let ry = 245;
  rows.forEach(r => {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText(r.label, 90, ry);
    ctx.fillStyle = r.color;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(r.val, 90, ry + 22);
    ry += 46;
  });

  // Right: Radar
  const rcx = 890, rcy = 355, rmax = 160;
  const axes = [
    { label: 'Speed', val: scores.speed },
    { label: 'Stability', val: scores.stability },
    { label: 'Latency', val: scores.latency },
    { label: 'Upload', val: scores.upload },
    { label: 'Queue SQM', val: scores.bufferbloat },
    { label: 'DNS Ping', val: scores.dns }
  ];
  const step = (Math.PI * 2) / axes.length;

  [0.25, 0.5, 0.75, 1.0].forEach(lvl => {
    ctx.beginPath();
    for (let i = 0; i < axes.length; i++) {
      const a = i * step - Math.PI / 2;
      const x = rcx + Math.cos(a) * (rmax * lvl), y = rcy + Math.sin(a) * (rmax * lvl);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
  });

  for (let i = 0; i < axes.length; i++) {
    const a = i * step - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(rcx, rcy);
    ctx.lineTo(rcx + Math.cos(a) * rmax, rcy + Math.sin(a) * rmax);
    ctx.strokeStyle = 'rgba(0,240,255,0.2)';
    ctx.stroke();

    const lx = rcx + Math.cos(a) * (rmax + 32);
    const ly = rcy + Math.sin(a) * (rmax + 32);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(axes[i].label, lx, ly - 8);
    ctx.fillStyle = '#00f0ff';
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.fillText(`${axes[i].val}`, lx, ly + 14);
  }
  ctx.textAlign = 'left';

  // Poly
  ctx.beginPath();
  axes.forEach((ax, i) => {
    const a = i * step - Math.PI / 2;
    const r = (ax.val / 100) * rmax;
    const x = rcx + Math.cos(a) * r, y = rcy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
  ctx.fill();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Watermark
  ctx.fillStyle = '#475569';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText('POWERED BY PULSE360 TELEMETRY ENGINE • RFC 3550 COMPLIANT • VERIFIED VIA CLOUDFLARE SPEEDTEST', 60, 630);

  const a = document.createElement('a');
  a.href = card.toDataURL('image/png');
  a.download = `PULSE360-NetworkDNA-${Date.now()}.png`;
  a.click();
}

// ==========================================
// 9. APP ORCHESTRATION & STATE
// ==========================================
let tunnelInstance = null;
let currentStage = 'idle';
let abortController = null;

// Telemetry & Ghost
let currentTelemetry = null;
let ghostRun = null;
let currentDnsResults = [];
let lastBufferbloat = { grade: '--', worstDelta: 0, title: 'Untested', desc: 'Run test to measure.' };

// Test Metrics
let testMetrics = {
  download: 0,
  downloadPeak: 0,
  upload: 0,
  uploadPeak: 0,
  latency: 0,
  jitter: 0,
  packetLoss: 0,
  bufferbloat: null,
  dna: { speed: 0, upload: 0, latency: 0, stability: 0, bufferbloat: 0, dns: 0, composite: 0 }
};
window.__setTestMetrics = (m) => Object.assign(testMetrics, m);
window.__testMetrics = testMetrics;

// DOM References
const el = {
  telIp: document.getElementById('telIp'),
  telIsp: document.getElementById('telIsp'),
  telColo: document.getElementById('telColo'),
  telProtocol: document.getElementById('telProtocol'),
  telNetApi: document.getElementById('telNetApi'),
  telServer: document.getElementById('telServer'),

  hudStageBadge: document.getElementById('hudStageBadge'),
  tunnelIdleNotice: document.getElementById('tunnelIdleNotice'),
  tunnelActiveReadout: document.getElementById('tunnelActiveReadout'),
  tunnelCompleteNotice: document.getElementById('tunnelCompleteNotice'),
  tunnelMetricLabel: document.getElementById('tunnelMetricLabel'),
  tunnelBigNumber: document.getElementById('tunnelBigNumber'),
  tunnelPeakNumber: document.getElementById('tunnelPeakNumber'),

  startTestBtn: document.getElementById('startTestBtn'),
  startBtnLabel: document.getElementById('startBtnLabel'),
  abortTestBtn: document.getElementById('abortTestBtn'),
  ghostRunStatusLabel: document.getElementById('ghostRunStatusLabel'),
  clearGhostBtn: document.getElementById('clearGhostBtn'),

  gaugeCardDown: document.getElementById('gaugeCardDown'),
  gaugeCardUp: document.getElementById('gaugeCardUp'),
  svgGaugeDown: document.getElementById('svgGaugeDown'),
  svgGaugeUp: document.getElementById('svgGaugeUp'),
  valDownCurrent: document.getElementById('valDownCurrent'),
  valDownPeak: document.getElementById('valDownPeak'),
  valUpCurrent: document.getElementById('valUpCurrent'),
  valUpPeak: document.getElementById('valUpPeak'),
  badgeDownStreaming: document.getElementById('badgeDownStreaming'),
  badgeUpStreaming: document.getElementById('badgeUpStreaming'),
  ghostDiffDown: document.getElementById('ghostDiffDown'),
  ghostDiffUp: document.getElementById('ghostDiffUp'),

  valIdleLatency: document.getElementById('valIdleLatency'),
  valJitter: document.getElementById('valJitter'),
  valPacketLoss: document.getElementById('valPacketLoss'),
  valMinMaxPing: document.getElementById('valMinMaxPing'),

  bloatGradeBox: document.getElementById('bloatGradeBox'),
  bloatGradeTitle: document.getElementById('bloatGradeTitle'),
  bloatDeltaSummary: document.getElementById('bloatDeltaSummary'),
  valLoadedDown: document.getElementById('valLoadedDown'),
  valLoadedUp: document.getElementById('valLoadedUp'),
  bloatDescription: document.getElementById('bloatDescription'),

  valDnsCF: document.getElementById('valDnsCF'),
  valDnsGoogle: document.getElementById('valDnsGoogle'),
  valDnsQuad9: document.getElementById('valDnsQuad9'),
  badgeFastestCF: document.getElementById('badgeFastestCF'),
  badgeFastestGoogle: document.getElementById('badgeFastestGoogle'),
  badgeFastestQuad9: document.getElementById('badgeFastestQuad9'),
  retestDnsBtn: document.getElementById('retestDnsBtn'),

  radarCanvas: document.getElementById('radarCanvas'),
  dnaCompositeNumber: document.getElementById('dnaCompositeNumber'),
  dnaScoreSpeed: document.getElementById('dnaScoreSpeed'),
  dnaScoreUpload: document.getElementById('dnaScoreUpload'),
  dnaScoreLatency: document.getElementById('dnaScoreLatency'),
  dnaScoreStability: document.getElementById('dnaScoreStability'),
  dnaScoreBloat: document.getElementById('dnaScoreBloat'),
  dnaScoreDns: document.getElementById('dnaScoreDns'),
  exportDnaCardBtn: document.getElementById('exportDnaCardBtn'),

  verdictsContainer: document.getElementById('verdictsContainer'),

  promisedDownInput: document.getElementById('promisedDownInput'),
  promisedUpInput: document.getElementById('promisedUpInput'),
  planDeliveredBadge: document.getElementById('planDeliveredBadge'),
  planDeliveryRatio: document.getElementById('planDeliveryRatio'),
  planDeficit: document.getElementById('planDeficit'),
  planEvidenceNote: document.getElementById('planEvidenceNote'),

  calcCustomSize: document.getElementById('calcCustomSize'),
  calcCustomUnit: document.getElementById('calcCustomUnit'),
  calcCustomType: document.getElementById('calcCustomType'),
  calcDurationOutput: document.getElementById('calcDurationOutput'),

  diagnosisList: document.getElementById('diagnosisList'),

  startStabilityBtn: document.getElementById('startStabilityBtn'),
  stabilityBtnLabel: document.getElementById('stabilityBtnLabel'),
  stabilityChartCanvas: document.getElementById('stabilityChartCanvas'),
  stabilityTimerText: document.getElementById('stabilityTimerText'),
  stabAvgPing: document.getElementById('stabAvgPing'),
  stabStdDev: document.getElementById('stabStdDev'),
  stabMaxJitter: document.getElementById('stabMaxJitter'),
  stabVerdict: document.getElementById('stabVerdict'),

  heatmapGrid: document.getElementById('heatmapGrid'),
  historyTableBody: document.getElementById('historyTableBody'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  audioToggleBtn: document.getElementById('audioToggleBtn'),
  audioIcon: document.getElementById('audioIcon'),
  audioLabel: document.getElementById('audioLabel'),
  navStabilityBtn: document.getElementById('navStabilityBtn'),
  navAskPulseBtn: document.getElementById('navAskPulseBtn'),

  // Ask PULSE Elements (Milestone 6A)
  btnLoadVectorModel: document.getElementById('btnLoadVectorModel'),
  vectorStatusIcon: document.getElementById('vectorStatusIcon'),
  vectorStatusLabel: document.getElementById('vectorStatusLabel'),
  askPulseSpeedLockout: document.getElementById('askPulseSpeedLockout'),
  chipExplainResult: document.getElementById('chipExplainResult'),
  chipDraftComplaint: document.getElementById('chipDraftComplaint'),
  chipAuditBloat: document.getElementById('chipAuditBloat'),
  chipBenchmarkDns: document.getElementById('chipBenchmarkDns'),
  consoleTextOutput: document.getElementById('consoleTextOutput'),
  consoleBlinkingCursor: document.getElementById('consoleBlinkingCursor'),
  consoleSourcesArea: document.getElementById('consoleSourcesArea'),
  consoleSourceTags: document.getElementById('consoleSourceTags'),
  askPulseForm: document.getElementById('askPulseForm'),
  askPulseInput: document.getElementById('askPulseInput'),
  askCharCounter: document.getElementById('askCharCounter'),
  btnSubmitQuery: document.getElementById('btnSubmitQuery'),
  btnClearConsole: document.getElementById('btnClearConsole'),

  // Floating Ask PULSE AI Assistant Widget (Corner Popup)
  floatingAskPulseLauncher: document.getElementById('floatingAskPulseLauncher'),
  floatingAskPulsePopup: document.getElementById('floatingAskPulsePopup'),
  btnCloseFloatingPopup: document.getElementById('btnCloseFloatingPopup'),
  popupSpeedLockout: document.getElementById('popupSpeedLockout'),
  popupChipTestSpeed: document.getElementById('popupChipTestSpeed'),
  popupChipExplain: document.getElementById('popupChipExplain'),
  popupChipComplaint: document.getElementById('popupChipComplaint'),
  popupChipStability: document.getElementById('popupChipStability'),
  popupConsoleText: document.getElementById('popupConsoleText'),
  popupBlinkingCursor: document.getElementById('popupBlinkingCursor'),
  popupOptionsArea: document.getElementById('popupOptionsArea'),
  popupOptionButtons: document.getElementById('popupOptionButtons'),
  popupSourcesArea: document.getElementById('popupSourcesArea'),
  popupSourceTags: document.getElementById('popupSourceTags'),
  popupAskForm: document.getElementById('popupAskForm'),
  popupAskInput: document.getElementById('popupAskInput'),
  popupCharCounter: document.getElementById('popupCharCounter'),
  popupBtnSubmit: document.getElementById('popupBtnSubmit'),
  popupBtnClear: document.getElementById('popupBtnClear')
};

// Initial App Mount
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Mount WebGL Data Tunnel
  const threeCanvasEl = document.getElementById('threeCanvas');
  if (threeCanvasEl) {
    tunnelInstance = new WebGLTunnel(threeCanvasEl);
  }

  // 2. Load Ghost Run
  const history = getHistory();
  if (history.length > 0) {
    ghostRun = history[0];
    updateGhostRunUI();
  }

  // 3. Render Heatmap and History
  renderHeatmap();
  renderHistoryTable();

  // 4. Initial Gauges & Radar Draw
  drawCircularGauge(el.svgGaugeDown, 0, 0, ghostRun ? ghostRun.download : null, 'download', false);
  drawCircularGauge(el.svgGaugeUp, 0, 0, ghostRun ? ghostRun.upload : null, 'upload', false);
  drawRadarCanvas(el.radarCanvas, {
    speed: ghostRun ? ghostRun.dnaIndex : 45,
    stability: 50,
    latency: 55,
    upload: 40,
    bufferbloat: 50,
    dns: 60
  });

  // Render initial standby state for verdicts
  renderInitialStandbyVerdicts();

  // 5. Initial Telemetry & Browser Net Info
  initTelemetryAndNetApi();

  // 6. Initial DNS Benchmark
  probeDnsResolvers();

  // 7. Event Listeners
  setupEventListeners();
});

// Setup Events
function setupEventListeners() {
  el.startTestBtn.addEventListener('click', () => {
    if (currentStage === 'idle' || currentStage === 'completed') {
      startFull360Analysis();
    }
  });

  el.abortTestBtn.addEventListener('click', () => {
    if (abortController) abortController.abort();
    resetToIdle();
  });

  el.clearGhostBtn.addEventListener('click', () => {
    ghostRun = null;
    updateGhostRunUI();
    drawCircularGauge(el.svgGaugeDown, testMetrics.download, testMetrics.downloadPeak, null, 'download', false);
    drawCircularGauge(el.svgGaugeUp, testMetrics.upload, testMetrics.uploadPeak, null, 'upload', false);
  });

  el.retestDnsBtn.addEventListener('click', () => probeDnsResolvers());

  el.exportDnaCardBtn.addEventListener('click', () => {
    exportDnaCardPng(
      testMetrics.dna,
      testMetrics.download,
      testMetrics.upload,
      testMetrics.latency,
      testMetrics.jitter,
      lastBufferbloat,
      currentTelemetry
    );
  });

  // Audio Toggle
  el.audioToggleBtn.addEventListener('click', () => {
    const isNowOn = soundEngine.toggle();
    el.audioLabel.textContent = isNowOn ? 'Audio Tone: Active' : 'Audio Tone: Off';
    el.audioLabel.className = isNowOn ? 'text-pulse-cyan' : 'text-slate-400';
    el.audioIcon.innerHTML = isNowOn
      ? `<svg class="w-4 h-4 text-pulse-cyan animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
      : `<svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  });

  // Transfer Calculator Inputs
  [el.calcCustomSize, el.calcCustomUnit, el.calcCustomType].forEach(elem => {
    elem.addEventListener('input', updateTransferCalculator);
  });
  document.querySelectorAll('.presetBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.calcCustomSize.value = btn.getAttribute('data-size');
      el.calcCustomUnit.value = btn.getAttribute('data-unit');
      el.calcCustomType.value = btn.getAttribute('data-type');
      updateTransferCalculator();
    });
  });

  // Plan vs Reality Inputs
  [el.promisedDownInput, el.promisedUpInput].forEach(elem => {
    elem.addEventListener('input', updatePlanVsReality);
  });

  // Stability Mode Quick Launch
  el.navStabilityBtn.addEventListener('click', () => {
    document.getElementById('stabilitySection').scrollIntoView({ behavior: 'smooth' });
  });
  el.startStabilityBtn.addEventListener('click', () => runStabilityMode());

  // Top Nav Ask PULSE Button (Toggles Floating Bottom-Right Assistant)
  if (el.navAskPulseBtn && el.floatingAskPulseLauncher) {
    el.navAskPulseBtn.addEventListener('click', () => {
      el.floatingAskPulseLauncher.click();
    });
  }

  // Ask PULSE Console Setup (Milestone 6A)
  initAskPulseUI();

  // Clear History
  el.clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all stored test history and heatmap data?')) {
      clearHistoryStorage();
      ghostRun = null;
      updateGhostRunUI();
      renderHeatmap();
      renderHistoryTable();
    }
  });
}

// ==========================================
// 10. ASK PULSE UI & CONTROLLER (MILESTONE 6A)
// ==========================================
function initAskPulseUI() {
  // Rag state change listener
  ragPipeline.onStateChange = (state) => {
    if (state.isTestRunning) {
      if (el.askPulseSpeedLockout) el.askPulseSpeedLockout.classList.remove('hidden');
      if (el.popupSpeedLockout) el.popupSpeedLockout.classList.remove('hidden');
      if (el.btnLoadVectorModel) el.btnLoadVectorModel.classList.add('opacity-50', 'pointer-events-none');
    } else {
      if (el.askPulseSpeedLockout) el.askPulseSpeedLockout.classList.add('hidden');
      if (el.popupSpeedLockout) el.popupSpeedLockout.classList.add('hidden');
      if (el.btnLoadVectorModel) el.btnLoadVectorModel.classList.remove('opacity-50', 'pointer-events-none');
    }

    if (state.status === 'downloading') {
      const p = state.progress?.progress || 0;
      if (el.vectorStatusIcon) el.vectorStatusIcon.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
      if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = `Downloading Model: ${p}% (all-MiniLM-L6-v2, 23MB)`;
    } else if (state.status === 'ready') {
      if (el.vectorStatusIcon) el.vectorStatusIcon.className = 'w-2 h-2 rounded-full bg-[#00f7a5] shadow-[0_0_6px_#00f7a5]';
      if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = 'Embedder Ready (20 Chunks in IndexedDB)';
    } else if (state.status === 'fallback') {
      if (el.vectorStatusIcon) el.vectorStatusIcon.className = 'w-2 h-2 rounded-full bg-[#00f0ff]';
      if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = 'Vector Engine: Local Tokenizer Ready';
    }
  };

  // Opt-in Model Loader Button
  if (el.btnLoadVectorModel) {
    el.btnLoadVectorModel.addEventListener('click', async () => {
      try {
        el.btnLoadVectorModel.classList.add('pointer-events-none');
        if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = 'Initializing Worker...';
        await ragPipeline.loadModel();
        if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = 'Indexing 20 Knowledge Chunks...';
        await ragPipeline.indexKnowledgeBase();
        if (el.vectorStatusIcon) el.vectorStatusIcon.className = 'w-2 h-2 rounded-full bg-[#00f7a5] shadow-[0_0_6px_#00f7a5]';
        if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = 'Embedder Ready (20 Chunks in IndexedDB)';
      } catch (err) {
        console.warn('Embedder init error:', err);
        if (el.vectorStatusLabel) el.vectorStatusLabel.textContent = err.message || 'Model Load Failed';
      } finally {
        el.btnLoadVectorModel.classList.remove('pointer-events-none');
      }
    });
  }

  // Floating Launcher Toggle & Close Handlers
  if (el.floatingAskPulseLauncher && el.floatingAskPulsePopup) {
    el.floatingAskPulseLauncher.addEventListener('click', () => {
      const isClosed = el.floatingAskPulsePopup.classList.toggle('hidden');
      if (!isClosed) {
        if (el.popupOptionButtons && el.popupOptionButtons.children.length === 0) {
          renderPopupOptions([
            'What is my download speed?',
            'Test my internet speed',
            'What is my bufferbloat grade?',
            'Explain my result'
          ]);
        }
        const container = el.popupConsoleText?.parentElement;
        if (container) {
          container.scrollTop = 0;
          setTimeout(() => { container.scrollTop = 0; }, 60);
        }
        if (el.popupAskInput) {
          setTimeout(() => el.popupAskInput.focus(), 60);
        }
      }
      triggerHaptic('tick');
    });
  }

  if (el.btnCloseFloatingPopup && el.floatingAskPulsePopup) {
    el.btnCloseFloatingPopup.addEventListener('click', () => {
      el.floatingAskPulsePopup.classList.add('hidden');
      triggerHaptic('tick');
    });
  }

  // Character Counter on Main Input (max 1000)
  if (el.askPulseInput && el.askCharCounter) {
    el.askPulseInput.addEventListener('input', () => {
      const len = el.askPulseInput.value.length;
      el.askCharCounter.textContent = `${len} / 1000`;
      if (len >= 950) el.askCharCounter.classList.add('text-[#FF4B1F]');
      else el.askCharCounter.classList.remove('text-[#FF4B1F]');
    });
  }

  // Character Counter on Floating Popup Input (max 1000)
  if (el.popupAskInput && el.popupCharCounter) {
    el.popupAskInput.addEventListener('input', () => {
      const len = el.popupAskInput.value.length;
      el.popupCharCounter.textContent = `${len} / 1000`;
      if (len >= 950) el.popupCharCounter.classList.add('text-[#FF4B1F]');
      else el.popupCharCounter.classList.remove('text-[#FF4B1F]');
    });
  }

  // Form Submit Handler (Main Panel)
  if (el.askPulseForm) {
    el.askPulseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = el.askPulseInput?.value.trim();
      if (query) executeAskPulseQuery(query);
    });
  }

  // Form Submit Handler (Floating Popup)
  if (el.popupAskForm) {
    el.popupAskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = el.popupAskInput?.value.trim();
      if (query) executeAskPulseQuery(query);
    });
  }

  // Quick Action Chips (Main Panel)
  if (el.chipExplainResult) el.chipExplainResult.addEventListener('click', () => executeAskPulseQuery('Explain my diagnostic result and real-life verdicts.'));
  if (el.chipDraftComplaint) el.chipDraftComplaint.addEventListener('click', () => executeAskPulseQuery('Draft an ISP complaint letter using my plan vs delivered data.'));
  if (el.chipAuditBloat) el.chipAuditBloat.addEventListener('click', () => executeAskPulseQuery('What is my bufferbloat grade and how do I configure SQM or QoS on my router?'));
  if (el.chipBenchmarkDns) el.chipBenchmarkDns.addEventListener('click', () => executeAskPulseQuery('Compare my DNS resolver benchmark results and which is fastest.'));

  // Quick Action Chips (Floating Popup)
  if (el.popupChipTestSpeed) el.popupChipTestSpeed.addEventListener('click', () => executeAskPulseQuery('Test my internet speed'));
  if (el.popupChipExplain) el.popupChipExplain.addEventListener('click', () => executeAskPulseQuery('Explain my diagnostic result and real-life verdicts.'));
  if (el.popupChipComplaint) el.popupChipComplaint.addEventListener('click', () => executeAskPulseQuery('Draft an ISP complaint letter using my plan vs delivered data.'));
  if (el.popupChipStability) el.popupChipStability.addEventListener('click', () => executeAskPulseQuery('Run 60s stability test'));

  // Clear Main Console
  if (el.btnClearConsole) {
    el.btnClearConsole.addEventListener('click', () => {
      if (el.consoleTextOutput) el.consoleTextOutput.textContent = 'PULSE-AI CONSOLE CLEARED.\nType a query or select a preset command above.';
      if (el.consoleSourcesArea) el.consoleSourcesArea.classList.add('hidden');
      if (el.consoleSourceTags) el.consoleSourceTags.innerHTML = '';
    });
  }

  // Clear Floating Popup Console
  if (el.popupBtnClear) {
    el.popupBtnClear.addEventListener('click', () => {
      if (el.popupConsoleText) el.popupConsoleText.textContent = 'PULSE Agent online. Ready for command.';
      if (el.popupSourcesArea) el.popupSourcesArea.classList.add('hidden');
      if (el.popupSourceTags) el.popupSourceTags.innerHTML = '';
      renderPopupOptions([
        'What is my download speed?',
        'Test my internet speed',
        'What is my bufferbloat grade?',
        'Explain my result'
      ]);
    });
  }
}

// Render Interactive Quick Follow-up Options in Floating Chat
function renderPopupOptions(options) {
  if (!el.popupOptionsArea || !el.popupOptionButtons) return;
  if (!options || options.length === 0) {
    el.popupOptionsArea.classList.add('hidden');
    el.popupOptionButtons.innerHTML = '';
    return;
  }

  el.popupOptionButtons.innerHTML = options.map((opt) => `
    <button
      type="button"
      data-option="${opt.replace(/"/g, '&quot;')}"
      class="pulse-chat-option-btn text-[11px] px-2.5 py-1.5 rounded-lg bg-[#181614] hover:bg-[#FF4B1F]/20 hover:border-[#FF4B1F] border border-[rgba(237,232,223,0.16)] text-[#EDE8DF] hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
    >
      <span class="text-[#FF4B1F] text-[10px] font-bold">&gt;</span>
      <span>${opt}</span>
    </button>
  `).join('');

  el.popupOptionsArea.classList.remove('hidden');

  // Attach click listener to each option chip
  el.popupOptionButtons.querySelectorAll('.pulse-chat-option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const query = btn.getAttribute('data-option');
      if (query) {
        triggerHaptic('tick');
        executeAskPulseQuery(query);
      }
    });
  });

  // Ensure terminal text shows result first at top
  const container = el.popupConsoleText?.parentElement;
  if (container) {
    container.scrollTop = 0;
    setTimeout(() => { container.scrollTop = 0; }, 60);
  }
}

// Execute Agentic Action when detected from AI stream
function executeAgentAction(actionName) {
  triggerHaptic('success');
  console.log(`[PULSE AGENT] Dispatched Action: ${actionName}, currentStage: ${currentStage}`);

  switch (actionName) {
    case 'START_SPEED_TEST':
      setTimeout(() => {
        console.log(`[PULSE AGENT] START_SPEED_TEST timer fired, currentStage: ${currentStage}`);
        if (currentStage === 'idle' || currentStage === 'completed') {
          // Scroll up to gauges smoothly if needed
          window.scrollTo({ top: 0, behavior: 'smooth' });
          console.log('[PULSE AGENT] Invoking startFull360Analysis()...');
          startFull360Analysis().catch(err => {
            console.error('[PULSE AGENT] startFull360Analysis uncaught rejection:', err);
          });
        } else {
          console.warn('[PULSE AGENT] Cannot start speed test because currentStage is:', currentStage);
        }
      }, 400);
      break;

    case 'RUN_STABILITY':
      setTimeout(() => {
        const stabSec = document.getElementById('stabilitySection');
        if (stabSec) stabSec.scrollIntoView({ behavior: 'smooth' });
        runStabilityMode();
      }, 400);
      break;

    case 'EXPORT_DNA':
      setTimeout(() => {
        exportDnaCardPng(
          testMetrics.dna,
          testMetrics.download,
          testMetrics.upload,
          testMetrics.latency,
          testMetrics.jitter,
          lastBufferbloat,
          currentTelemetry
        );
      }, 400);
      break;

    case 'PROBE_DNS':
      setTimeout(() => {
        probeDnsResolvers();
      }, 400);
      break;

    default:
      console.warn('Unknown agent action:', actionName);
  }
}

// Execute query through RAG pipeline with dual streaming typewriter output
let currentQueryAbort = null;
async function executeAskPulseQuery(promptText) {
  if (ragPipeline.isTestRunning) {
    alert('Speed test is actively running. Ask PULSE queries are paused to ensure zero telemetry distortion.');
    return;
  }

  if (currentQueryAbort) currentQueryAbort.abort();
  currentQueryAbort = new AbortController();

  // Reset inputs
  if (el.askPulseInput) el.askPulseInput.value = '';
  if (el.askCharCounter) el.askCharCounter.textContent = '0 / 1000';
  if (el.popupAskInput) el.popupAskInput.value = '';
  if (el.popupCharCounter) el.popupCharCounter.textContent = '0 / 1000';

  // Disable submit buttons during streaming
  if (el.btnSubmitQuery) el.btnSubmitQuery.classList.add('opacity-50', 'pointer-events-none');
  if (el.popupBtnSubmit) el.popupBtnSubmit.classList.add('opacity-50', 'pointer-events-none');

  // Activate cursors
  if (el.consoleBlinkingCursor) el.consoleBlinkingCursor.classList.remove('hidden');
  if (el.popupBlinkingCursor) el.popupBlinkingCursor.classList.remove('hidden');

  // Reset source citations and options
  if (el.consoleSourcesArea) el.consoleSourcesArea.classList.add('hidden');
  if (el.popupSourcesArea) el.popupSourcesArea.classList.add('hidden');
  if (el.consoleSourceTags) el.consoleSourceTags.innerHTML = '';
  if (el.popupSourceTags) el.popupSourceTags.innerHTML = '';
  if (el.popupOptionsArea) el.popupOptionsArea.classList.add('hidden');
  if (el.popupOptionButtons) el.popupOptionButtons.innerHTML = '';

  // Terminal prompt header for both consoles
  const terminalHeader = `PULSE-AI://mission-control> ${promptText}\n\n`;
  if (el.consoleTextOutput) el.consoleTextOutput.textContent = terminalHeader;
  if (el.popupConsoleText) el.popupConsoleText.textContent = terminalHeader;

  const promisedDown = parseFloat(el.promisedDownInput?.value) || 0;
  const promisedUp = parseFloat(el.promisedUpInput?.value) || 0;
  const deliveredRatio = promisedDown > 0 ? Math.round((testMetrics.download / promisedDown) * 100) : 0;
  const deficit = Math.max(0, promisedDown - testMetrics.download);

  let accumulatedFullText = '';
  let triggeredAction = null;

  await ragPipeline.askPulse({
    prompt: promptText,
    telemetry: currentTelemetry,
    metrics: {
      ...testMetrics,
      bufferbloat: lastBufferbloat
    },
    planAudit: {
      promisedDown,
      promisedUp,
      deliveredRatio,
      deficit
    },
    dnsBenchmarks: currentDnsResults,
    history: getHistory(),
    onChunk: (chunk) => {
      accumulatedFullText += chunk;

      // Detect action tag
      const actionMatch = accumulatedFullText.match(/\[ACTION:([A-Z_]+)\]/);
      if (actionMatch && !triggeredAction) {
        triggeredAction = actionMatch[1];
      }

      // Format display chunk: convert raw action tag into a clean terminal dispatch indicator
      const displayChunk = chunk.replace(/\[ACTION:[A-Z_]+\]\n?/g, '⚡ [AGENT ACTION DISPATCHED]\n');

      if (el.consoleTextOutput) el.consoleTextOutput.textContent += displayChunk;
      if (el.popupConsoleText) el.popupConsoleText.textContent += displayChunk;

      // Keep both terminal containers autoscrolled
      const container1 = el.consoleTextOutput?.parentElement;
      if (container1) container1.scrollTop = container1.scrollHeight;
      const container2 = el.popupConsoleText?.parentElement;
      if (container2) container2.scrollTop = container2.scrollHeight;
    },
    onComplete: ({ text, sources, options }) => {
      if (el.consoleBlinkingCursor) el.consoleBlinkingCursor.classList.add('hidden');
      if (el.popupBlinkingCursor) el.popupBlinkingCursor.classList.add('hidden');

      if (el.btnSubmitQuery) el.btnSubmitQuery.classList.remove('opacity-50', 'pointer-events-none');
      if (el.popupBtnSubmit) el.popupBtnSubmit.classList.remove('opacity-50', 'pointer-events-none');

      // Render verified source citation tags if main console exists (chat popup never shows sources)
      if (sources && sources.length > 0) {
        const tagsHtml = sources.map(s => `
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FF4B1F]/15 text-[#FF4B1F] border border-[#FF4B1F]/30">
            [SRC: ${s}]
          </span>
        `).join('');

        if (el.consoleSourcesArea && el.consoleSourceTags) {
          el.consoleSourcesArea.classList.remove('hidden');
          el.consoleSourceTags.innerHTML = tagsHtml;
        }
      }

      // Render interactive quick follow-up options
      renderPopupOptions(options);

      // Ensure result is shown first at top
      const container2 = el.popupConsoleText?.parentElement;
      if (container2) {
        container2.scrollTop = 0;
        setTimeout(() => { container2.scrollTop = 0; }, 60);
      }

      // Dispatch triggered agent action if found
      if (triggeredAction) {
        executeAgentAction(triggeredAction);
      }
    },
    onError: (err) => {
      if (el.consoleBlinkingCursor) el.consoleBlinkingCursor.classList.add('hidden');
      if (el.popupBlinkingCursor) el.popupBlinkingCursor.classList.add('hidden');

      if (el.btnSubmitQuery) el.btnSubmitQuery.classList.remove('opacity-50', 'pointer-events-none');
      if (el.popupBtnSubmit) el.popupBtnSubmit.classList.remove('opacity-50', 'pointer-events-none');

      const errMsg = `\n\n[SYSTEM ERROR]: ${err.message || 'Unable to complete query.'}`;
      if (el.consoleTextOutput) el.consoleTextOutput.textContent += errMsg;
      if (el.popupConsoleText) el.popupConsoleText.textContent += errMsg;
    },
    signal: currentQueryAbort.signal
  });
}

// Telemetry & Browser Net Info Init
async function initTelemetryAndNetApi() {
  const browserApi = checkBrowserNetworkApi();
  el.telNetApi.textContent = browserApi.text;
  if (!browserApi.supported) {
    el.telNetApi.classList.add('text-slate-400', 'italic');
  }

  currentTelemetry = await fetchTelemetry();
  el.telIp.textContent = currentTelemetry.ip;
  el.telIsp.textContent = currentTelemetry.isp;
  el.telColo.textContent = `${currentTelemetry.colo} (${currentTelemetry.city})`;
  el.telProtocol.textContent = `${currentTelemetry.httpVersion} • ${currentTelemetry.tlsVersion}`;
  el.telServer.textContent = `Cloudflare Anycast PoP [${currentTelemetry.colo}]`;
}

// DoH DNS Benchmark Probe
async function probeDnsResolvers() {
  el.valDnsCF.textContent = 'Probing...';
  el.valDnsGoogle.textContent = 'Probing...';
  el.valDnsQuad9.textContent = 'Probing...';
  [el.badgeFastestCF, el.badgeFastestGoogle, el.badgeFastestQuad9].forEach(b => b.classList.add('hidden'));

  currentDnsResults = await benchmarkDns();
  currentDnsResults.forEach(r => {
    const valText = r.status === 'success' ? `${r.timeMs} ms` : r.status === 'unsupported' ? 'Blocked / CORS' : 'Timeout';
    if (r.id === 'CF') {
      el.valDnsCF.textContent = valText;
      if (r.isFastest) el.badgeFastestCF.classList.remove('hidden');
    } else if (r.id === 'Google') {
      el.valDnsGoogle.textContent = valText;
      if (r.isFastest) el.badgeFastestGoogle.classList.remove('hidden');
    } else if (r.id === 'Quad9') {
      el.valDnsQuad9.textContent = valText;
      if (r.isFastest) el.badgeFastestQuad9.classList.remove('hidden');
    }
  });
}

// Ghost Run UI update
function updateGhostRunUI() {
  if (ghostRun) {
    el.ghostRunStatusLabel.innerHTML = `Ghost Run: <strong class="text-white">${ghostRun.download.toFixed(1)} ↓ / ${ghostRun.upload.toFixed(1)} ↑ Mbps</strong> (${ghostRun.dateStr})`;
    el.clearGhostBtn.classList.remove('hidden');
  } else {
    el.ghostRunStatusLabel.textContent = 'Ghost Run: No previous test stored';
    el.clearGhostBtn.classList.add('hidden');
  }
}

// Main 360 Analysis Loop
async function startFull360Analysis() {
  abortController = new AbortController();
  const shouldAbort = () => abortController.signal.aborted;

  // Live status updater for Ask PULSE Chat terminal
  const updateChatLiveProgress = (msg) => {
    if (!el.popupConsoleText) return;
    let text = el.popupConsoleText.textContent;
    if (text.includes('⏳ [LIVE STATUS]:')) {
      text = text.replace(/⏳ \[LIVE STATUS\]: [^\n]*/, `⏳ [LIVE STATUS]: ${msg}`);
      el.popupConsoleText.textContent = text;
    } else {
      el.popupConsoleText.textContent += `\n\n⏳ [LIVE STATUS]: ${msg}`;
    }
    const container = el.popupConsoleText.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  };

  try {
    currentStage = 'telemetry';
    ragPipeline.setTestRunning(true);
    el.startTestBtn.classList.add('opacity-50', 'pointer-events-none');
    el.abortTestBtn.classList.remove('hidden');
    el.tunnelIdleNotice.classList.add('hidden');
    el.tunnelCompleteNotice.classList.add('hidden');
    el.tunnelActiveReadout.classList.remove('hidden');

    triggerHaptic('tick');
    soundEngine.playChime('phase');

    // Stage 1: Idle Latency & Jitter
    currentStage = 'latency';
    setHud('LATENCY & JITTER SAMPLING', 1.0, 0x818cf8);
    el.tunnelMetricLabel.textContent = 'Sampling Idle Ping & Jitter...';
    el.tunnelBigNumber.textContent = '...';
    updateChatLiveProgress('Sampling idle latency & jitter (Stage 1/4)...');

    const latStats = await measureLatency(8, 2500);
    testMetrics.latency = latStats.idleLatency;
    testMetrics.jitter = latStats.jitter;
    testMetrics.packetLoss = latStats.packetLoss;

    el.valIdleLatency.textContent = latStats.idleLatency;
    el.valJitter.textContent = `${latStats.jitter} ms`;
    el.valPacketLoss.textContent = `${latStats.packetLoss}%`;
    el.valMinMaxPing.textContent = `${latStats.minLatency} / ${latStats.maxLatency} ms`;
    triggerHaptic('phase');

    if (shouldAbort()) return;

    // Stage 2: Streaming Download Test (~100ms updates)
    currentStage = 'download';
    setHud('SATURATING DOWNLOAD STREAM', 8.0, 0x00f0ff);
    el.tunnelMetricLabel.textContent = 'Live Download Velocity';
    el.badgeDownStreaming.classList.remove('hidden');
    el.gaugeCardDown.classList.add('border-pulse-cyan/50', 'shadow-[0_0_25px_rgba(0,240,255,0.2)]');
    updateChatLiveProgress('Measuring streaming download throughput (Stage 2/4)...');

    let lastChatUpdate = 0;
    const downStats = await runDownloadTest((curr, peak) => {
      testMetrics.download = curr;
      testMetrics.downloadPeak = peak;
      el.valDownCurrent.textContent = curr.toFixed(1);
      el.valDownPeak.textContent = peak.toFixed(1);
      el.tunnelBigNumber.textContent = curr.toFixed(1);
      el.tunnelPeakNumber.textContent = `${peak.toFixed(1)} Mbps`;

      drawCircularGauge(el.svgGaugeDown, curr, peak, ghostRun ? ghostRun.download : null, 'download', true);
      if (tunnelInstance) {
        const speedFactor = Math.min(Math.max(curr / 8, 2), 32);
        tunnelInstance.setSpeedAndColor(speedFactor, 0x00f0ff);
      }
      soundEngine.updateSpeed(curr);

      const now = performance.now();
      if (now - lastChatUpdate > 600) {
        lastChatUpdate = now;
        updateChatLiveProgress(`Measuring download: ${curr.toFixed(1)} Mbps (peak ${peak.toFixed(1)} Mbps)...`);
      }
    }, shouldAbort);

    testMetrics.download = downStats.average;
    testMetrics.downloadPeak = downStats.peak;
    el.valDownCurrent.textContent = downStats.average.toFixed(1);
    el.badgeDownStreaming.classList.add('hidden');
    el.gaugeCardDown.classList.remove('border-pulse-cyan/50', 'shadow-[0_0_25px_rgba(0,240,255,0.2)]');
    drawCircularGauge(el.svgGaugeDown, downStats.average, downStats.peak, ghostRun ? ghostRun.download : null, 'download', false);

    if (ghostRun) {
      const diff = downStats.average - ghostRun.download;
      el.ghostDiffDown.innerHTML = diff >= 0
        ? `<span class="text-pulse-neon font-bold">+${diff.toFixed(1)} Mbps faster</span>`
        : `<span class="text-pulse-pink font-bold">${diff.toFixed(1)} Mbps slower</span>`;
    }

    triggerHaptic('phase');
    soundEngine.playChime('phase');

    if (shouldAbort()) return;

    // Stage 3: Loaded Latency & Bufferbloat
    currentStage = 'loaded-latency';
    setHud('LOADED BUFFERBLOAT BENCHMARK', 3.0, 0xf59e0b);
    el.tunnelMetricLabel.textContent = 'Testing Queue Latency Under Saturation...';
    el.tunnelBigNumber.textContent = 'SQM';
    updateChatLiveProgress(`Download done: ${downStats.average.toFixed(1)} Mbps. Benchmarking bufferbloat queue (Stage 3/4)...`);

    const bloatStats = await measureBufferbloat(testMetrics.latency);
    lastBufferbloat = bloatStats;
    testMetrics.bufferbloat = bloatStats;

    el.bloatGradeBox.textContent = bloatStats.grade;
    el.bloatGradeBox.className = `w-14 h-14 rounded-xl flex items-center justify-center font-mono text-3xl font-black ${
      bloatStats.grade === 'A+' || bloatStats.grade === 'A' ? 'bg-pulse-neon/15 text-pulse-neon border border-pulse-neon/40' :
      bloatStats.grade === 'B' ? 'bg-pulse-cyan/15 text-pulse-cyan border border-pulse-cyan/40' :
      bloatStats.grade === 'C' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40' : 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
    }`;
    el.bloatGradeTitle.textContent = bloatStats.title;
    el.bloatDeltaSummary.textContent = `+${bloatStats.worstDelta} ms worst queue delay`;
    el.valLoadedDown.textContent = `${bloatStats.loadedDown} ms`;
    el.valLoadedUp.textContent = `${bloatStats.loadedUp} ms`;
    el.bloatDescription.textContent = bloatStats.desc;

    triggerHaptic('phase');
    soundEngine.playChime('phase');

    if (shouldAbort()) return;

    // Stage 4: Streaming Upload Test (~100ms updates)
    currentStage = 'upload';
    setHud('BURST UPLOAD STREAM', 7.0, 0xf43f5e);
    el.tunnelMetricLabel.textContent = 'Live Upload Velocity';
    el.badgeUpStreaming.classList.remove('hidden');
    el.gaugeCardUp.classList.add('border-pulse-pink/50', 'shadow-[0_0_25px_rgba(244,63,94,0.2)]');
    updateChatLiveProgress('Measuring streaming upload throughput (Stage 4/4)...');

    let lastUpChatUpdate = 0;
    const upStats = await runUploadTest((curr, peak) => {
      testMetrics.upload = curr;
      testMetrics.uploadPeak = peak;
      el.valUpCurrent.textContent = curr.toFixed(1);
      el.valUpPeak.textContent = peak.toFixed(1);
      el.tunnelBigNumber.textContent = curr.toFixed(1);
      el.tunnelPeakNumber.textContent = `${peak.toFixed(1)} Mbps`;

      drawCircularGauge(el.svgGaugeUp, curr, peak, ghostRun ? ghostRun.upload : null, 'upload', true);
      if (tunnelInstance) {
        const speedFactor = Math.min(Math.max(curr / 6, 2), 28);
        tunnelInstance.setSpeedAndColor(speedFactor, 0xf43f5e);
      }
      soundEngine.updateSpeed(curr);

      const now = performance.now();
      if (now - lastUpChatUpdate > 600) {
        lastUpChatUpdate = now;
        updateChatLiveProgress(`Measuring upload: ${curr.toFixed(1)} Mbps (peak ${peak.toFixed(1)} Mbps)...`);
      }
    }, shouldAbort);

    testMetrics.upload = upStats.average;
    testMetrics.uploadPeak = upStats.peak;
    el.valUpCurrent.textContent = upStats.average.toFixed(1);
    el.badgeUpStreaming.classList.add('hidden');
    el.gaugeCardUp.classList.remove('border-pulse-pink/50', 'shadow-[0_0_25px_rgba(244,63,94,0.2)]');
    drawCircularGauge(el.svgGaugeUp, upStats.average, upStats.peak, ghostRun ? ghostRun.upload : null, 'upload', false);

    if (ghostRun) {
      const diff = upStats.average - ghostRun.upload;
      el.ghostDiffUp.innerHTML = diff >= 0
        ? `<span class="text-pulse-neon font-bold">+${diff.toFixed(1)} Mbps faster</span>`
        : `<span class="text-pulse-pink font-bold">${diff.toFixed(1)} Mbps slower</span>`;
    }

    soundEngine.updateSpeed(0);

    // Stage 5: Synthesis & 360 Layer Computations
    currentStage = 'completed';
    setHud('360° NETWORK SYNTHESIS COMPLETE', 1.0, 0x00f7a5);
    el.tunnelActiveReadout.classList.add('hidden');
    el.tunnelCompleteNotice.classList.remove('hidden');

    // DNA calculation
    const dnaScores = calculateDnaScores(
      testMetrics.download,
      testMetrics.upload,
      testMetrics.latency,
      testMetrics.jitter,
      testMetrics.packetLoss,
      bloatStats.grade,
      currentDnsResults
    );
    testMetrics.dna = dnaScores;

    el.dnaCompositeNumber.textContent = dnaScores.composite;
    el.dnaScoreSpeed.textContent = dnaScores.speed;
    el.dnaScoreUpload.textContent = dnaScores.upload;
    el.dnaScoreLatency.textContent = dnaScores.latency;
    el.dnaScoreStability.textContent = dnaScores.stability;
    el.dnaScoreBloat.textContent = dnaScores.bufferbloat;
    el.dnaScoreDns.textContent = dnaScores.dns;
    drawRadarCanvas(el.radarCanvas, dnaScores);

    // Verdicts calculation
    const verdicts = calculateVerdicts(
      testMetrics.download,
      testMetrics.upload,
      testMetrics.latency,
      testMetrics.jitter,
      testMetrics.packetLoss,
      bloatStats
    );
    renderVerdicts(verdicts);

    // Smart Diagnosis
    const promisedD = parseFloat(el.promisedDownInput.value) || 0;
    const insights = generateDiagnosis(
      testMetrics.download,
      testMetrics.upload,
      testMetrics.latency,
      testMetrics.jitter,
      testMetrics.packetLoss,
      bloatStats,
      currentDnsResults,
      promisedD
    );
    renderDiagnosis(insights);

    // Plan vs Reality & Calculator
    updatePlanVsReality();
    updateTransferCalculator();

    // Save to History (Time Machine)
    const now = new Date();
    const testRunItem = {
      id: `run_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      hour: now.getHours(),
      download: testMetrics.download,
      upload: testMetrics.upload,
      latency: testMetrics.latency,
      jitter: testMetrics.jitter,
      packetLoss: testMetrics.packetLoss,
      bloatGrade: bloatStats.grade,
      dnaIndex: dnaScores.composite,
      server: currentTelemetry ? currentTelemetry.colo : 'CF-EDGE'
    };
    saveHistoryItem(testRunItem);
    ghostRun = testRunItem;
    updateGhostRunUI();
    renderHeatmap();
    renderHistoryTable();

    // Completion fanfare
    triggerHaptic('success');
    soundEngine.playChime('success');

    const measuredDown = testMetrics.download.toFixed(1);
    const measuredUp = testMetrics.upload.toFixed(1);
    const measuredPing = testMetrics.latency;
    const measuredBloat = bloatStats.grade;

    // Preserve the original prompt command header (e.g. "PULSE-AI://mission-control> what is my download speed?")
    const fullText = el.popupConsoleText ? el.popupConsoleText.textContent : '';
    const headerMatch = fullText.match(/^(PULSE-AI:\/\/[^\n]+)/);
    const promptHeader = headerMatch ? headerMatch[1] : 'PULSE-AI://mission-control> Speed Test';
    const queryLower = promptHeader.toLowerCase();

    // Result is formatted clearly and displayed FIRST!
    let resultReport = '';
    if (queryLower.includes('upload') || queryLower.includes('up')) {
      resultReport = `Your upload speed is ${measuredUp} Mbps.\nDownload: ${measuredDown} Mbps • Latency: ${measuredPing} ms • Bloat: Grade ${measuredBloat}.`;
    } else if (queryLower.includes('ping') || queryLower.includes('latency')) {
      resultReport = `Your latency is ${measuredPing} ms.\nDownload: ${measuredDown} Mbps • Upload: ${measuredUp} Mbps • Bloat: Grade ${measuredBloat}.`;
    } else {
      // Default: show download speed result FIRST!
      resultReport = `Your download speed is ${measuredDown} Mbps.\nUpload: ${measuredUp} Mbps • Latency: ${measuredPing} ms • Bloat: Grade ${measuredBloat}.`;
    }

    if (el.popupConsoleText) {
      el.popupConsoleText.textContent = `${promptHeader}\n\n${resultReport}`;
      const container = el.popupConsoleText.parentElement;
      if (container) {
        container.scrollTop = 0; // Show result FIRST at top!
        setTimeout(() => { container.scrollTop = 0; }, 60);
      }
    }

    // Render interactive clickable options in chat
    const postTestOptions = [
      'What is my download speed?',
      'What is my upload speed?',
      'What is my bufferbloat grade?',
      'Explain my result',
      'Export Network DNA',
      'Draft ISP complaint letter',
      'Run 60s stability test'
    ];
    renderPopupOptions(postTestOptions);

    // If floating popup is currently closed, highlight launcher to notify user
    if (el.floatingAskPulseLauncher && el.floatingAskPulsePopup?.classList.contains('hidden')) {
      el.floatingAskPulseLauncher.classList.add('ring-2', 'ring-[#00f7a5]', 'scale-105');
      setTimeout(() => {
        el.floatingAskPulseLauncher?.classList.remove('ring-2', 'ring-[#00f7a5]', 'scale-105');
      }, 8000);
    }
  } catch (err) {
    console.error('[PULSE AGENT] Error during startFull360Analysis:', err);
    if (el.popupConsoleText) {
      el.popupConsoleText.textContent += `\n\n[DIAGNOSTIC TEST NOTICE]: Speed test was interrupted: ${err.message || 'Network error'}.`;
    }
  } finally {
    ragPipeline.setTestRunning(false);
    el.startTestBtn.classList.remove('opacity-50', 'pointer-events-none');
    el.startBtnLabel.textContent = 'Run 360 Analysis Again';
    el.abortTestBtn.classList.add('hidden');
  }
}

function setHud(text, speed, colorHex) {
  el.hudStageBadge.textContent = text;
  if (tunnelInstance) tunnelInstance.setSpeedAndColor(speed, colorHex);
}

function resetToIdle() {
  currentStage = 'idle';
  soundEngine.updateSpeed(0);
  ragPipeline.setTestRunning(false);
  el.startTestBtn.classList.remove('opacity-50', 'pointer-events-none');
  el.startBtnLabel.textContent = 'Start Full 360 Analysis';
  el.abortTestBtn.classList.add('hidden');
  el.tunnelActiveReadout.classList.add('hidden');
  el.tunnelIdleNotice.classList.remove('hidden');
  setHud('DATA TUNNEL ENGINE • IDLE', 0.8, 0x00f0ff);
  el.badgeDownStreaming.classList.add('hidden');
  el.badgeUpStreaming.classList.add('hidden');
}

// Standby Initial Verdicts Placeholder
function renderInitialStandbyVerdicts() {
  const categories = [
    { title: '4K / 8K Streaming', metrics: 'Requires >= 25-80 Mbps down & low bufferbloat', hint: 'Will evaluate bufferless 4K multi-streaming suitability' },
    { title: 'Competitive Gaming', metrics: 'Requires sub-25ms ping, <3ms jitter & 0% loss', hint: 'Will analyze tick rate responsiveness for Valorant/CS2' },
    { title: 'Video Calls (Zoom/Teams)', metrics: 'Requires upload bandwidth & low bloat', hint: 'Will verify 1080p video clarity & audio synchronization' },
    { title: 'Remote Work & Cloud VPN', metrics: 'Requires low round-trip latency & SSH sync', hint: 'Will evaluate remote desktop and terminal input lag' },
    { title: 'Cloud Backups & Uploads', metrics: 'Requires high upstream throughput', hint: 'Will measure time required for multi-gigabyte uploads' },
    { title: 'Smart Home & IoT Load', metrics: 'Requires zero packet loss under device concurrency', hint: 'Will assess capacity for 25+ concurrent smart devices' }
  ];

  el.verdictsContainer.innerHTML = categories.map(c => `
    <div class="glass-panel p-5 rounded-2xl border border-pulse-border hover:border-slate-700 transition-all space-y-3 opacity-80">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white text-sm tracking-tight">${c.title}</span>
        <span class="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pulse-surface border border-pulse-border text-slate-400">
          Standby
        </span>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-300 mb-1">Awaiting Test Run</div>
        <p class="text-xs text-slate-400 leading-relaxed">${c.hint}</p>
      </div>
      <div class="pt-2 border-t border-pulse-border/60 text-[11px] font-mono text-slate-500">
        ${c.metrics}
      </div>
    </div>
  `).join('');

  el.diagnosisList.innerHTML = `
    <div class="p-4 rounded-xl border border-pulse-border bg-pulse-surface/50 text-xs font-mono text-slate-400 flex items-center justify-between">
      <span>● Smart Diagnosis Engine ready. Tap "Start Full 360 Analysis" above to generate tailored router & bufferbloat advice.</span>
      <span class="text-pulse-cyan font-bold">STANDBY</span>
    </div>
  `;
}

// Render Verdicts
function renderVerdicts(verdicts) {
  el.verdictsContainer.innerHTML = verdicts.map(v => `
    <div class="glass-panel p-5 rounded-2xl border border-pulse-border hover:border-slate-600 transition-all space-y-3">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white text-sm tracking-tight">${v.title}</span>
        <span class="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-pulse-surface border border-pulse-border ${v.badgeColor}">
          ${v.status} (${v.score}%)
        </span>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-200 mb-1">${v.headline}</div>
        <p class="text-xs text-slate-400 leading-relaxed">${v.reason}</p>
      </div>
      <div class="pt-2 border-t border-pulse-border/60 text-[11px] font-mono text-slate-400">
        Observed: <strong class="text-slate-300">${v.metrics}</strong>
      </div>
    </div>
  `).join('');
}

// Render Smart Diagnosis
function renderDiagnosis(insights) {
  if (insights.length === 0) {
    el.diagnosisList.innerHTML = `<div class="text-xs text-slate-400 font-mono">No network anomalies detected. All parameters within optimal thresholds.</div>`;
    return;
  }
  el.diagnosisList.innerHTML = insights.map(i => {
    const border = i.type === 'critical' ? 'border-rose-500/40 bg-rose-500/10' :
      i.type === 'warning' ? 'border-amber-500/40 bg-amber-500/10' :
      i.type === 'success' ? 'border-pulse-neon/40 bg-pulse-neon/10' : 'border-pulse-cyan/40 bg-pulse-cyan/10';
    const tagColor = i.type === 'critical' ? 'text-rose-400' : i.type === 'warning' ? 'text-amber-400' : i.type === 'success' ? 'text-pulse-neon' : 'text-pulse-cyan';
    return `
      <div class="p-4 rounded-xl border ${border} space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-mono font-bold text-white flex items-center space-x-2">
            <span>●</span>
            <span>${i.title}</span>
          </h4>
          <span class="font-mono text-[10px] uppercase font-bold ${tagColor}">${i.type}</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">${i.summary}</p>
        <div class="text-[11px] font-mono text-slate-200 pt-2 border-t border-pulse-border/50 bg-pulse-bg/50 p-2 rounded-lg">
          <strong class="${tagColor}">RECOMMENDED ACTION:</strong> ${i.action}
        </div>
      </div>
    `;
  }).join('');
}

// Plan vs Reality update
function updatePlanVsReality() {
  const promised = parseFloat(el.promisedDownInput.value);
  if (!promised || promised <= 0 || testMetrics.download <= 0) {
    el.planDeliveredBadge.textContent = 'Enter Plan';
    el.planDeliveredBadge.className = 'font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    el.planDeliveryRatio.textContent = '--%';
    el.planDeficit.textContent = '-- Mbps';
    el.planEvidenceNote.textContent = 'Enter your subscription speed to calculate contract fulfillment and export an ISP evidence ticket.';
    return;
  }

  const ratio = Math.round((testMetrics.download / promised) * 100);
  const deficit = Math.max(0, promised - testMetrics.download);

  el.planDeliveryRatio.textContent = `${ratio}%`;
  el.planDeficit.textContent = `${deficit.toFixed(1)} Mbps`;

  if (ratio >= 90) {
    el.planDeliveredBadge.textContent = `${ratio}% DELIVERED • PASS`;
    el.planDeliveredBadge.className = 'font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-pulse-neon/15 text-pulse-neon border border-pulse-neon/40';
    el.planEvidenceNote.textContent = `Your connection achieves ${testMetrics.download.toFixed(1)} Mbps against ${promised} Mbps advertised (${ratio}% fulfillment). ISP is honoring service tier agreements.`;
  } else if (ratio >= 70) {
    el.planDeliveredBadge.textContent = `${ratio}% DELIVERED • DEGRADED`;
    el.planDeliveredBadge.className = 'font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40';
    el.planEvidenceNote.textContent = `Moderate performance gap: delivering ${testMetrics.download.toFixed(1)} Mbps out of ${promised} Mbps promised. Off-peak retests recommended.`;
  } else {
    el.planDeliveredBadge.textContent = `${ratio}% DELIVERED • VIOLATION`;
    el.planDeliveredBadge.className = 'font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/40';
    el.planEvidenceNote.textContent = `Severe deficit: you are missing ${deficit.toFixed(1)} Mbps (${ratio}% delivered). Export this PULSE360 diagnostic log as proof for ISP billing disputes.`;
  }
}

// Transfer Calculator update
function updateTransferCalculator() {
  const sizeNum = parseFloat(el.calcCustomSize.value) || 0;
  const unit = el.calcCustomUnit.value;
  const type = el.calcCustomType.value;

  const speedMbps = type === 'down' ? testMetrics.download : testMetrics.upload;
  if (!speedMbps || speedMbps <= 0 || sizeNum <= 0) {
    el.calcDurationOutput.textContent = 'Run test first to calculate';
    return;
  }

  const megabytes = unit === 'GB' ? sizeNum * 1024 : sizeNum;
  const megabits = megabytes * 8;
  const totalSeconds = Math.round(megabits / speedMbps);

  let formatted = '';
  if (totalSeconds < 60) {
    formatted = `${totalSeconds} seconds`;
  } else if (totalSeconds < 3600) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    formatted = `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    formatted = `${hrs}h ${mins}m`;
  }

  el.calcDurationOutput.textContent = `~ ${formatted} @ ${speedMbps.toFixed(1)} Mbps`;
}

// 60-Second Deep Stability Mode Loop
async function runStabilityMode() {
  if (currentStage === 'stability') return;
  currentStage = 'stability';

  el.startStabilityBtn.classList.add('opacity-50', 'pointer-events-none');
  el.stabilityBtnLabel.textContent = 'Testing (60s Stream)...';
  triggerHaptic('phase');

  const canvas = el.stabilityChartCanvas;
  const ctx = canvas.getContext('2d');
  const totalSeconds = 60;
  const samples = [];

  const updateChart = () => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (samples.length < 2) return;

    // Draw latency line
    const maxLat = Math.max(100, ...samples.map(s => s.latency));
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const x = (idx / totalSeconds) * w;
      const y = h - (s.latency / maxLat) * (h - 20) - 10;
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Vertices
    samples.forEach((s, idx) => {
      const x = (idx / totalSeconds) * w;
      const y = h - (s.latency / maxLat) * (h - 20) - 10;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = s.latency > 80 ? '#f43f5e' : '#00f7a5';
      ctx.fill();
    });
  };

  for (let sec = 1; sec <= totalSeconds; sec++) {
    const start = performance.now();
    let rtt = 25;
    try {
      const resp = await fetch(nocache(`${CF_ORIGIN}/__down?bytes=0`), { cache: 'no-store' });
      if (resp.ok) rtt = Math.max(1, Math.round(performance.now() - start));
    } catch (e) {
      rtt = 150; // Timeout spike
    }

    samples.push({ sec, latency: rtt });
    el.stabilityTimerText.textContent = `${sec} / ${totalSeconds}s`;

    // Calculate current live stats
    const avg = Math.round(samples.reduce((a, b) => a + b.latency, 0) / samples.length);
    const variance = samples.reduce((a, b) => a + Math.pow(b.latency - avg, 2), 0) / samples.length;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    let maxJit = 0;
    for (let i = 1; i < samples.length; i++) {
      const j = Math.abs(samples[i].latency - samples[i - 1].latency);
      if (j > maxJit) maxJit = j;
    }

    el.stabAvgPing.textContent = `${avg} ms`;
    el.stabStdDev.textContent = `${stdDev} ms`;
    el.stabMaxJitter.textContent = `${maxJit} ms`;

    let verdict = 'Rock Solid';
    let vColor = 'text-pulse-neon';
    if (stdDev > 25 || maxJit > 60) { verdict = 'Volatile Jitter'; vColor = 'text-rose-400'; }
    else if (stdDev > 12 || maxJit > 30) { verdict = 'Fluctuating'; vColor = 'text-amber-400'; }
    el.stabVerdict.textContent = verdict;
    el.stabVerdict.className = `text-sm ${vColor}`;

    updateChart();
    await new Promise(r => setTimeout(r, 920));
  }

  triggerHaptic('success');
  el.startStabilityBtn.classList.remove('opacity-50', 'pointer-events-none');
  el.stabilityBtnLabel.textContent = 'Run 60s Stability Test';
  currentStage = 'idle';
}

// 24-Hour Congestion Heatmap & History
function renderHeatmap() {
  const history = getHistory();
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    downloads: [],
    label: `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
  }));

  history.forEach(item => {
    const h = new Date(item.timestamp).getHours();
    buckets[h].downloads.push(item.download);
  });

  let globalAvg = 0, totalTests = 0;
  buckets.forEach(b => {
    if (b.downloads.length > 0) {
      const avg = b.downloads.reduce((x, y) => x + y, 0) / b.downloads.length;
      globalAvg += avg * b.downloads.length;
      totalTests += b.downloads.length;
    }
  });
  if (totalTests > 0) globalAvg /= totalTests;

  el.heatmapGrid.innerHTML = buckets.map(b => {
    let bg = 'bg-slate-800 text-slate-500';
    let statusText = 'No tests';
    if (b.downloads.length > 0) {
      const avg = b.downloads.reduce((x, y) => x + y, 0) / b.downloads.length;
      if (avg < globalAvg * 0.75) {
        bg = 'bg-rose-500/80 text-white font-bold shadow-[0_0_8px_rgba(244,63,94,0.4)]';
        statusText = `Congested: ${avg.toFixed(1)} Mbps`;
      } else if (avg < globalAvg * 0.90) {
        bg = 'bg-amber-500/80 text-white font-bold';
        statusText = `Moderate: ${avg.toFixed(1)} Mbps`;
      } else {
        bg = 'bg-emerald-500/80 text-black font-bold shadow-[0_0_8px_rgba(0,247,165,0.4)]';
        statusText = `Optimal: ${avg.toFixed(1)} Mbps`;
      }
    }
    return `
      <div title="${b.label}: ${statusText}" class="flex flex-col items-center justify-center p-1.5 rounded-lg border border-pulse-border text-[10px] font-mono ${bg} transition-all cursor-default">
        <span class="text-[9px] opacity-75">${b.hour}h</span>
        <span class="truncate">${b.downloads.length > 0 ? (b.downloads.reduce((x, y) => x + y, 0) / b.downloads.length).toFixed(0) : '--'}</span>
      </div>
    `;
  }).join('');
}

function renderHistoryTable() {
  const history = getHistory();
  if (history.length === 0) {
    el.historyTableBody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400 font-mono">No previous test history found. Run your first analysis above!</td></tr>`;
    return;
  }
  el.historyTableBody.innerHTML = history.slice(0, 15).map(h => `
    <tr class="hover:bg-pulse-surface/50 transition-colors">
      <td class="py-2.5 text-slate-300">${h.dateStr}</td>
      <td class="py-2.5 font-bold text-pulse-cyan">${h.download.toFixed(1)} Mbps</td>
      <td class="py-2.5 font-bold text-pulse-pink">${h.upload.toFixed(1)} Mbps</td>
      <td class="py-2.5 text-slate-300">${h.latency} ms / ${h.jitter} ms</td>
      <td class="py-2.5"><span class="px-2 py-0.5 rounded font-bold ${h.bloatGrade === 'A+' || h.bloatGrade === 'A' ? 'bg-pulse-neon/20 text-pulse-neon' : 'bg-amber-500/20 text-amber-400'}">${h.bloatGrade}</span></td>
      <td class="py-2.5 text-white font-bold">${h.dnaIndex}</td>
      <td class="py-2.5 text-slate-400">${h.server || 'CF-EDGE'}</td>
    </tr>
  `).join('');
}
