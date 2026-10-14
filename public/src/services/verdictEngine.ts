import { RealLifeVerdict, BufferbloatStats } from '../types';

export function calculateVerdicts(
  downloadMbps: number,
  uploadMbps: number,
  idleLatency: number,
  jitter: number,
  packetLoss: number,
  bufferbloat: BufferbloatStats
): RealLifeVerdict[] {
  const verdicts: RealLifeVerdict[] = [];

  // 1. 4K / 8K Streaming
  let streamingStatus: RealLifeVerdict['status'] = 'Poor';
  let streamingScore = 30;
  let streamingHeadline = 'Limited to SD/720p';
  let streamingReason = 'Low download speed will result in recurring buffering loops on high-definition video.';

  if (downloadMbps >= 100 && bufferbloat.grade <= 'B') {
    streamingStatus = 'Legendary';
    streamingScore = 98;
    streamingHeadline = 'Pristine 4K & 8K HDR Multi-Stream';
    streamingReason = 'Flawless zero-buffering playback for multiple simultaneous 4K streams with Dolby Vision.';
  } else if (downloadMbps >= 40) {
    streamingStatus = 'Excellent';
    streamingScore = 90;
    streamingHeadline = 'Smooth 4K UHD Streaming';
    streamingReason = 'Reliable high-bitrate 4K playback on Netflix, YouTube, and Apple TV without stutters.';
  } else if (downloadMbps >= 18) {
    streamingStatus = 'Good';
    streamingScore = 75;
    streamingHeadline = 'Consistent 1080p Full HD';
    streamingReason = 'Fast enough for crisp 1080p60 streaming, but 4K bitrates may occasionally drop.';
  } else if (downloadMbps >= 8) {
    streamingStatus = 'Fair';
    streamingScore = 55;
    streamingHeadline = 'Acceptable 720p HD';
    streamingReason = 'Streams reliably at 720p; concurrent users downloading will cause resolution downgrades.';
  }

  verdicts.push({
    category: '4k_streaming',
    title: '4K / 8K Media Streaming',
    iconName: 'Tv',
    status: streamingStatus,
    statusColor: streamingStatus === 'Legendary' ? 'text-pulse-cyan' : streamingStatus === 'Excellent' ? 'text-pulse-neon' : streamingStatus === 'Good' ? 'text-blue-400' : 'text-amber-400',
    score: streamingScore,
    headline: streamingHeadline,
    reason: streamingReason,
    metricsObserved: `${downloadMbps} Mbps down • ${idleLatency}ms base ping`
  });

  // 2. Competitive Gaming
  let gamingStatus: RealLifeVerdict['status'] = 'Poor';
  let gamingScore = 25;
  let gamingHeadline = 'Severe Latency Disadvantage';
  let gamingReason = 'High base latency or packet drops will result in noticeable hit-registration lag and rubberbanding.';

  if (idleLatency <= 18 && jitter <= 2.5 && packetLoss === 0 && (bufferbloat.grade === 'A+' || bufferbloat.grade === 'A')) {
    gamingStatus = 'Legendary';
    gamingScore = 99;
    gamingHeadline = 'Esports-Tier Low Latency';
    gamingReason = 'Sub-20ms ultra-crisp tick rate response with zero packet jitter. Optimal for CS2, Valorant & Apex.';
  } else if (idleLatency <= 35 && jitter <= 5 && packetLoss === 0 && bufferbloat.grade <= 'B') {
    gamingStatus = 'Excellent';
    gamingScore = 88;
    gamingHeadline = 'Smooth Competitive Gaming';
    gamingReason = 'Fast response with consistent hit-reg; low jitter ensures stable peekers advantage.';
  } else if (idleLatency <= 60 && jitter <= 10 && packetLoss <= 1) {
    gamingStatus = 'Good';
    gamingScore = 70;
    gamingHeadline = 'Playable Casual Multiplayer';
    gamingReason = 'Solid for casual multiplayer; slight loaded ping spikes during concurrent home downloads.';
  } else if (idleLatency <= 100) {
    gamingStatus = 'Fair';
    gamingScore = 50;
    gamingHeadline = 'Borderline High Ping';
    gamingReason = 'Noticeable ~80ms+ delay; disadvantage in rapid reflex gunfights.';
  }

  verdicts.push({
    category: 'competitive_gaming',
    title: 'Competitive Gaming',
    iconName: 'Gamepad2',
    status: gamingStatus,
    statusColor: gamingStatus === 'Legendary' ? 'text-pulse-cyan' : gamingStatus === 'Excellent' ? 'text-pulse-neon' : gamingStatus === 'Good' ? 'text-blue-400' : 'text-rose-400',
    score: gamingScore,
    headline: gamingHeadline,
    reason: gamingReason,
    metricsObserved: `${idleLatency}ms ping • ${jitter}ms jitter • ${packetLoss}% loss • Bloat: ${bufferbloat.grade}`
  });

  // 3. Video Calls & Conferencing
  let callStatus: RealLifeVerdict['status'] = 'Poor';
  let callScore = 30;
  let callHeadline = 'Degraded Video & Audio Glitches';
  let callReason = 'Insufficient upload bandwidth or high buffer bloat will cause robotic audio and frozen video frames.';

  if (uploadMbps >= 12 && downloadMbps >= 25 && jitter <= 4 && bufferbloat.grade <= 'B') {
    callStatus = 'Legendary';
    callScore = 96;
    callHeadline = 'Studio HD Multi-Person Calls';
    callReason = 'Crystal-clear 1080p video with near-zero audio desync across Zoom, Teams, and Google Meet.';
  } else if (uploadMbps >= 5 && downloadMbps >= 12 && jitter <= 8 && bufferbloat.grade <= 'C') {
    callStatus = 'Excellent';
    callScore = 86;
    callHeadline = 'Crisp HD Video Conferencing';
    callReason = 'Smooth 720p/1080p calls with reliable screen-sharing even with multiple attendees.';
  } else if (uploadMbps >= 2.5 && downloadMbps >= 6) {
    callStatus = 'Good';
    callScore = 68;
    callHeadline = 'Decent Standard Video Calls';
    callReason = 'Adequate for 1-on-1 video; group calls may temporarily drop quality during heavy network use.';
  } else {
    callStatus = 'Fair';
    callScore = 48;
    callHeadline = 'Audio-Only Recommended';
    callReason = 'Upload constraints may cause screen sharing to hitch or voice packets to stutter.';
  }

  verdicts.push({
    category: 'video_calls',
    title: 'Video Conferencing (Zoom/Teams)',
    iconName: 'Video',
    status: callStatus,
    statusColor: callStatus === 'Legendary' ? 'text-pulse-cyan' : callStatus === 'Excellent' ? 'text-pulse-neon' : callStatus === 'Good' ? 'text-blue-400' : 'text-amber-400',
    score: callScore,
    headline: callHeadline,
    reason: callReason,
    metricsObserved: `${uploadMbps} Mbps up • ${jitter}ms jitter • Bloat: ${bufferbloat.grade}`
  });

  // 4. Remote Work & Cloud VPN
  let workStatus: RealLifeVerdict['status'] = 'Poor';
  let workScore = 35;
  let workHeadline = 'Sluggish Remote Sessions';
  let workReason = 'High round-trip latency creates noticeable keystroke lag inside SSH, Citrix, or Remote Desktop.';

  if (idleLatency <= 30 && downloadMbps >= 50 && uploadMbps >= 15 && packetLoss === 0) {
    workStatus = 'Legendary';
    workScore = 95;
    workHeadline = 'Zero-Lag Virtual Workspace';
    workReason = 'Feels like a local desktop: instant SSH keystrokes, buttery smooth RDP/Citrix, fast Git pushes.';
  } else if (idleLatency <= 50 && downloadMbps >= 25 && uploadMbps >= 8) {
    workStatus = 'Excellent';
    workScore = 85;
    workHeadline = 'Responsive Cloud Workflows';
    workReason = 'Stable VPN tunnel with quick file syncs and negligible Remote Desktop latency.';
  } else if (idleLatency <= 80 && downloadMbps >= 12 && uploadMbps >= 4) {
    workStatus = 'Good';
    workScore = 68;
    workHeadline = 'Workable Remote Desktop';
    workReason = 'Suitable for standard web productivity, Google Docs, and basic remote server management.';
  } else {
    workStatus = 'Fair';
    workScore = 50;
    workHeadline = 'Occasional VPN Dropouts';
    workReason = 'Elevated latency may introduce slight cursor drag and sluggish terminal response.';
  }

  verdicts.push({
    category: 'remote_work',
    title: 'Remote Work & VPN Productivity',
    iconName: 'Laptop',
    status: workStatus,
    statusColor: workStatus === 'Legendary' ? 'text-pulse-cyan' : workStatus === 'Excellent' ? 'text-pulse-neon' : workStatus === 'Good' ? 'text-blue-400' : 'text-amber-400',
    score: workScore,
    headline: workHeadline,
    reason: workReason,
    metricsObserved: `${idleLatency}ms RTT • ${downloadMbps} down / ${uploadMbps} up`
  });

  // 5. Cloud Backups & Large File Sync
  let backupStatus: RealLifeVerdict['status'] = 'Poor';
  let backupScore = 20;
  let backupHeadline = 'Painfully Slow Cloud Sync';
  let backupReason = 'Asymmetric low upload will bottleneck video archives, Google Drive syncs, and large Git repositories.';

  if (uploadMbps >= 80) {
    backupStatus = 'Legendary';
    backupScore = 98;
    backupHeadline = 'Fiber-Speed Cloud Ingestion';
    backupReason = '10GB file uploads finish in ~1.5 minutes. Effortless 4K footage and raw camera backup transfers.';
  } else if (uploadMbps >= 30) {
    backupStatus = 'Excellent';
    backupScore = 88;
    backupHeadline = 'Rapid Cloud Synchronization';
    backupReason = 'Seamless automated backups for OneDrive, Google Drive, iCloud, and multi-gigabyte files.';
  } else if (uploadMbps >= 10) {
    backupStatus = 'Good';
    backupScore = 68;
    backupHeadline = 'Moderate Backup Throughput';
    backupReason = 'Daily document and mobile photo backups sync cleanly; large videos will take a while.';
  } else if (uploadMbps >= 3) {
    backupStatus = 'Fair';
    backupScore = 48;
    backupHeadline = 'Slow Upload Pipeline';
    backupReason = 'Adequate for light docs; 5GB video uploads will require over 3 hours.';
  }

  verdicts.push({
    category: 'cloud_backups',
    title: 'Cloud Backups & Large Uploads',
    iconName: 'CloudUpload',
    status: backupStatus,
    statusColor: backupStatus === 'Legendary' ? 'text-pulse-cyan' : backupStatus === 'Excellent' ? 'text-pulse-neon' : backupStatus === 'Good' ? 'text-blue-400' : 'text-rose-400',
    score: backupScore,
    headline: backupHeadline,
    reason: backupReason,
    metricsObserved: `${uploadMbps} Mbps upload speed`
  });

  // 6. Smart Home Concurrent IoT Load
  let iotStatus: RealLifeVerdict['status'] = 'Poor';
  let iotScore = 30;
  let iotHeadline = 'Vulnerable to Device Contention';
  let iotReason = 'Network capacity will struggle when multiple cameras and smart home appliances communicate simultaneously.';

  if (downloadMbps >= 150 && uploadMbps >= 25 && packetLoss === 0) {
    iotStatus = 'Legendary';
    iotScore = 96;
    iotHeadline = 'Massive Smart Ecosystem Ready';
    iotReason = 'Flawlessly powers 40+ concurrent smart devices, 2K/4K security camera continuous streams, and voice assistants.';
  } else if (downloadMbps >= 50 && uploadMbps >= 10 && packetLoss === 0) {
    iotStatus = 'Excellent';
    iotScore = 86;
    iotHeadline = 'Modern Connected Household';
    iotReason = 'Supports 15-25 smart plugs, thermostats, smart bulbs, and 2 live cloud-recording cameras easily.';
  } else if (downloadMbps >= 20 && uploadMbps >= 5) {
    iotStatus = 'Good';
    iotScore = 70;
    iotHeadline = 'Standard IoT Setup';
    iotReason = 'Comfortable with everyday smart speakers and sensors; avoid multiple simultaneous 4K cam streams.';
  } else {
    iotStatus = 'Fair';
    iotScore = 50;
    iotHeadline = 'Light Device Density Only';
    iotReason = 'Limited bandwidth headroom; high traffic from one device may throttle smart hubs.';
  }

  verdicts.push({
    category: 'smart_home',
    title: 'Smart Home & IoT Capacity',
    iconName: 'Cpu',
    status: iotStatus,
    statusColor: iotStatus === 'Legendary' ? 'text-pulse-cyan' : iotStatus === 'Excellent' ? 'text-pulse-neon' : iotStatus === 'Good' ? 'text-blue-400' : 'text-amber-400',
    score: iotScore,
    headline: iotHeadline,
    reason: iotReason,
    metricsObserved: `${downloadMbps} Mbps down • ${packetLoss}% loss`
  });

  return verdicts;
}

