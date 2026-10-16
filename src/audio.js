const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SETTINGS_KEY = 'iron-tide-audio-v1';

function storageOrNull() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function readAudioSettings(storage = storageOrNull()) {
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY));
    return {
      enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : true,
      volume: Number.isFinite(saved?.volume) ? clamp(saved.volume, 0, 1) : .65,
    };
  } catch { return { enabled: true, volume: .65 }; }
}

// Original synthesized sounds: no audio downloads or external services are needed.
export function noiseBuffer(context, seconds = 2, brown = false) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 19780617, previous = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    previous = (previous + white * .025) / 1.025;
    samples[i] = brown ? previous * 5 : white;
  }
  return buffer;
}

// Also accepts OfflineAudioContext, so tests can render and inspect actual waveforms.
export function synthesizeEffect(context, destination, type, options = {}) {
  const start = context.currentTime + (options.delay || 0);
  const sources = [], nodes = [];
  const output = context.createGain();
  output.gain.value = options.gain ?? 1;
  output.connect(destination); nodes.push(output);
  const endTimes = [];
  function envelope(duration, peak, attack = .008, offset = 0) {
    const gain = context.createGain(), t = start + offset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    gain.connect(output); nodes.push(gain); endTimes.push(t + duration);
    return gain;
  }
  function tone(from, to, duration, peak, wave = 'sine', offset = 0) {
    const source = context.createOscillator(), gain = envelope(duration, peak, .012, offset);
    source.type = wave;
    source.frequency.setValueAtTime(from, start + offset);
    source.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + offset + duration);
    source.connect(gain); source.start(start + offset); source.stop(start + offset + duration + .02);
    sources.push(source); return source;
  }
  function noise(duration, peak, frequency, filterType = 'lowpass', offset = 0, brown = false) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = options.noise || noiseBuffer(context, Math.max(2, duration), brown);
    source.loop = true;
    filter.type = filterType; filter.frequency.value = frequency; filter.Q.value = .7;
    source.connect(filter).connect(envelope(duration, peak, type === 'splash' ? .065 : .007, offset));
    source.start(start + offset); source.stop(start + offset + duration + .02);
    nodes.push(filter); sources.push(source); return filter;
  }
  if (type === 'fire') {
    tone(86, 28, .65, .45);
    tone(170, 46, .18, .12, 'triangle');
    noise(.17, .42, 2300);
    noise(.9, .34, 340, 'lowpass', .025);
    noise(.22, .08, 1400, 'bandpass', .18);
  } else if (type === 'torpedo') {
    tone(190, 43, .32, .22);
    const air = noise(.7, .22, 2000, 'bandpass');
    air.frequency.exponentialRampToValueAtTime(220, start + .7);
    noise(.9, .14, 650, 'lowpass', .16);
  } else if (type === 'hit') {
    noise(.42, .32, 1700, 'bandpass');
    tone(370, 98, .32, .2, 'triangle');
    tone(690, 260, .18, .07, 'sine', .025);
    tone(76, 31, .45, .22);
  } else if (type === 'sunk') {
    noise(2.2, .48, 430);
    noise(.28, .38, 2000);
    tone(62, 21, 1.8, .44);
    tone(149, 51, .9, .13, 'triangle', .13);
    noise(1.4, .22, 820, 'bandpass', .24);
  } else if (type === 'splash') {
    noise(.55, .22, 1350, 'lowpass');
    noise(.8, .09, 2200, 'highpass', .1);
    tone(155, 42, .22, .09);
  } else if (type === 'repair') {
    [520, 655, 780].forEach((f, i) => tone(f, f, .18, .055, 'sine', i * .12));
    noise(.14, .07, 1200, 'bandpass');
  } else if (type === 'reload') {
    noise(.055, .12, 1800, 'bandpass');
    noise(.09, .14, 950, 'bandpass', .11);
    tone(240, 110, .12, .05, 'triangle', .11);
  } else if (type === 'collision') {
    noise(.7, .28, 750, 'bandpass'); tone(104, 38, .5, .2, 'triangle');
  } else if (type === 'horn') {
    tone(110, 110, 1.25, .13, 'triangle');
    tone(165, 165, 1.15, .08, 'sine');
    tone(220, 220, 1, .045, 'sine');
  } else if (type === 'victory' || type === 'defeat') {
    const notes = type === 'victory' ? [220, 277.18, 329.63, 440] : [220, 196, 164.81, 146.83];
    notes.forEach((f, i) => {
      tone(f, f, .8, .08, 'triangle', i * .22);
      tone(f / 2, f / 2, 1, .075, 'sine', i * .22);
    });
  } else {
    tone(720, 460, .065, .04, 'sine');
  }
  const duration = Math.max(...endTimes) - context.currentTime + .05;
  let remaining = sources.length;
  const cleanup = () => {
    if (--remaining > 0) return;
    for (const source of sources) source.disconnect();
    for (const node of nodes) node.disconnect();
    options.onEnded?.();
  };
  sources.forEach(source => source.onended = cleanup);
  return { duration, sources, stop() { for (const source of sources) { try { source.stop(); } catch {} } } };
}

