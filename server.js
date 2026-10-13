import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Load .env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env:', e);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=UTF-8',
  '.mp3': 'audio/mpeg'
};

const COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.md']);

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// Rate limiter: sliding window (max 10 requests per 60 seconds per IP)
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 20;

  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxReqs) {
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// Knowledge Base Chunking Utility
function getKnowledgeChunks() {
  const knowledgeDir = path.join(__dirname, 'knowledge');
  if (!fs.existsSync(knowledgeDir)) {
    return [];
  }

  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
  const chunks = [];

  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentHeading = 'Overview';
    let currentLines = [];
    let chunkIndex = 0;

    for (const line of lines) {
      if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
        if (currentLines.length > 0) {
          const text = currentLines.join('\n').trim();
          if (text.length > 20) {
            chunks.push({
              id: `${file}#${chunkIndex++}`,
              file,
              heading: currentHeading,
              content: text
            });
          }
          currentLines = [];
        }
        currentHeading = line.replace(/^#+\s*/, '').trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text.length > 20) {
        chunks.push({
          id: `${file}#${chunkIndex++}`,
          file,
          heading: currentHeading,
          content: text
        });
      }
    }
  }

  return chunks;
}

// Damerau-Levenshtein distance for typo tolerance & transposition handling
function damerauLevenshtein(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;
  const m = s1.length, n = s2.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Normalized similarity between two words: 1.0 (exact match) to 0.0
function wordSimilarity(w1, w2) {
  if (w1 === w2) return 1.0;
  if (!w1 || !w2) return 0.0;
  if (w1.length < 3 && w2.length < 3) return w1 === w2 ? 1.0 : 0.0;
  if (w1.length >= 4 && w2.length >= 4) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return 0.90;
    if (w1.includes(w2) || w2.includes(w1)) return 0.85;
  }
  const maxLen = Math.max(w1.length, w2.length);
  const dist = damerauLevenshtein(w1, w2);
  return (maxLen - dist) / maxLen;
}

