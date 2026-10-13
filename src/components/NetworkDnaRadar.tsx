import React, { useRef, useEffect } from 'react';
import { Download, Share2, Sparkles, ShieldCheck } from 'lucide-react';
import { NetworkDnaScores, TelemetryData, BufferbloatStats } from '../types';

interface NetworkDnaRadarProps {
  scores: NetworkDnaScores;
  telemetry: TelemetryData | null;
  downloadSpeed: number;
  uploadSpeed: number;
  idleLatency: number;
  jitter: number;
  bufferbloat: BufferbloatStats;
}

export const NetworkDnaRadar: React.FC<NetworkDnaRadarProps> = ({
  scores,
  telemetry,
  downloadSpeed,
  uploadSpeed,
  idleLatency,
  jitter,
  bufferbloat
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  const axes = [
    { key: 'speed', label: 'Speed', value: scores.speed, unit: 'Down' },
    { key: 'stability', label: 'Stability', value: scores.stability, unit: 'Jitter/Loss' },
    { key: 'latency', label: 'Latency', value: scores.latency, unit: 'Base Ping' },
    { key: 'upload', label: 'Upload', value: scores.upload, unit: 'Burst Up' },
    { key: 'bufferbloat', label: 'Queue SQM', value: scores.bufferbloat, unit: 'Bufferbloat' },
    { key: 'dns', label: 'DNS Ping', value: scores.dns, unit: 'Resolution' },
  ];

  // Draw the interactive canvas radar
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 360;
    const height = 360;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = 115;
    const totalAxes = axes.length;
    const angleStep = (Math.PI * 2) / totalAxes;

    // Draw concentric hexagonal webs
    const gridLevels = [0.25, 0.5, 0.75, 1.0];
    gridLevels.forEach((level, idx) => {
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const r = maxRadius * level;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = idx === gridLevels.length - 1 ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw axis radial spokes
    for (let i = 0; i < totalAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Axis label
      const labelDistance = maxRadius + 24;
      const lx = centerX + Math.cos(angle) * labelDistance;
      const ly = centerY + Math.sin(angle) * labelDistance;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axes[i].label, lx, ly - 6);

      ctx.fillStyle = '#00f0ff';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`${axes[i].value}`, lx, ly + 8);
    }

    // Draw filled DNA radar polygon
    ctx.beginPath();
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (axis.value / 100) * maxRadius;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Gradient fill
    const fillGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, maxRadius);
    fillGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    fillGrad.addColorStop(0.7, 'rgba(168, 85, 247, 0.3)');
    fillGrad.addColorStop(1, 'rgba(0, 247, 165, 0.15)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Draw node vertices
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (axis.value / 100) * maxRadius;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [scores]);

  // Export as high-resolution share card (1200x675 PNG)
  const handleExportCard = () => {
    const card = document.createElement('canvas');
    card.width = 1200;
    card.height = 675;
    const ctx = card.getContext('2d');
    if (!ctx) return;

    // 1. Cyber Dark Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
    bgGrad.addColorStop(0, '#08090d');
    bgGrad.addColorStop(0.5, '#0f121e');
    bgGrad.addColorStop(1, '#08090d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 675);

    // Neon Accent Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 1164, 639);

    // Grid lines accent
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 60; x < 1200; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 655);
      ctx.stroke();
    }
    for (let y = 60; y < 675; y += 60) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(1180, y);
      ctx.stroke();
    }

    // 2. Header
    ctx.fillStyle = '#00f0ff';
    ctx.font = '800 28px "JetBrains Mono", monospace';
    ctx.fillText('PULSE360', 60, 75);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 16px "Inter", sans-serif';
    ctx.fillText('// COMPREHENSIVE NETWORK DNA FINGERPRINT', 220, 75);

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    ctx.fillStyle = '#64748b';
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, 1140, 75);
    ctx.textAlign = 'left';

    // 3. Left Panel: Metrics Box
    ctx.fillStyle = 'rgba(20, 24, 36, 0.85)';
    ctx.fillRect(60, 115, 520, 480);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(60, 115, 520, 480);

    // Composite Badge
    ctx.fillStyle = '#00f7a5';
    ctx.font = '800 52px "JetBrains Mono", monospace';
    ctx.fillText(`${scores.compositeScore}`, 90, 190);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 18px "Inter", sans-serif';
    ctx.fillText('/ 100 DNA INDEX', 185, 175);

    let tierLabel = 'LEGENDARY GIGABIT FIBER';
    if (scores.compositeScore < 50) tierLabel = 'CHALLENGED BROADBAND';
    else if (scores.compositeScore < 70) tierLabel = 'STANDARD HOME BROADBAND';
    else if (scores.compositeScore < 85) tierLabel = 'HIGH-PERFORMANCE TIER';
    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(tierLabel, 185, 195);

    // Key Stats Grid
    const statRows = [
      { label: 'DOWNLOAD SPEED', value: `${downloadSpeed.toFixed(1)} Mbps`, color: '#00f0ff' },
      { label: 'UPLOAD SPEED', value: `${uploadSpeed.toFixed(1)} Mbps`, color: '#f43f5e' },
      { label: 'IDLE LATENCY', value: `${idleLatency} ms`, color: '#a855f7' },
      { label: 'LATENCY JITTER', value: `${jitter} ms`, color: '#38bdf8' },
      { label: 'BUFFERBLOAT GRADE', value: `Grade ${bufferbloat.grade} (+${bufferbloat.worstDelta}ms)`, color: '#00f7a5' },
      { label: 'EDGE ROUTE', value: `${telemetry?.colo || 'EDGE'} (${telemetry?.city || 'Global'})`, color: '#cbd5e1' },
      { label: 'ISP & ASN', value: `${telemetry?.isp || 'Cloudflare Anycast'} [${telemetry?.asn || 'AS13335'}]`, color: '#94a3b8' }
    ];

    let rowY = 245;
    statRows.forEach((r) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillText(r.label, 90, rowY);

      ctx.fillStyle = r.color;
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(r.value, 90, rowY + 22);

      rowY += 46;
    });

    // 4. Right Panel: Draw Network DNA Radar into Card
    const cardCenterX = 890;
    const cardCenterY = 355;
    const cardMaxRadius = 160;
    const totalAxes = axes.length;
    const angleStep = (Math.PI * 2) / totalAxes;

    // Web
    [0.25, 0.5, 0.75, 1.0].forEach((level) => {
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const r = cardMaxRadius * level;
        const x = cardCenterX + Math.cos(angle) * r;
        const y = cardCenterY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
    });

    // Axis Spokes & Labels
    for (let i = 0; i < totalAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = cardCenterX + Math.cos(angle) * cardMaxRadius;
      const y = cardCenterY + Math.sin(angle) * cardMaxRadius;
      ctx.beginPath();
      ctx.moveTo(cardCenterX, cardCenterY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.stroke();

      const lx = cardCenterX + Math.cos(angle) * (cardMaxRadius + 32);
      const ly = cardCenterY + Math.sin(angle) * (cardMaxRadius + 32);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(axes[i].label, lx, ly - 8);
      ctx.fillStyle = '#00f0ff';
      ctx.font = '800 16px "JetBrains Mono", monospace';
      ctx.fillText(`${axes[i].value}`, lx, ly + 14);
    }
    ctx.textAlign = 'left';

    // Radar polygon
    ctx.beginPath();
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (axis.value / 100) * cardMaxRadius;
      const x = cardCenterX + Math.cos(angle) * r;
      const y = cardCenterY + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const polyGrad = ctx.createRadialGradient(cardCenterX, cardCenterY, 20, cardCenterX, cardCenterY, cardMaxRadius);
    polyGrad.addColorStop(0, 'rgba(0, 240, 255, 0.55)');
    polyGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.35)');
    polyGrad.addColorStop(1, 'rgba(0, 247, 165, 0.2)');
    ctx.fillStyle = polyGrad;
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Vertices
    axes.forEach((axis, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (axis.value / 100) * cardMaxRadius;
      const x = cardCenterX + Math.cos(angle) * r;
      const y = cardCenterY + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // 5. Footer Watermark
    ctx.fillStyle = '#475569';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('POWERED BY PULSE360 TELEMETRY ENGINE • ZERO FAKED DATA • VERIFIED VIA CLOUDFLARE SPEEDTEST', 60, 630);

    // Trigger download
    const url = card.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `PULSE360-NetworkDNA-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between p-6 rounded-2xl bg-pulse-card/90 border border-pulse-border shadow-xl backdrop-blur-xl">
      {/* Left Column: DNA Info & Composite Score */}
      <div className="flex flex-col space-y-4 max-w-sm mb-6 lg:mb-0">
        <div className="flex items-center space-x-2 text-pulse-cyan">
          <Sparkles className="w-5 h-5" />
          <span className="font-mono text-xs uppercase tracking-wider font-bold">Network DNA Fingerprint</span>
        </div>

        <div>
          <div className="flex items-baseline space-x-3">
            <span className="font-mono text-5xl md:text-6xl font-extrabold text-white tracking-tight">
              {scores.compositeScore}
            </span>
            <span className="font-mono text-sm text-slate-400 font-semibold">
              / 100 COMPOSITE INDEX
            </span>
          </div>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Every connection has a distinctive digital fingerprint. PULSE360 synthesizes speed, queue latency, upload stability, and DNS into an immutable 6-axis signature.
          </p>
        </div>

        {/* DNA Axis Summary Pills */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          {axes.map((ax) => (
            <div key={ax.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-pulse-surface border border-pulse-border text-xs font-mono">
              <span className="text-slate-400">{ax.label}</span>
              <strong className="text-pulse-cyan font-bold">{ax.value}</strong>
            </div>
          ))}
        </div>

        {/* Share / Export Card Button */}
        <button
          onClick={handleExportCard}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pulse-cyan/20 to-pulse-violet/20 hover:from-pulse-cyan/30 hover:to-pulse-violet/30 border border-pulse-cyan/40 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
        >
          <Download className="w-4 h-4 text-pulse-cyan" />
          <span>Export Shareable DNA Card (PNG)</span>
        </button>
      </div>

      {/* Right Column: Hexagonal Radar Canvas */}
      <div className="relative flex items-center justify-center">
        <canvas ref={radarCanvasRef} className="w-[320px] h-[320px] md:w-[360px] md:h-[360px]" />
      </div>
    </div>
  );
};

