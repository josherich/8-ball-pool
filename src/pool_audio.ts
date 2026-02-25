const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

class PoolAudioManager {
  private context: AudioContext | null = null;
  private unlocked = false;

  private ensureContext() {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    return this.context;
  }

  private withContext(playFn: (ctx: AudioContext) => void) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && !this.unlocked) return;
    playFn(ctx);
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.unlocked = true;
  }

  playGameOpening() {
    this.withContext((ctx) => {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.14, now);
      master.connect(ctx.destination);

      const tones = [220, 277, 330, 440];
      tones.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index < 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.06);
        gain.gain.setValueAtTime(0.0001, now + index * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.2, now + index * 0.06 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.06 + 0.26);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + index * 0.06);
        osc.stop(now + index * 0.06 + 0.3);
      });
    });
  }

  playShot(power: number) {
    this.withContext((ctx) => {
      const now = ctx.currentTime;
      const normalizedPower = clamp(power / 5, 0, 1);

      const impact = ctx.createOscillator();
      const gain = ctx.createGain();
      impact.type = 'triangle';
      impact.frequency.setValueAtTime(140 + normalizedPower * 70, now);
      impact.frequency.exponentialRampToValueAtTime(75, now + 0.08);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2 + normalizedPower * 0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      impact.connect(gain);
      gain.connect(ctx.destination);
      impact.start(now);
      impact.stop(now + 0.13);
    });
  }

  playBallCollision(relativeSpeed: number) {
    this.withContext((ctx) => {
      const now = ctx.currentTime;
      const intensity = clamp(relativeSpeed / 6, 0.15, 1);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(420 + intensity * 220, now);
      osc.frequency.exponentialRampToValueAtTime(220 + intensity * 90, now + 0.05);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045 + intensity * 0.06, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    });
  }


  playCushionCollision(ballSpeed: number) {
    this.withContext((ctx) => {
      const now = ctx.currentTime;
      const intensity = clamp(ballSpeed / 6, 0.1, 1);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + intensity * 110, now);
      osc.frequency.exponentialRampToValueAtTime(90 + intensity * 40, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03 + intensity * 0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    });
  }

  playFoul() {
    this.withContext((ctx) => {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.2, now);
      master.connect(ctx.destination);

      [210, 160].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + idx * 0.09 + 0.16);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.13, now + idx * 0.09 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.18);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.2);
      });
    });
  }
}

export default PoolAudioManager;
