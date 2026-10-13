import React from 'react';
import { ArrowDown, ArrowUp, Activity, Gauge } from 'lucide-react';
import { TestStage } from '../types';

interface Gauge360Props {
  stage: TestStage;
  currentMbps: number;
  peakMbps: number;
  ghostMbps?: number | null;
  mode: 'download' | 'upload';
  isLive: boolean;
}

export const Gauge360: React.FC<Gauge360Props> = ({
  stage,
  currentMbps,
  peakMbps,
  ghostMbps,
  mode,
  isLive
}) => {
  // SVG circular arc config
  // Arc spans 240 degrees (from 150 deg to 390 deg)
  const size = 260;
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;

  // Max scale logic: dynamic scale (up to 100 Mbps, 500 Mbps, or 1000 Mbps)
  let maxScale = 100;
  const effectiveMax = Math.max(currentMbps, peakMbps, ghostMbps || 0);
  if (effectiveMax > 500) maxScale = 1000;
  else if (effectiveMax > 100) maxScale = 500;
  else if (effectiveMax > 50) maxScale = 100;
  else maxScale = 50;

  // Angular mapping: 0 to maxScale maps to 0 to 240 degrees
  const clampedVal = Math.min(Math.max(currentMbps, 0), maxScale);
  const currentAngle = (clampedVal / maxScale) * 240;

  const clampedPeak = Math.min(Math.max(peakMbps, 0), maxScale);
  const peakAngle = (clampedPeak / maxScale) * 240;

  const clampedGhost = ghostMbps ? Math.min(Math.max(ghostMbps, 0), maxScale) : 0;
  const ghostAngle = (clampedGhost / maxScale) * 240;

  // Arc math helper
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Base angles: start at 150 deg (bottom left), sweep 240 deg to 390 deg (bottom right)
  const startAngle = 150;
  const backgroundArc = describeArc(center, center, radius, startAngle, startAngle + 240);
  const currentArc = currentAngle > 0 ? describeArc(center, center, radius, startAngle, startAngle + currentAngle) : '';

  // Ghost indicator position
  const ghostPoint = polarToCartesian(center, center, radius, startAngle + ghostAngle);
  const peakPoint = polarToCartesian(center, center, radius, startAngle + peakAngle);

  const isDownload = mode === 'download';
  const themeColor = isDownload ? '#00f0ff' : '#f43f5e';
  const glowColor = isDownload ? 'rgba(0, 240, 255, 0.4)' : 'rgba(244, 63, 94, 0.4)';

  return (
    <div className={`relative flex flex-col items-center justify-center p-6 rounded-2xl bg-pulse-card/90 border transition-all duration-300 ${
      isLive ? 'border-pulse-cyan/50 shadow-[0_0_30px_rgba(0,240,255,0.15)] ring-1 ring-pulse-cyan/30' : 'border-pulse-border shadow-lg'
    }`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${isDownload ? 'bg-pulse-cyan/10 text-pulse-cyan' : 'bg-pulse-pink/10 text-pulse-pink'}`}>
            {isDownload ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
          </div>
          <span className="font-mono text-xs uppercase font-bold tracking-wider text-slate-300">
            {isDownload ? 'Download Throughput' : 'Upload Throughput'}
          </span>
        </div>
        
        {isLive && (
          <span className="flex items-center space-x-1.5 font-mono text-[10px] text-pulse-cyan font-semibold uppercase px-2 py-0.5 rounded-full bg-pulse-cyan/10 border border-pulse-cyan/30 animate-pulse">
            <Activity className="w-3 h-3" />
            <span>Streaming</span>
          </span>
        )}
      </div>

      {/* SVG Circular Gauge */}
      <div className="relative w-[260px] h-[220px] flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible">
          <defs>
            <linearGradient id={`gaugeGrad_${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
              {isDownload ? (
                <>
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#00f7a5" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="50%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#fb923c" />
                </>
              )}
            </linearGradient>
            <filter id={`glow_${mode}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Ghost Run Overlay (Translucent previous test indicator) */}
          {ghostMbps !== null && ghostMbps !== undefined && ghostMbps > 0 && (
            <>
              {/* Ghost arc outline */}
              <path
                d={describeArc(center, center, radius, startAngle, startAngle + ghostAngle)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.22)"
                strokeWidth={strokeWidth}
                strokeDasharray="4 6"
                strokeLinecap="round"
                className="transition-all duration-500"
              />
              {/* Ghost marker bead */}
              <circle
                cx={ghostPoint.x}
                cy={ghostPoint.y}
                r="7"
                fill="#ffffff"
                opacity="0.8"
                className="animate-pulse"
              />
            </>
          )}

          {/* Active Live Arc */}
          {currentAngle > 0 && (
            <path
              d={currentArc}
              fill="none"
              stroke={`url(#gaugeGrad_${mode})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              filter={`url(#glow_${mode})`}
              className="transition-all duration-100 ease-out"
            />
          )}

          {/* Peak Speed Marker Bead */}
          {peakAngle > 2 && (
            <circle
              cx={peakPoint.x}
              cy={peakPoint.y}
              r="4"
              fill={themeColor}
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* Center Digital Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
          <div className="flex items-baseline space-x-1.5">
            <span className="font-mono text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
              {currentMbps.toFixed(1)}
            </span>
            <span className="font-mono text-sm font-semibold text-slate-400">
              Mbps
            </span>
          </div>

          <div className="flex items-center space-x-3 mt-1 font-mono text-[11px] text-slate-400">
            <span>PEAK: <strong className="text-slate-200">{peakMbps.toFixed(1)}</strong></span>
            {ghostMbps !== null && ghostMbps !== undefined && ghostMbps > 0 && (
              <span className="text-slate-300">
                GHOST: <strong className="text-amber-300">{ghostMbps.toFixed(1)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Min / Max Tick Labels */}
        <div className="absolute bottom-2 left-6 font-mono text-[10px] text-slate-400">0</div>
        <div className="absolute bottom-2 right-6 font-mono text-[10px] text-slate-400">{maxScale}</div>
      </div>

      {/* Ghost Comparison Status Pill */}
      {ghostMbps !== null && ghostMbps !== undefined && ghostMbps > 0 && (
        <div className="w-full mt-3 pt-3 border-t border-pulse-border/60 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-white/70 inline-block" />
            <span>Ghost Run Comparison:</span>
          </span>
          {currentMbps > ghostMbps ? (
            <span className="text-pulse-neon font-bold flex items-center space-x-1">
              <span>+{(currentMbps - ghostMbps).toFixed(1)} Mbps faster</span>
              <span>↑</span>
            </span>
          ) : currentMbps < ghostMbps && currentMbps > 0 ? (
            <span className="text-pulse-pink font-bold flex items-center space-x-1">
              <span>-{(ghostMbps - currentMbps).toFixed(1)} Mbps slower</span>
              <span>↓</span>
            </span>
          ) : (
            <span className="text-slate-400">Prior: {ghostMbps.toFixed(1)} Mbps</span>
          )}
        </div>
      )}
    </div>
  );
};

