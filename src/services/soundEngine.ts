// Web Audio API dynamic sonification synthesizer

class SoundEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isEnabled: boolean = false;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    } catch {
      console.warn('Web Audio API not supported in this browser.');
    }
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled) {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.startCarrier();
    } else {
      this.stopCarrier();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private startCarrier() {
    if (!this.ctx || !this.isEnabled || this.osc) return;
    try {
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'sine';
      this.osc.frequency.setValueAtTime(220, this.ctx.currentTime); // A3 baseline

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
      console.warn('Audio carrier start error:', e);
    }
  }

  private stopCarrier() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
    }
    setTimeout(() => {
      try {
        if (this.osc) {
          this.osc.stop();
          this.osc.disconnect();
          this.osc = null;
        }
      } catch {
        // ignore
      }
    }, 120);
  }

  /**
   * Modulate pitch based on real-time Mbps (1 Mbps ~ 220Hz, 100 Mbps ~ 660Hz, 1000 Mbps ~ 1200Hz)
   */
  public updateSpeed(mbps: number) {
    if (!this.isEnabled || !this.ctx || !this.osc || !this.gainNode) return;
    try {
      const now = this.ctx.currentTime;
      if (mbps <= 0.05) {
        this.gainNode.gain.setTargetAtTime(0.005, now, 0.05);
        this.osc.frequency.setTargetAtTime(180, now, 0.05);
        return;
      }

      // Map Mbps log-scale from 200Hz to 1100Hz
      const normalized = Math.min(Math.max(Math.log10(Math.max(1, mbps)) / 3.2, 0), 1);
      const targetFreq = 220 + normalized * 880;
      const targetGain = 0.04 + normalized * 0.04;

      this.osc.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.gainNode.gain.setTargetAtTime(targetGain, now, 0.08);
    } catch {
      // ignore
    }
  }

  /**
   * Play a clean sci-fi chime when stage completes
   */
  public playPhaseChime(type: 'phase' | 'success' | 'warn' = 'phase') {
    if (!this.isEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.85);
      } else if (type === 'warn') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.setValueAtTime(220, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();