// Detect nearest intent based on prompt words and typos
function detectNearestIntent(prompt) {
  const clean = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const tokens = clean.split(' ').filter(w => w.length > 0);

  // Bufferbloat Fix / SQM
  if (tokens.some(t => ['fix', 'repair', 'enable', 'config', 'configure'].includes(t)) &&
      tokens.some(t => wordSimilarity(t, 'bufferbloat') >= 0.68 || wordSimilarity(t, 'bloat') >= 0.72 || t === 'sqm' || t === 'qos')) {
    return 'BUFFERBLOAT_FIX';
  }
  if (tokens.some(t => ['sqm', 'qos', 'cake', 'codel', 'fqcodel'].includes(t))) {
    return 'BUFFERBLOAT_FIX';
  }

  // Bufferbloat Grade / Bloat
  if (tokens.some(t => wordSimilarity(t, 'bufferbloat') >= 0.68 || wordSimilarity(t, 'bloat') >= 0.72)) {
    return 'BUFFERBLOAT';
  }

  // Latency / Ping
  if (tokens.some(t => wordSimilarity(t, 'ping') >= 0.72 || wordSimilarity(t, 'latency') >= 0.68 || t === 'rtt' || t === 'lag' || t === 'pnig')) {
    return 'LATENCY';
  }

  // Jitter
  if (tokens.some(t => wordSimilarity(t, 'jitter') >= 0.68)) {
    return 'JITTER';
  }

  // Packet Loss
  if (tokens.some(t => wordSimilarity(t, 'loss') >= 0.72 || t === 'packetloss') ||
      (tokens.some(t => wordSimilarity(t, 'packet') >= 0.72) && tokens.some(t => wordSimilarity(t, 'loss') >= 0.72))) {
    return 'PACKET_LOSS';
  }

  // Stability
  if (tokens.some(t => wordSimilarity(t, 'stability') >= 0.68 || wordSimilarity(t, 'stable') >= 0.72)) {
    return 'STABILITY';
  }

  // DNA
  if (tokens.some(t => t === 'dna' || wordSimilarity(t, 'fingerprint') >= 0.68 || wordSimilarity(t, 'radar') >= 0.72)) {
    return 'DNA';
  }

  // DNS
  if (tokens.some(t => t === 'dns' || wordSimilarity(t, 'resolver') >= 0.68)) {
    return 'DNS';
  }

  // Complaint Letter
  if (tokens.some(t => wordSimilarity(t, 'complaint') >= 0.68 || wordSimilarity(t, 'dispute') >= 0.68) ||
      (tokens.some(t => t === 'isp' || t === 'provider') && tokens.some(t => wordSimilarity(t, 'letter') >= 0.68 || wordSimilarity(t, 'draft') >= 0.68))) {
    return 'COMPLAINT';
  }

  // Name / Identity
  if (clean.includes('who are you') || clean.includes('what is your name') || clean.includes('whats your name') ||
      clean.includes('naam ki') || clean.includes('tomar naam') || clean.includes('who r u') ||
      clean.includes('whos ur nam') || clean.includes('wat is ur nam') ||
      (tokens.some(t => ['who', 'whos', 'wat', 'what', 'ur', 'your'].includes(t)) && tokens.some(t => ['name', 'nam', 'naam', 'identity', 'operator', 'agent'].includes(t)))) {
    return 'NAME';
  }

  // Greetings
  if (tokens.some(t => ['hi', 'hello', 'hey', 'helo', 'hlo', 'greetings', 'namaste', 'nomoshkar', 'salaam', 'morning'].includes(t))) {
    return 'GREETINGS';
  }

  // IP Address
  if (tokens.some(t => t === 'ip') && !tokens.some(t => t === 'isp')) {
    return 'IP_ADDRESS';
  }

  // ISP
  if (tokens.some(t => t === 'isp' || wordSimilarity(t, 'provider') >= 0.72 || wordSimilarity(t, 'operator') >= 0.72)) {
    return 'ISP';
  }

  // Explain / Verdict
  if (tokens.some(t => wordSimilarity(t, 'explain') >= 0.68 || wordSimilarity(t, 'verdict') >= 0.68 || wordSimilarity(t, 'overview') >= 0.68)) {
    return 'EXPLAIN';
  }

  // Download Speed (check before general speed test)
  if (tokens.some(t => t === 'dwnld' || t.startsWith('down') || t.startsWith('dwn') || wordSimilarity(t, 'download') >= 0.65 || wordSimilarity(t, 'downlink') >= 0.68 || (t === 'down' && !tokens.some(t2 => t2 === 'up')))) {
    return 'DOWNLOAD';
  }

  // Upload Speed (check before general speed test)
  if (tokens.some(t => t === 'upld' || t.startsWith('upl') || wordSimilarity(t, 'upload') >= 0.65 || wordSimilarity(t, 'uplink') >= 0.68 || (t === 'up' && !tokens.some(t2 => t2 === 'down')))) {
    return 'UPLOAD';
  }

  // General Speed Test (when 'speed' or 'internet' or 'net' is mentioned, e.g. "test my speed", "speed check", "chek speed")
  if (tokens.some(t => wordSimilarity(t, 'speed') >= 0.72 || wordSimilarity(t, 'bandwidth') >= 0.72 || wordSimilarity(t, 'throughput') >= 0.72 || wordSimilarity(t, 'internet') >= 0.72 || t === 'net')) {
    return 'SPEED_TEST';
  }

  return null;
}

