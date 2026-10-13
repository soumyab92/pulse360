export type TestStage = 
  | 'idle' 
  | 'telemetry' 
  | 'dns' 
  | 'latency' 
  | 'download' 
  | 'loaded-latency-down'
  | 'upload' 
  | 'loaded-latency-up' 
  | 'completed' 
  | 'stability';

export interface TelemetryData {
  ip: string;
  isp: string;
  asn: string;
  colo: string;
  country: string;
  city: string;
  loc: string;
  httpVersion: string;
  tlsVersion: string;
  serverName: string;
}

export interface BrowserNetworkInfo {
  supported: boolean;
  effectiveType?: string; // '4g', '3g', '2g', 'slow-2g'
  rtt?: number; // ms
  downlink?: number; // Mb/s
  saveData?: boolean;
}

export interface DnsBenchmark {
  provider: string;
  ip: string;
  timeMs: number | null;
  status: 'pending' | 'success' | 'failed' | 'unsupported';
  isFastest?: boolean;
}

export interface LatencyStats {
  idleLatency: number; // ms
  jitter: number; // ms
  minLatency: number;
  maxLatency: number;
  packetLoss: number; // %
  samples: number[];
}

export interface BufferbloatStats {
  idleLatency: number;
  loadedLatencyDown: number;
  loadedLatencyUp: number;
  deltaDown: number;
  deltaUp: number;
  worstDelta: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  description: string;
}

export interface ThroughputStats {
  current: number; // Mbps
  peak: number; // Mbps
  average: number; // Mbps
  bytesTransferred: number;
  samples: number[];
}

export interface RealLifeVerdict {
  category: '4k_streaming' | 'competitive_gaming' | 'video_calls' | 'remote_work' | 'cloud_backups' | 'smart_home';
  title: string;
  iconName: string;
  status: 'Legendary' | 'Excellent' | 'Good' | 'Fair' | 'Poor';
  statusColor: string; // Tailwind color class or hex
  score: number; // 0 - 100
  headline: string;
  reason: string;
  metricsObserved: string;
}

export interface NetworkDnaScores {
  speed: number;        // 0-100
  stability: number;    // 0-100
  latency: number;      // 0-100
  upload: number;       // 0-100
  bufferbloat: number;  // 0-100
  dns: number;          // 0-100
  compositeScore: number;
}

export interface TestResult {
  id: string;
  timestamp: number;
  dateStr: string;
  hour: number;
  download: number; // Mbps
  upload: number;   // Mbps
  latency: number;  // ms
  jitter: number;   // ms
  packetLoss: number; // %
  bufferbloatGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  bufferbloatDelta: number; // ms
  telemetry: TelemetryData | null;
  dnsBenchmarks: DnsBenchmark[];
  dnaScores: NetworkDnaScores;
  promisedDownload?: number;
  promisedUpload?: number;
}

export interface StabilitySample {
  timeOffset: number; // seconds (0 to 60)
  latency: number;    // ms
  jitter: number;     // ms
  throughput: number; // Mbps
  dropped: boolean;
}

export interface StabilitySummary {
  samples: StabilitySample[];
  duration: number; // seconds
  avgLatency: number;
  latencyStdDev: number;
  maxJitter: number;
  avgThroughput: number;
  throughputVariance: number;
  packetLossCount: number;
  stabilityScore: number; // 0-100
  grade: 'Rock Solid' | 'Good' | 'Fluctuating' | 'Volatile';
}