export class NavalAudio {
  constructor({ storage = storageOrNull(), contextFactory } = {}) {
    this.storage = storage;
    Object.assign(this, readAudioSettings(storage));
    this.contextFactory = contextFactory || (() => {
      const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Constructor ? new Constructor({ latencyHint: 'interactive' }) : null;
    });
    this.context = null; this.voices = new Set(); this.mode = 'harbor';
    this.enginePower = 0; this.lastReload = 0; this.lastBattle = null; this.hidden = false;
    this.lastLevels = { ambience: .8, engine: 0, effects: 1 };
  }
  save() {
    try { this.storage?.setItem(SETTINGS_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch {}
  }
  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!this.context) {
        this.context = this.contextFactory();
        if (!this.context) return false;
        this.buildGraph();
      }
      if (!this.hidden && this.context.state === 'suspended') await this.context.resume();
      this.applyMaster();
      return this.context.state === 'running';
    } catch { return false; }
  }
  buildGraph() {
    const c = this.context;
    this.master = c.createGain(); this.master.gain.value = 0;
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -12; this.compressor.knee.value = 16;
    this.compressor.ratio.value = 6; this.compressor.attack.value = .006; this.compressor.release.value = .28;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
    this.samples = new Float32Array(this.analyser.fftSize);
    this.master.connect(this.compressor).connect(this.analyser).connect(c.destination);
    this.ambience = c.createGain(); this.ambience.gain.value = .8; this.ambience.connect(this.master);
    this.engine = c.createGain(); this.engine.gain.value = 0; this.engine.connect(this.master);
    this.effects = c.createGain(); this.effects.connect(this.master);
    this.noise = noiseBuffer(c, 3);
    const loop = (frequency, volume, destination, filterType = 'lowpass') => {
      const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = this.noise; source.loop = true;
      filter.type = filterType; filter.frequency.value = frequency;
      gain.gain.value = volume; source.connect(filter).connect(gain).connect(destination); source.start();
      return { source, filter, gain };
    };
    this.surf = loop(420, .19, this.ambience);
    const swell = c.createOscillator(), swellDepth = c.createGain();
    swell.frequency.value = .11; swellDepth.gain.value = .075;
    swell.connect(swellDepth).connect(this.surf.gain.gain); swell.start();
    this.wind = loop(1200, .018, this.ambience, 'bandpass');
    this.wake = loop(1600, 0, this.ambience);
    this.propeller = loop(220, .14, this.engine);
    this.motor = c.createOscillator(); this.motor.type = 'triangle'; this.motor.frequency.value = 35;
    const motorGain = c.createGain(); motorGain.gain.value = .1;
    this.motor.connect(motorGain).connect(this.engine); this.motor.start();
    this.motorHarmonic = c.createOscillator(); this.motorHarmonic.type = 'sine'; this.motorHarmonic.frequency.value = 70;
    const harmonicGain = c.createGain(); harmonicGain.gain.value = .045;
    this.motorHarmonic.connect(harmonicGain).connect(this.engine); this.motorHarmonic.start();
  }
  applyMaster() {
    if (!this.context) return;
    this.master.gain.setTargetAtTime(this.enabled && !this.hidden ? this.volume : 0, this.context.currentTime, .025);
  }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled); this.save(); this.applyMaster();
    if (this.enabled) this.unlock();
  }
  setVolume(volume) {
    this.volume = clamp(Number.isFinite(volume) ? volume : .65, 0, 1);
    this.save(); this.applyMaster();
  }
  async setHidden(hidden) {
    this.hidden = hidden; this.applyMaster();
    if (!this.context) return;
    try {
      if (hidden && this.context.state === 'running') await this.context.suspend();
      else if (!hidden && this.enabled) await this.unlock();
    } catch {}
  }
  update(battle, paused = false) {
    if (!this.context) return;
    const c = this.context, now = c.currentTime;
    const active = battle && !battle.result && !paused;
    this.mode = active ? 'battle' : paused ? 'paused' : 'harbor';
    this.enginePower = active && !battle.player.dead ? clamp(Math.abs(battle.player.speed) / (battle.player.stats.speed * 1.4), 0, 1) : 0;
    const engine = active ? .12 + this.enginePower * .88 : 0;
    this.ambience.gain.setTargetAtTime(paused ? .28 : .8, now, .25);
    this.engine.gain.setTargetAtTime(engine, now, .18);
    this.effects.gain.setTargetAtTime(paused ? 0 : 1, now, .06);
    this.motor.frequency.setTargetAtTime(34 + this.enginePower * 36, now, .2);
    this.motorHarmonic.frequency.setTargetAtTime(68 + this.enginePower * 72, now, .2);
    this.wake.gain.gain.setTargetAtTime(this.enginePower * .11, now, .2);
    if (active && battle === this.lastBattle && this.lastReload > 0 && battle.player.reload === 0) this.play('reload');
    this.lastBattle = battle; this.lastReload = battle?.player.reload || 0;
    this.lastLevels = { ambience: paused ? .28 : .8, engine, effects: paused ? 0 : 1 };
  }
  play(type, position, listener) {
    if (!this.context || this.context.state !== 'running' || !this.enabled || this.hidden || this.volume === 0 || this.voices.size >= 32) return false;
    const c = this.context;
    let gain = 1, pan = 0;
    if (position && listener) {
      const dx = position.x - listener.x, dz = position.z - listener.z, distance = Math.hypot(dx, dz);
      gain = 1 / (1 + distance / 430);
      pan = clamp(-Math.sin(Math.atan2(dx, dz) - listener.heading) * Math.min(1, distance / 100), -1, 1);
    }
    const panner = c.createStereoPanner(); panner.pan.value = pan; panner.connect(this.effects);
    let voice;
    voice = synthesizeEffect(c, panner, type, { gain, noise: this.noise, onEnded: () => { this.voices.delete(voice); panner.disconnect(); } });
    this.voices.add(voice); return true;
  }
  measureLevel() {
    if (!this.analyser || this.context.state !== 'running') return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.sqrt(this.samples.reduce((sum, sample) => sum + sample * sample, 0) / this.samples.length);
  }
  get status() {
    return { enabled: this.enabled, volume: this.volume, state: this.context?.state || 'locked', mode: this.mode, enginePower: this.enginePower, voices: this.voices.size, ...this.lastLevels };
  }
}
