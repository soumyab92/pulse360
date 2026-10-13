import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TestStage } from '../types';

interface WebGLDataTunnelProps {
  stage: TestStage;
  liveMbps: number;
  peakMbps: number;
}

export const WebGLDataTunnel: React.FC<WebGLDataTunnelProps> = ({
  stage,
  liveMbps,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    stage,
    liveMbps,
    targetSpeed: 0.8,
    currentSpeed: 0.8,
    targetColor: new THREE.Color(0x00f0ff),
    currentColor: new THREE.Color(0x00f0ff)
  });

  // Keep stateRef up to date
  useEffect(() => {
    stateRef.current.stage = stage;
    stateRef.current.liveMbps = liveMbps;

    // Calculate target speed based on stage and live Mbps
    if (stage === 'idle' || stage === 'telemetry' || stage === 'dns' || stage === 'latency') {
      stateRef.current.targetSpeed = 0.6;
      stateRef.current.targetColor = new THREE.Color(0x818cf8); // Indigo
    } else if (stage === 'download' || stage === 'loaded-latency-down') {
      // Speed scales with download rate
      const speedFactor = Math.min(Math.max(liveMbps / 8, 2), 32);
      stateRef.current.targetSpeed = speedFactor;
      stateRef.current.targetColor = new THREE.Color(0x00f0ff); // Neon Cyan
    } else if (stage === 'upload' || stage === 'loaded-latency-up') {
      const speedFactor = Math.min(Math.max(liveMbps / 6, 2), 26);
      stateRef.current.targetSpeed = speedFactor;
      stateRef.current.targetColor = new THREE.Color(0xf43f5e); // Hot Pink / Crimson
    } else if (stage === 'completed') {
      stateRef.current.targetSpeed = 1.0;
      stateRef.current.targetColor = new THREE.Color(0x00f7a5); // Emerald Gold
    } else if (stage === 'stability') {
      stateRef.current.targetSpeed = 3.5;
      stateRef.current.targetColor = new THREE.Color(0xa855f7); // Electric Violet
    }
  }, [stage, liveMbps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08090d, 0.0025);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1200);
    camera.position.z = 200;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      return; // WebGL unavailable fallback
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create Tunnel Particles
    const PARTICLE_COUNT = 1600;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const speeds = new Float32Array(PARTICLE_COUNT);

    const tunnelRadius = 120;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * tunnelRadius;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800; // Z depth
      scales[i] = Math.random() * 2.5 + 1.2;
      speeds[i] = Math.random() * 0.5 + 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    // Particle sprite using procedural canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(0, 240, 255, 0.8)');
      gradient.addColorStop(0.8, 'rgba(0, 240, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 4.5,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Add geometric cyber rings inside the tunnel
    const ringsGroup = new THREE.Group();
    const RING_COUNT = 8;
    for (let i = 0; i < RING_COUNT; i++) {
      const ringGeo = new THREE.TorusGeometry(85 + (i % 3) * 15, 0.4, 8, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = -i * 100;
      ringsGroup.add(ring);
    }
    scene.add(ringsGroup);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth interpolation for speed & color
      stateRef.current.currentSpeed += (stateRef.current.targetSpeed - stateRef.current.currentSpeed) * 0.08;
      stateRef.current.currentColor.lerp(stateRef.current.targetColor, 0.06);

      material.color.copy(stateRef.current.currentColor);

      // Rotate camera gently
      camera.rotation.z += 0.001 * stateRef.current.currentSpeed;

      // Update particles
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      const baseVel = stateRef.current.currentSpeed * 45 * delta;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Move towards camera
        posArray[i * 3 + 2] += baseVel * speeds[i];

        // Recycle particle when passing camera
        if (posArray[i * 3 + 2] > 250) {
          posArray[i * 3 + 2] = -550;
          const angle = Math.random() * Math.PI * 2;
          const radius = 25 + Math.random() * tunnelRadius;
          posArray[i * 3] = Math.cos(angle) * radius;
          posArray[i * 3 + 1] = Math.sin(angle) * radius;
        }
      }
      posAttr.needsUpdate = true;

      // Update cyber rings
      ringsGroup.children.forEach((ringMesh, idx) => {
        ringMesh.position.z += baseVel * 1.2;
        ringMesh.rotation.z += (idx % 2 === 0 ? 1 : -1) * 0.003 * stateRef.current.currentSpeed;
        if (ringMesh.position.z > 250) {
          ringMesh.position.z = -550;
        }
        const meshMat = (ringMesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        meshMat.color.copy(stateRef.current.currentColor);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-[360px] md:h-[420px] rounded-2xl overflow-hidden bg-pulse-surface/80 border border-pulse-border shadow-2xl backdrop-blur-xl group">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Cyber Grid Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-pulse-bg via-transparent to-pulse-bg/60 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40" />

      {/* HUD Overlay Details */}
      <div className="absolute top-4 left-5 z-10 flex items-center space-x-3 pointer-events-none">
        <span className="flex h-3 w-3 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            stage === 'idle' ? 'bg-slate-400' :
            stage === 'download' ? 'bg-pulse-cyan' :
            stage === 'upload' ? 'bg-pulse-pink' :
            stage === 'completed' ? 'bg-pulse-neon' : 'bg-pulse-violet'
          }`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${
            stage === 'idle' ? 'bg-slate-500' :
            stage === 'download' ? 'bg-pulse-cyan' :
            stage === 'upload' ? 'bg-pulse-pink' :
            stage === 'completed' ? 'bg-pulse-neon' : 'bg-pulse-violet'
          }`} />
        </span>
        <div className="font-mono text-xs tracking-wider uppercase text-slate-300 font-semibold bg-pulse-bg/80 px-2.5 py-1 rounded-md border border-pulse-border backdrop-blur-md">
          {stage === 'idle' && 'TUNNEL ENGINE • IDLE'}
          {stage === 'telemetry' && 'TELEMETRY HANDSHAKE'}
          {stage === 'dns' && 'DNS QUERY BENCHMARK'}
          {stage === 'latency' && 'PING & JITTER SAMPLING'}
          {stage === 'download' && 'SATURATING DOWNLOAD STREAM'}
          {stage === 'loaded-latency-down' && 'LOADED BUFFERBLOAT (DOWN)'}
          {stage === 'upload' && 'BURST UPLOAD STREAM'}
          {stage === 'loaded-latency-up' && 'LOADED BUFFERBLOAT (UP)'}
          {stage === 'completed' && 'PULSE ANALYSIS COMPLETE'}
          {stage === 'stability' && '60-SEC STABILITY STREAM'}
        </div>
      </div>

      <div className="absolute top-4 right-5 z-10 hidden sm:flex items-center space-x-2 font-mono text-[11px] text-slate-400 bg-pulse-bg/80 px-3 py-1 rounded-md border border-pulse-border backdrop-blur-md">
        <span>PARTICLES: <strong className="text-pulse-cyan">1,600</strong></span>
        <span>•</span>
        <span>RENDERER: <strong className="text-emerald-400">WebGL 2.0</strong></span>
      </div>

      {/* Center Live Velocity Indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none select-none">
        {(stage === 'download' || stage === 'upload' || stage === 'stability') && (
          <div className="flex flex-col items-center animate-fade-in">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-400 mb-1">
              {stage === 'download' ? 'Live Download Velocity' : stage === 'upload' ? 'Live Upload Velocity' : 'Continuous Throughput'}
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="font-mono text-5xl md:text-7xl font-extrabold tracking-tighter text-white drop-shadow-[0_0_25px_rgba(0,240,255,0.4)]">
                {liveMbps.toFixed(1)}
              </span>
              <span className="font-mono text-lg md:text-xl font-bold text-pulse-cyan">
                Mbps
              </span>
            </div>
            <div className="mt-2 text-xs font-mono text-slate-400 bg-pulse-card/80 px-3 py-0.5 rounded-full border border-pulse-border">
              PEAK: <strong className="text-slate-200">{peakMbps.toFixed(1)} Mbps</strong>
            </div>
          </div>
        )}

        {stage === 'idle' && (
          <div className="text-center px-4">
            <div className="text-slate-400 text-xs font-mono tracking-widest uppercase mb-2">PULSE360 HYPERSPACE TUNNEL</div>
            <p className="text-slate-300 font-sans text-sm md:text-base max-w-md">
              Ready to benchmark your connection. Tap <strong className="text-pulse-cyan">Start Full 360 Analysis</strong> below.
            </p>
          </div>
        )}

        {stage === 'completed' && (
          <div className="text-center px-4 animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pulse-neon/10 border border-pulse-neon/30 text-pulse-neon font-mono text-xs uppercase font-bold tracking-wider mb-2">
              <span>● ANALYSIS COMPLETE</span>
            </div>
            <h3 className="text-white font-sans text-lg md:text-2xl font-bold tracking-tight">
              360° Network Profile Synthesized
            </h3>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-md font-mono">
              Review your Network DNA radar, verdicts, and bufferbloat grade below.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Subtle Grid Line */}
      <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-pulse-cyan/50 to-transparent" />
    </div>
  );
};

