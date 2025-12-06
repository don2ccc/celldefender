class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  constructor() {
    try {
      // Lazy init in user interaction usually, but here we prep
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Default volume
      }
    } catch (e) {
      console.error("Audio not supported", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, startTime = 0) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
    
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  playNoise(duration: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    // Lowpass filter for explosion sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    gain.gain.setValueAtTime(1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    noise.start();
  }

  // SFX Presets
  playJump() { this.playTone(400, 'square', 0.1); }
  playAttack() { this.playTone(600, 'sawtooth', 0.1); }
  playHit() { this.playTone(150, 'square', 0.2); }
  playExplosion() { this.playNoise(0.4); }
  playPowerup() { 
    this.playTone(440, 'sine', 0.1, 0);
    this.playTone(880, 'sine', 0.2, 0.1);
  }
  playWin() {
    [440, 554, 659, 880].forEach((freq, i) => this.playTone(freq, 'triangle', 0.3, i * 0.15));
  }
  playLose() {
    [440, 415, 392, 370].forEach((freq, i) => this.playTone(freq, 'sawtooth', 0.4, i * 0.3));
  }
  
  // Simulated music loops (simple repeated patterns could be done here, but keeping it simple to SFX for responsiveness)
  playBGM(type: 'calm' | 'tense') {
    // A real implementation would loop a buffer. 
    // We will rely on UI feedback for 'music' state as synthesizing a full track in code is verbose.
  }
}

export const audio = new AudioService();