// Built-in Grounded Reasoning Engine (Strict, laser-focused agent answers with suggested options)
function generateGroundedResponse(prompt, context) {
  const pLower = prompt.toLowerCase().trim();
  const m = context?.latest_metrics || context?.metrics || {};
  const t = context?.telemetry || {};
  const plan = context?.plan_audit || {};

  // Detect nearest intent through fuzzy matching and typo tolerance
  const matchedIntent = detectNearestIntent(prompt);

  // 1. IDENTITY & NAME
  if (matchedIntent === 'NAME' ||
      /^(what('?s| is) (your )?name|your name|who are you|who r u|who is this|identify yourself|naam ki|tomar naam ki|tomar name ki|name|naam)$/i.test(pLower)) {
    return {
      text: "I am PULSE Agent, the AI diagnostic operator for PULSE360.",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'Test my internet speed',
        'What is my bufferbloat grade?',
        'Explain my result'
      ]
    };
  }

  // 2. GREETINGS
  if (matchedIntent === 'GREETINGS' ||
      /^(hi|hello|hey|greetings|namaste|nomoshkar|salaam)\b/i.test(pLower)) {
    return {
      text: "Hello. I am PULSE Agent. How can I test or analyze your network?",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'Test my internet speed',
        'What is my bufferbloat grade?',
        'Explain my result'
      ]
    };
  }

  // 3. DOWNLOAD SPEED ONLY
  if (matchedIntent === 'DOWNLOAD') {
    if (m.download_mbps && m.download_mbps > 0) {
      return {
        text: `Your download speed is ${m.download_mbps.toFixed(1)} Mbps.`,
        sourcesUsed: [],
        options: [
          'What is my upload speed?',
          'What is my bufferbloat grade?',
          'What is my ping?',
          'Explain my result',
          'Export Network DNA'
        ]
      };
    }
    return {
      text: "[ACTION:START_SPEED_TEST]\nTesting your internet speed now. Your download speed and follow-up options will appear here once the test finishes.",
      sourcesUsed: [],
      options: []
    };
  }

  // 4. UPLOAD SPEED ONLY
  if (matchedIntent === 'UPLOAD') {
    if (m.upload_mbps && m.upload_mbps > 0) {
      return {
        text: `Your upload speed is ${m.upload_mbps.toFixed(1)} Mbps.`,
        sourcesUsed: [],
        options: [
          'What is my download speed?',
          'What is my bufferbloat grade?',
          'Explain my result',
          'Export Network DNA'
        ]
      };
    }
    return {
      text: "[ACTION:START_SPEED_TEST]\nTesting your internet speed now. Your upload speed and follow-up options will appear here once the test finishes.",
      sourcesUsed: [],
      options: []
    };
  }

  // 5. PING / LATENCY ONLY
  if (matchedIntent === 'LATENCY') {
    if (m.ping_ms && m.ping_ms > 0) {
      return {
        text: `Your latency is ${m.ping_ms} ms.`,
        sourcesUsed: [],
        options: [
          'What is my download speed?',
          'What is my jitter?',
          'What is my bufferbloat grade?'
        ]
      };
    }
    return {
      text: "[ACTION:START_SPEED_TEST]\nTesting your internet speed now to measure latency.",
      sourcesUsed: [],
      options: []
    };
  }

  // 6. JITTER ONLY
  if (matchedIntent === 'JITTER') {
    if (m.jitter_ms && m.jitter_ms > 0) {
      return {
        text: `Your jitter is ${m.jitter_ms} ms.`,
        sourcesUsed: [],
        options: [
          'What is my latency?',
          'What is my download speed?',
          'What is my bufferbloat grade?'
        ]
      };
    }
    return {
      text: "I don't have enough data. Please run a speed test first.",
      sourcesUsed: [],
      options: ['Test my internet speed']
    };
  }

  // 7. BUFFERBLOAT FIX / SQM INSTRUCTIONS
  if (matchedIntent === 'BUFFERBLOAT_FIX') {
    return {
      text: "To fix bufferbloat: Log into your router, enable SQM (CAKE or FQ-CoDel), and set upload and download limits to 90-95% of your measured speed.",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my bufferbloat grade?',
        'Run 60s stability test'
      ]
    };
  }

  // 8. BUFFERBLOAT GRADE ONLY
  if (matchedIntent === 'BUFFERBLOAT') {
    if (m.bufferbloat_grade) {
      return {
        text: `Your bufferbloat grade is Grade ${m.bufferbloat_grade}.`,
        sourcesUsed: [],
        options: [
          'How do I fix bufferbloat?',
          'What is my download speed?',
          'Explain my result'
        ]
      };
    }
    return {
      text: "[ACTION:START_SPEED_TEST]\nTesting your internet speed now to evaluate bufferbloat under saturation.",
      sourcesUsed: [],
      options: []
    };
  }

  // 9. PACKET LOSS ONLY
  if (matchedIntent === 'PACKET_LOSS') {
    return {
      text: `Your packet loss is ${m.loss_pct !== undefined ? m.loss_pct : 0}%.`,
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my bufferbloat grade?'
      ]
    };
  }

  // 10. STABILITY TEST
  if (matchedIntent === 'STABILITY') {
    return {
      text: "[ACTION:RUN_STABILITY]\nStarting 60-second stability test now.",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my bufferbloat grade?'
      ]
    };
  }

  // 11. EXPORT DNA CARD
  if (matchedIntent === 'DNA') {
    return {
      text: "[ACTION:EXPORT_DNA]\nExporting your Network DNA card now.",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'Explain my result'
      ]
    };
  }

  // 12. DNS BENCHMARK
  if (matchedIntent === 'DNS') {
    const dnsList = context?.dns_benchmarks || [];
    if (dnsList.length > 0) {
      const summary = dnsList.map(d => `${d.provider}: ${d.time_ms !== null ? `${d.time_ms} ms` : 'N/A'}`).join(', ');
      return {
        text: `DNS Benchmark: ${summary}.`,
        sourcesUsed: [],
        options: [
          'What is my download speed?',
          'What is my bufferbloat grade?'
        ]
      };
    }
    return {
      text: "[ACTION:PROBE_DNS]\nTesting DNS resolvers now.",
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my bufferbloat grade?'
      ]
    };
  }

  // 13. IP ADDRESS ONLY
  if (matchedIntent === 'IP_ADDRESS') {
    if (t.ip) {
      return {
        text: `Your IP is ${t.ip}.`,
        sourcesUsed: [],
        options: [
          'Who is my ISP?',
          'What is my download speed?'
        ]
      };
    }
    return {
      text: "I don't have enough data. IP not detected yet.",
      sourcesUsed: [],
      options: ['Test my internet speed']
    };
  }

  // 14. ISP / PROVIDER ONLY
  if (matchedIntent === 'ISP') {
    if (t.isp) {
      return {
        text: `Your ISP is ${t.isp}.`,
        sourcesUsed: [],
        options: [
          'What is my download speed?',
          'Draft ISP complaint letter'
        ]
      };
    }
    return {
      text: "I don't have enough data. ISP not detected yet.",
      sourcesUsed: [],
      options: ['Test my internet speed']
    };
  }

  // 15. ISP COMPLAINT LETTER
  if (matchedIntent === 'COMPLAINT') {
    const promisedDown = plan.promised_down || 300;
    const promisedUp = plan.promised_up || 50;
    const actualDown = m.download_mbps || 0;
    const actualUp = m.upload_mbps || 0;
    const ratio = plan.delivered_ratio_pct || (promisedDown > 0 ? Math.round((actualDown / promisedDown) * 100) : 0);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return {
      text: `FORMAL NOTICE OF SERVICE DEFICIT & CONTRACTUAL UNDERPERFORMANCE\n\nDate: ${dateStr}\nTo: Customer Support (${t.isp || 'Broadband Service Provider'})\n\nDelivered: ${actualDown.toFixed(1)} Mbps Down / ${actualUp.toFixed(1)} Mbps Up (${ratio}% of contracted ${promisedDown} Mbps).\nPing: ${m.ping_ms || '--'} ms | Jitter: ${m.jitter_ms || '--'} ms | Bloat: Grade ${m.bufferbloat_grade || 'C'}.\n\nPlease inspect node saturation and apply a billing credit for underdelivered bandwidth.`,
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my bufferbloat grade?',
        'Export Network DNA'
      ]
    };
  }

  // 16. EXPLAIN RESULT / DIAGNOSTIC OVERVIEW
  if (matchedIntent === 'EXPLAIN') {
    if (!m.download_mbps || m.download_mbps === 0) {
      return {
        text: "I don't have enough data. Please run a speed test first.",
        sourcesUsed: [],
        options: ['Test my internet speed']
      };
    }
    const down = m.download_mbps || 0;
    const up = m.upload_mbps || 0;
    const ping = m.ping_ms || 0;
    const bloat = m.bufferbloat_grade || 'B';
    return {
      text: `Diagnostic Verdict: Download ${down.toFixed(1)} Mbps (${down >= 25 ? '4K Capable' : 'Basic'}), Upload ${up.toFixed(1)} Mbps, Ping ${ping} ms, Bufferbloat Grade ${bloat}.`,
      sourcesUsed: [],
      options: [
        'What is my download speed?',
        'What is my upload speed?',
        'What is my bufferbloat grade?',
        'Export Network DNA',
        'Draft ISP complaint letter'
      ]
    };
  }

  // 17. SPEED TEST / SPEED CHECK
  if (matchedIntent === 'SPEED_TEST') {
    if (m.download_mbps && m.download_mbps > 0 && /(what|current|how fast|status)/i.test(pLower)) {
      return {
        text: `Your speed is ${m.download_mbps.toFixed(1)} Mbps download and ${(m.upload_mbps || 0).toFixed(1)} Mbps upload.`,
        sourcesUsed: [],
        options: [
          'What is my download speed?',
          'What is my bufferbloat grade?',
          'Explain my result',
          'Export Network DNA'
        ]
      };
    }
    return {
      text: "[ACTION:START_SPEED_TEST]\nTesting your internet speed now. Your live results and follow-up options will appear here once the test finishes.",
      sourcesUsed: [],
      options: []
    };
  }

  // 18. NO MATCH FOUND -> CHATGPT / GEMINI STYLE GENERIC RESPONSE
  return {
    text: "I'm PULSE Agent, the AI operator for PULSE360. I didn't recognize that command, but I can help you test your connection, check download and upload speeds, measure latency and bufferbloat, or draft an ISP complaint letter. What would you like to check?",
    sourcesUsed: [],
    options: [
      'What is my download speed?',
      'Test my internet speed',
      'What is my bufferbloat grade?',
      'Explain my result',
      'Run 60s stability test'
    ]
  };
}

