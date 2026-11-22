class AviationAudio {
  private ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.1,
    delay = 0
  ) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private playNoise(dur: number, filterType: BiquadFilterType, freq: number, q: number, vol: number) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * (dur * 0.45)));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.setValueAtTime(q, t0);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.002, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t0);
  }

  playSelect() {
    this.playTone(540, 840, 0.075, 'sine', 0.09);
  }

  playPathTick() {
    this.playTone(720, 760, 0.02, 'triangle', 0.013);
  }

  playLockRunway() {
    this.playTone(587.33, 587.33, 0.13, 'sine', 0.1, 0);
    this.playTone(880, 880, 0.16, 'sine', 0.1, 0.055);
  }

  playOrbitLock() {
    this.playTone(440, 660, 0.1, 'sine', 0.085, 0);
    this.playTone(660, 520, 0.12, 'triangle', 0.07, 0.08);
  }

  playMismatch() {
    this.playTone(260, 185, 0.15, 'sawtooth', 0.065);
  }

  playGoAround() {
    this.playTone(620, 440, 0.095, 'triangle', 0.085, 0);
    this.playTone(440, 700, 0.13, 'triangle', 0.085, 0.085);
  }

  playIncoming() {
    this.playTone(880, 880, 0.06, 'sine', 0.05, 0);
    this.playTone(1174, 1174, 0.08, 'sine', 0.05, 0.08);
  }

  playMaydayAlert() {
    this.playNoise(0.08, 'bandpass', 1800, 2.2, 0.06);
    this.playTone(780, 620, 0.16, 'sawtooth', 0.085, 0.04);
    this.playTone(780, 620, 0.16, 'sawtooth', 0.085, 0.22);
    this.playTone(780, 540, 0.2, 'sawtooth', 0.09, 0.4);
  }

  playFireSiren() {
    this.playTone(560, 920, 0.22, 'triangle', 0.075, 0);
    this.playTone(920, 560, 0.22, 'triangle', 0.075, 0.22);
  }

  playFoamExtinguish() {
    this.playNoise(0.28, 'bandpass', 1650, 1.4, 0.09);
    this.playTone(523.25, 1046.5, 0.24, 'sine', 0.09, 0.08);
  }

  playSlowMoOn() {
    this.playTone(680, 140, 0.34, 'sine', 0.12, 0);
    this.playTone(340, 95, 0.34, 'triangle', 0.09, 0.04);
  }

  playSlowMoOff() {
    this.playTone(170, 580, 0.24, 'sine', 0.095, 0);
  }

  playEmpPulse() {
    this.playTone(960, 180, 0.26, 'sawtooth', 0.1, 0);
    this.playTone(1440, 420, 0.2, 'sine', 0.09, 0.03);
    this.playNoise(0.14, 'highpass', 2400, 1.8, 0.07);
  }

  playUfoWarble() {
    this.playTone(340, 740, 0.22, 'sine', 0.08, 0);
    this.playTone(740, 310, 0.24, 'sine', 0.08, 0.22);
    this.playTone(310, 820, 0.22, 'sine', 0.07, 0.44);
  }

  playTcasSave() {
    this.playTone(440, 880, 0.14, 'triangle', 0.11, 0);
    this.playTone(880, 1320, 0.18, 'sine', 0.11, 0.1);
  }

  playLaunch() {
    this.playTone(210, 640, 0.32, 'sawtooth', 0.06);
    this.playTone(440, 880, 0.2, 'sine', 0.08, 0.05);
  }

  playWindShift() {
    this.playNoise(0.35, 'bandpass', 620, 1.1, 0.08);
    this.playTone(420, 640, 0.2, 'sine', 0.08, 0);
    this.playTone(640, 480, 0.25, 'sine', 0.08, 0.18);
  }

  playStormZap() {
    this.playTone(190, 60, 0.18, 'sawtooth', 0.095);
    this.playNoise(0.18, 'lowpass', 950, 1.2, 0.08);
  }

  playLandSuccess(streak = 1) {
    const boost = Math.min(streak - 1, 6) * 32;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.playTone(freq + boost, freq + boost, 0.21, 'sine', 0.08, idx * 0.048);
    });
  }

  playTCAS() {
    this.playTone(940, 1200, 0.12, 'sawtooth', 0.055);
  }

  playTouchdown(isWater = false) {
    this.playNoise(isWater ? 0.26 : 0.16, isWater ? 'lowpass' : 'bandpass', isWater ? 1100 : 2100, isWater ? 1.0 : 3.0, 0.1);
  }

  playExplosion() {
    this.playNoise(0.62, 'lowpass', 560, 0.9, 0.28);
    this.playTone(150, 32, 0.45, 'sine', 0.24);
  }

  playUpgradeBuy() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
      this.playTone(f, f, 0.18, 'triangle', 0.09, idx * 0.045);
    });
  }

  playVictory() {
    [440, 554.37, 659.25, 880, 1108.73, 1318.5].forEach((freq, idx) => {
      this.playTone(freq, freq, 0.36, 'triangle', 0.11, idx * 0.085);
    });
  }
}

export const audio = new AviationAudio();