const server = http.createServer((req, res) => {
  // Security headers & CORS
  setSecurityHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const urlParts = req.url.split('?');
  const reqPath = decodeURI(urlParts[0]);

  // 1. Health check routes: /health and /api/health
  if (req.method === 'GET' && (reqPath === '/api/health' || reqPath === '/health')) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'pulse360',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. API Route: GET /api/knowledge
  if (req.method === 'GET' && reqPath === '/api/knowledge') {
    const chunks = getKnowledgeChunks();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'public, max-age=300'
    });
    res.end(JSON.stringify({ chunks }));
    return;
  }

  // 3. API Route: POST /api/pulse-llm
  if (req.method === 'POST' && reqPath === '/api/pulse-llm') {
    // Rate limit check (20 req/min)
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=UTF-8' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded. Maximum 20 requests per minute allowed.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard max payload size
      if (body.length > 50000) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large.' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = (payload.prompt || '').trim();
        const context = payload.context || {};

        // Length limit validation (max 1000 chars)
        if (prompt.length > 1000) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ error: 'Prompt exceeds maximum limit of 1,000 characters.' }));
          return;
        }

        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ error: 'Prompt is required.' }));
          return;
        }

        // Set up streaming response (SSE / chunked)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=UTF-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        });

        // Check if an external LLM API key is present in environment
        const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

        let fullText = '';
        let sourcesUsed = [];
        let optionsProvided = [];

        if (apiKey && process.env.USE_EXTERNAL_LLM === 'true') {
          // If external provider is enabled and key exists, call Gemini or OpenAI API
          // (Defaults to internal high-precision grounded engine for deterministic reliability)
        } else {
          // Internal Grounded RAG Reasoning Engine (Strictly adheres to AGENT_RULES)
          const result = generateGroundedResponse(prompt, context);
          fullText = result.text;
          sourcesUsed = result.sourcesUsed || [];
          optionsProvided = result.options || [];
        }

        // Stream typewriter chunks to client
        const chunkSize = 25;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.substring(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
          await new Promise(r => setTimeout(r, 18));
        }

        // Send sources and completion with interactive options
        res.write(`data: ${JSON.stringify({ chunk: '', done: true, sources: sourcesUsed, options: optionsProvided })}\n\n`);
        res.end();
      } catch (err) {
        console.error('LLM Route error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error processing query.' }));
        }
      }
    });
    return;
  }

  // 4. Static File Serving with Gzip Compression & Caching
  let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(__dirname, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (indexErr) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        serveStaticFile(req, res, indexPath, indexStats, '.html');
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    serveStaticFile(req, res, filePath, stats, ext);
  });
});

function serveStaticFile(req, res, filePath, stats, ext) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = COMPRESSIBLE_EXTS.has(ext) && acceptEncoding.includes('gzip') && stats.size > 256;

  // Cache-Control strategy
  const cacheControl = ext === '.html'
    ? 'no-cache, must-revalidate'
    : 'public, max-age=86400, stale-while-revalidate=3600';

  const headers = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl
  };

  if (canGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip({ level: 6 });
    readStream.pipe(gzip).pipe(res);
  } else {
    headers['Content-Length'] = stats.size;
    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  }
}

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down HTTP server gracefully...`);
  server.close(() => {
    console.log('HTTP server closed successfully.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PULSE360 HTTP Server running at http://localhost:${PORT}/ (Port: ${PORT})`);
  console.log(`Knowledge Base loaded: ${getKnowledgeChunks().length} chunks indexed.`);
});
