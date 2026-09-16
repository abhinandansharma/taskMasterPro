/* ambiently 1.0.0 (https://www.npmjs.com/package/ambiently), MIT. Unmodified dist/index.js of the npm package. */
// src/noise.ts
var NOISE_SECONDS = 4;
var cache = /* @__PURE__ */ new WeakMap();
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
function fillNoise(out, kind, seed = 1) {
  const rand = rng(seed);
  if (kind === "white") {
    for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
    return out;
  }
  if (kind === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < out.length; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return out;
  }
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rand() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5;
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}
function noiseBuffer(ctx, kind) {
  let m = cache.get(ctx);
  if (!m) {
    m = /* @__PURE__ */ new Map();
    cache.set(ctx, m);
  }
  const hit = m.get(kind);
  if (hit) return hit;
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) fillNoise(buffer.getChannelData(ch), kind, 7 + ch * 31);
  m.set(kind, buffer);
  return buffer;
}

// src/hits.ts
var HIT_NAMES = [
  "kick",
  "sub",
  "tom",
  "snare",
  "rim",
  "clap",
  "hat",
  "shaker",
  "wood",
  "pluck",
  "bell",
  "chime",
  "stab",
  "blip",
  "zap",
  "laser",
  "sweep",
  "riser",
  "noise",
  "drop"
];
var DURATIONS = {
  kick: 0.45,
  sub: 0.8,
  tom: 0.5,
  snare: 0.25,
  rim: 0.12,
  clap: 0.3,
  hat: 0.08,
  shaker: 0.15,
  wood: 0.1,
  pluck: 0.9,
  bell: 1.6,
  chime: 2.2,
  stab: 0.5,
  blip: 0.12,
  zap: 0.3,
  laser: 0.45,
  sweep: 0.7,
  riser: 1.2,
  noise: 0.4,
  drop: 0.6
};
var semis = (n) => Math.pow(2, n / 12);
function createHits(ctx, destination = ctx.destination) {
  const output = ctx.createGain();
  output.gain.value = 0.9;
  output.connect(destination);
  function env(t, peak, attack, decay, curve = "exp") {
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(Math.max(peak, 2e-4), t + attack);
    if (curve === "exp") g.gain.exponentialRampToValueAtTime(1e-4, t + attack + decay);
    else g.gain.linearRampToValueAtTime(1e-4, t + attack + decay);
    g.connect(output);
    return g;
  }
  function osc(type, freq, t, stopAt, dest, sweepTo, sweepIn) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo !== void 0) o.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t + (sweepIn ?? stopAt - t));
    o.connect(dest);
    o.start(t);
    o.stop(stopAt + 0.05);
    o.onended = () => {
      o.disconnect();
      dest.disconnect();
    };
    return o;
  }
  function noise(t, stopAt, dest, kind = "white") {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, kind);
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 2);
    s.stop(stopAt + 0.05);
    s.onended = () => {
      s.disconnect();
      dest.disconnect();
    };
    return s;
  }
  function filter(type, freq, q, dest) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }
  const voices = {
    kick(t, v) {
      const g = env(t, 1.1 * v, 2e-3, 0.42);
      osc("sine", 150, t, t + 0.45, g, 42, 0.12);
      const click = env(t, 0.35 * v, 1e-3, 0.02);
      noise(t, t + 0.03, filter("highpass", 2500, 0.7, click));
    },
    sub(t, v, p) {
      const g = env(t, 0.9 * v, 0.01, 0.8);
      osc("sine", 55 * p, t, t + 0.8, g, 48 * p, 0.6);
    },
    tom(t, v, p) {
      const g = env(t, 0.9 * v, 3e-3, 0.5);
      osc("sine", 220 * p, t, t + 0.5, g, 95 * p, 0.3);
      const n = env(t, 0.15 * v, 1e-3, 0.05);
      noise(t, t + 0.06, filter("bandpass", 1800, 1, n));
    },
    snare(t, v) {
      const body = env(t, 0.6 * v, 2e-3, 0.14);
      osc("triangle", 190, t, t + 0.15, body, 120, 0.1);
      const n = env(t, 0.8 * v, 1e-3, 0.25);
      noise(t, t + 0.3, filter("highpass", 1600, 0.8, n));
    },
    rim(t, v) {
      const g = env(t, 0.7 * v, 1e-3, 0.12);
      osc("square", 1800, t, t + 0.12, filter("bandpass", 1800, 6, g));
    },
    clap(t, v) {
      for (let i = 0; i < 3; i++) {
        const g = env(t + i * 0.012, 0.45 * v, 1e-3, 0.04);
        noise(t + i * 0.012, t + i * 0.012 + 0.05, filter("bandpass", 1400, 1.2, g));
      }
      const tail = env(t + 0.036, 0.5 * v, 1e-3, 0.26);
      noise(t + 0.036, t + 0.3, filter("bandpass", 1300, 0.9, tail));
    },
    hat(t, v) {
      const g = env(t, 0.5 * v, 1e-3, 0.08);
      noise(t, t + 0.09, filter("highpass", 7e3, 0.7, g));
    },
    shaker(t, v) {
      const g = env(t, 0.4 * v, 0.03, 0.12, "lin");
      noise(t, t + 0.16, filter("bandpass", 5500, 2, g), "pink");
    },
    wood(t, v, p) {
      const g = env(t, 0.9 * v, 1e-3, 0.1);
      osc("sine", 820 * p, t, t + 0.1, filter("bandpass", 820 * p, 8, g), 700 * p, 0.08);
    },
    pluck(t, v, p) {
      const g = env(t, 0.7 * v, 2e-3, 0.9);
      const f = filter("lowpass", 2400 * Math.max(v, 0.3), 1, g);
      f.frequency.exponentialRampToValueAtTime(220, t + 0.7);
      osc("sawtooth", 220 * p, t, t + 0.9, f);
      osc("square", 220 * p * 1.005, t, t + 0.9, f).connect(f);
    },
    bell(t, v, p) {
      const base = 660 * p;
      [1, 2.76, 5.4].forEach((ratio, i) => {
        const g = env(t, 0.5 / (i + 1) * v, 2e-3, 1.6 - i * 0.4);
        osc("sine", base * ratio, t, t + 1.6, g);
      });
    },
    chime(t, v, p) {
      const base = 1320 * p;
      [1, 1.5, 2, 3.01].forEach((ratio, i) => {
        const g = env(t + i * 0.01, 0.35 / (i + 1) * v, 3e-3, 2.2 - i * 0.3);
        osc("triangle", base * ratio, t + i * 0.01, t + 2.2, g);
      });
    },
    stab(t, v, p) {
      const g = env(t, 0.55 * v, 5e-3, 0.5);
      const f = filter("lowpass", 3200, 2, g);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
      [0, 4, 7].forEach((interval) => {
        osc("sawtooth", 165 * p * semis(interval), t, t + 0.5, f);
        osc("sawtooth", 165 * p * semis(interval) * 1.006, t, t + 0.5, f);
      });
    },
    blip(t, v, p) {
      const g = env(t, 0.6 * v, 1e-3, 0.12);
      osc("square", 880 * p, t, t + 0.12, filter("lowpass", 4e3, 0.7, g));
    },
    zap(t, v, p) {
      const g = env(t, 0.7 * v, 1e-3, 0.3);
      osc("sawtooth", 1800 * p, t, t + 0.3, filter("lowpass", 3500, 1, g), 120 * p, 0.28);
    },
    laser(t, v, p) {
      const g = env(t, 0.6 * v, 1e-3, 0.45);
      osc("square", 2400 * p, t, t + 0.45, filter("bandpass", 1500, 2, g), 60 * p, 0.42);
    },
    sweep(t, v, p) {
      const g = env(t, 0.5 * v, 0.02, 0.7, "lin");
      const f = filter("lowpass", 200, 4, g);
      f.frequency.exponentialRampToValueAtTime(6e3 * Math.max(v, 0.3), t + 0.6);
      osc("sawtooth", 110 * p, t, t + 0.7, f);
    },
    riser(t, v, p) {
      const g = env(t, 0.5 * v, 0.6, 0.6, "lin");
      osc("sawtooth", 110 * p, t, t + 1.2, filter("bandpass", 900, 3, g), 880 * p, 1.1);
      const n = env(t, 0.25 * v, 0.9, 0.3, "lin");
      noise(t, t + 1.2, filter("highpass", 3e3, 0.7, n), "pink");
    },
    noise(t, v) {
      const g = env(t, 0.6 * v, 2e-3, 0.4);
      const f = filter("bandpass", 2500, 0.6, g);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
      noise(t, t + 0.45, f);
    },
    drop(t, v, p) {
      const g = env(t, 0.8 * v, 2e-3, 0.6);
      osc("sine", 900 * p, t, t + 0.6, g, 40 * p, 0.55);
    }
  };
  return {
    output,
    duration: (name) => DURATIONS[name],
    play(name, options = {}) {
      const t = Math.max(options.when ?? ctx.currentTime, ctx.currentTime);
      const v = Math.min(Math.max(options.velocity ?? 1, 0.05), 1);
      const p = semis(options.pitch ?? 0);
      voices[name](t, v, p);
      return DURATIONS[name];
    }
  };
}

// src/synth.ts
function loopSource(ctx, buffer) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  return s;
}
function lfo(ctx, hz, depth, target, offset) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.value = depth;
  osc.connect(g).connect(target);
  if (offset !== void 0) target.value = offset;
  return osc;
}
function repeat(tick, firstDelayMs) {
  let timer;
  let running = false;
  const run = () => {
    if (!running) return;
    const next = tick();
    timer = setTimeout(run, Math.max(10, next));
  };
  return {
    start() {
      if (running) return;
      running = true;
      timer = setTimeout(run, Math.max(0, firstDelayMs));
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = void 0;
      }
    }
  };
}
var midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function epNote(ctx, dest, t, midi, amp, len) {
  const f = midiHz(midi);
  for (const [ratio, a, dec] of [[1, 1, len], [2, 0.35, len * 0.5], [3, 0.08, len * 0.3]]) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(amp * a, t + 0.015);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dec);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dec + 0.05);
  }
}
function bellNote(ctx, dest, t, hz, amp, len, ratios) {
  ratios.forEach((ratio, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = hz * ratio;
    const g = ctx.createGain();
    const a = amp / (i + 1);
    g.gain.setValueAtTime(1e-4, t);
    g.gain.linearRampToValueAtTime(a, t + 4e-3);
    g.gain.exponentialRampToValueAtTime(1e-4, t + len / (1 + i * 0.6));
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.05);
  });
}
var LOFI_PROGRESSIONS = [
  [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]],
  // Am7 Fmaj7 G7 Em7
  [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]],
  // Dm7 G7 Cmaj7 Am7
  [[52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65]]
  // Em7 Am7 Dm7 G7
];
function createSynth(ctx, preset) {
  const output = ctx.createGain();
  output.gain.value = 1;
  const starts = [];
  const stops = [];
  const own = (n) => {
    starts.push(() => n.start());
    stops.push(() => {
      try {
        n.stop();
      } catch {
      }
    });
    return n;
  };
  switch (preset) {
    case "white":
    case "pink":
    case "brown": {
      const src = own(loopSource(ctx, noiseBuffer(ctx, preset)));
      const trim = ctx.createGain();
      trim.gain.value = preset === "white" ? 0.25 : preset === "pink" ? 0.6 : 0.8;
      src.connect(trim).connect(output);
      break;
    }
    case "rain": {
      const body = own(loopSource(ctx, noiseBuffer(ctx, "pink")));
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 500;
      hp.Q.value = 0.7;
      const swell = ctx.createGain();
      swell.gain.value = 0.55;
      own(lfo(ctx, 0.13, 0.12, swell.gain, 0.55));
      body.connect(hp).connect(swell).connect(output);
      const sheen = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3200;
      bp.Q.value = 0.5;
      const sheenGain = ctx.createGain();
      sheenGain.gain.value = 0.16;
      own(lfo(ctx, 0.21, 0.05, sheenGain.gain, 0.16));
      sheen.connect(bp).connect(sheenGain).connect(output);
      break;
    }
    case "wind": {
      const src = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 420;
      bp.Q.value = 1.2;
      own(lfo(ctx, 0.07, 260, bp.frequency, 420));
      const gust = ctx.createGain();
      gust.gain.value = 0.7;
      own(lfo(ctx, 0.11, 0.25, gust.gain, 0.7));
      src.connect(bp).connect(gust).connect(output);
      break;
    }
    case "fire": {
      const rumble = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 520;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.7;
      own(lfo(ctx, 0.17, 0.12, rumbleGain.gain, 0.7));
      rumble.connect(lp).connect(rumbleGain).connect(output);
      const crackleSrc = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      crackleSrc.connect(hp).connect(gate).connect(output);
      let timer;
      const rand = rng(1234);
      const crackle = () => {
        const t = ctx.currentTime;
        const peak = 0.15 + rand() * 0.35;
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(0, t);
        gate.gain.linearRampToValueAtTime(peak, t + 4e-3);
        gate.gain.exponentialRampToValueAtTime(1e-3, t + 0.03 + rand() * 0.05);
        timer = setTimeout(crackle, 40 + rand() * 260);
      };
      starts.push(() => {
        crackle();
      });
      stops.push(() => {
        if (timer) clearTimeout(timer);
      });
      break;
    }
    case "hum": {
      const base = 50;
      const partials = [[1, 0.5], [2, 0.22], [3, 0.1], [4, 0.05]];
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;
      for (const [mult, amp] of partials) {
        const osc = own(ctx.createOscillator());
        osc.type = "sine";
        osc.frequency.value = base * mult;
        const g = ctx.createGain();
        g.gain.value = amp;
        osc.connect(g).connect(lp);
      }
      const wobble = ctx.createGain();
      wobble.gain.value = 0.6;
      own(lfo(ctx, 0.3, 0.08, wobble.gain, 0.6));
      lp.connect(wobble).connect(output);
      break;
    }
    case "ocean": {
      const swell = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      lp.Q.value = 0.8;
      own(lfo(ctx, 0.07, 350, lp.frequency, 700));
      const swellGain = ctx.createGain();
      own(lfo(ctx, 0.07, 0.3, swellGain.gain, 0.45));
      swell.connect(lp).connect(swellGain).connect(output);
      const foam = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2600;
      bp.Q.value = 0.6;
      const foamGain = ctx.createGain();
      own(lfo(ctx, 0.083, 0.07, foamGain.gain, 0.08));
      foam.connect(bp).connect(foamGain).connect(output);
      break;
    }
    case "stream": {
      const babble = own(loopSource(ctx, noiseBuffer(ctx, "pink")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      bp.Q.value = 0.7;
      own(lfo(ctx, 1.3, 260, bp.frequency, 1500));
      const babbleGain = ctx.createGain();
      own(lfo(ctx, 0.9, 0.08, babbleGain.gain, 0.5));
      babble.connect(bp).connect(babbleGain).connect(output);
      const sparkle = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.value = 5200;
      hp.Q.value = 1;
      own(lfo(ctx, 2.1, 900, hp.frequency, 5200));
      const sparkleGain = ctx.createGain();
      sparkleGain.gain.value = 0.09;
      sparkle.connect(hp).connect(sparkleGain).connect(output);
      const body = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 300;
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.25;
      body.connect(lp).connect(bodyGain).connect(output);
      break;
    }
    case "thunder": {
      const src = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 160;
      lp.Q.value = 1.1;
      const floor = ctx.createGain();
      floor.gain.value = 0.12;
      src.connect(lp).connect(floor).connect(output);
      const roll = ctx.createGain();
      roll.gain.value = 0;
      const rollLp = ctx.createBiquadFilter();
      rollLp.type = "lowpass";
      rollLp.frequency.value = 220;
      src.connect(rollLp).connect(roll).connect(output);
      const rand = rng(99);
      const timer = repeat(() => {
        const t = ctx.currentTime;
        const rise = 0.3 + rand() * 0.9, hold = 0.2 + rand() * 0.6, decay = 2 + rand() * 4, peak = 0.5 + rand() * 0.5;
        roll.gain.cancelScheduledValues(t);
        roll.gain.setValueAtTime(1e-4, t);
        roll.gain.linearRampToValueAtTime(peak, t + rise);
        roll.gain.linearRampToValueAtTime(peak * 0.7, t + rise + hold);
        roll.gain.exponentialRampToValueAtTime(1e-4, t + rise + hold + decay);
        rollLp.frequency.cancelScheduledValues(t);
        rollLp.frequency.setValueAtTime(220, t);
        rollLp.frequency.linearRampToValueAtTime(90 + rand() * 60, t + rise + hold + decay);
        return 5e3 + rand() * 14e3;
      }, 1500 + rand() * 2500);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "crickets": {
      const rand = rng(21);
      for (const [hz, pulse, period] of [[4300, 38, 460], [3900, 33, 610]]) {
        const osc = own(ctx.createOscillator());
        osc.type = "sine";
        osc.frequency.value = hz;
        const am = ctx.createGain();
        own(lfo(ctx, pulse, 0.5, am.gain, 0.5));
        const gate = ctx.createGain();
        gate.gain.value = 0;
        const level = ctx.createGain();
        level.gain.value = 0.045;
        osc.connect(am).connect(gate).connect(level).connect(output);
        const timer = repeat(() => {
          const t = ctx.currentTime;
          const len = 0.09 + rand() * 0.08;
          gate.gain.cancelScheduledValues(t);
          gate.gain.setValueAtTime(0, t);
          gate.gain.linearRampToValueAtTime(1, t + 0.012);
          gate.gain.setValueAtTime(1, t + len);
          gate.gain.linearRampToValueAtTime(0, t + len + 0.02);
          return period + (rand() - 0.5) * 120 + (rand() < 0.08 ? 1500 + rand() * 2e3 : 0);
        }, rand() * 400);
        starts.push(timer.start);
        stops.push(timer.stop);
      }
      break;
    }
    case "birds": {
      const rand = rng(7);
      const level = ctx.createGain();
      level.gain.value = 0.16;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1500;
      level.connect(hp).connect(output);
      const note = (t, f0, f1, dur, amp) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1e-4, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
        o.connect(g).connect(level);
        o.start(t);
        o.stop(t + dur + 0.02);
      };
      const timer = repeat(() => {
        let t = ctx.currentTime + 0.05;
        const far = rand() < 0.5, amp = far ? 0.25 : 0.7, base = 1800 + rand() * 2600, count = 1 + Math.floor(rand() * 4);
        for (let i = 0; i < count; i++) {
          const dur = 0.06 + rand() * 0.14;
          note(t, base * (0.9 + rand() * 0.2), base * (0.7 + rand() * 0.8), dur, amp);
          t += dur + 0.03 + rand() * 0.08;
        }
        return 700 + rand() * 2800;
      }, 300);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "frogs": {
      const rand = rng(48);
      const level = ctx.createGain();
      level.gain.value = 0.18;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      level.connect(lp).connect(output);
      const croak = (t, hz, amp) => {
        const pulses = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < pulses; i++) {
          const o = ctx.createOscillator();
          o.type = "square";
          o.frequency.setValueAtTime(hz, t);
          o.frequency.exponentialRampToValueAtTime(hz * 0.8, t + 0.05);
          const g = ctx.createGain();
          g.gain.setValueAtTime(1e-4, t);
          g.gain.linearRampToValueAtTime(amp, t + 8e-3);
          g.gain.exponentialRampToValueAtTime(1e-4, t + 0.05);
          o.connect(g).connect(level);
          o.start(t);
          o.stop(t + 0.06);
          t += 0.06;
        }
      };
      const timer = repeat(() => {
        croak(ctx.currentTime + 0.05, 150 + rand() * 120, rand() < 0.4 ? 0.3 : 0.7);
        return 900 + rand() * 2600;
      }, 400);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "snow": {
      const src = own(loopSource(ctx, noiseBuffer(ctx, "pink")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.9;
      own(lfo(ctx, 0.05, 500, bp.frequency, 900));
      const gust = ctx.createGain();
      own(lfo(ctx, 0.09, 0.3, gust.gain, 0.5));
      src.connect(bp).connect(gust).connect(output);
      const whistle = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const wb = ctx.createBiquadFilter();
      wb.type = "bandpass";
      wb.frequency.value = 2400;
      wb.Q.value = 12;
      own(lfo(ctx, 0.13, 700, wb.frequency, 2400));
      const whistleGain = ctx.createGain();
      own(lfo(ctx, 0.17, 0.05, whistleGain.gain, 0.05));
      whistle.connect(wb).connect(whistleGain).connect(output);
      break;
    }
    case "city": {
      const bed = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      const bedGain = ctx.createGain();
      own(lfo(ctx, 0.09, 0.12, bedGain.gain, 0.45));
      bed.connect(lp).connect(bedGain).connect(output);
      const pass = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 1.1;
      const passGain = ctx.createGain();
      passGain.gain.value = 0;
      pass.connect(bp).connect(passGain).connect(output);
      const rand = rng(3);
      const timer = repeat(() => {
        const t = ctx.currentTime;
        const up = 0.8 + rand() * 1.4, down = 1.2 + rand() * 2, peak = 0.08 + rand() * 0.14;
        passGain.gain.cancelScheduledValues(t);
        passGain.gain.setValueAtTime(1e-4, t);
        passGain.gain.exponentialRampToValueAtTime(peak, t + up);
        passGain.gain.exponentialRampToValueAtTime(1e-4, t + up + down);
        bp.frequency.cancelScheduledValues(t);
        bp.frequency.setValueAtTime(700, t);
        bp.frequency.linearRampToValueAtTime(1300, t + up);
        bp.frequency.linearRampToValueAtTime(600, t + up + down);
        return 2500 + rand() * 7e3;
      }, 800);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "fan": {
      const air = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 380;
      bp.Q.value = 0.7;
      const chop = ctx.createGain();
      own(lfo(ctx, 23, 0.12, chop.gain, 0.6));
      air.connect(bp).connect(chop).connect(output);
      for (const [hz, amp] of [[60, 0.06], [120, 0.03], [180, 0.012]]) {
        const osc = own(ctx.createOscillator());
        osc.type = "sine";
        osc.frequency.value = hz;
        const g = ctx.createGain();
        g.gain.value = amp;
        osc.connect(g).connect(output);
      }
      break;
    }
    case "clock": {
      const src = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3e3;
      bp.Q.value = 4;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const level = ctx.createGain();
      level.gain.value = 0.5;
      src.connect(bp).connect(gate).connect(level).connect(output);
      let tick = false;
      let next = 0;
      const timer = repeat(() => {
        const now = ctx.currentTime;
        next = Math.max(next, now) + (next === 0 ? 0.05 : 0);
        const t = next;
        bp.frequency.setValueAtTime(tick ? 2600 : 3200, t);
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(0, t);
        gate.gain.linearRampToValueAtTime(1, t + 2e-3);
        gate.gain.exponentialRampToValueAtTime(1e-3, t + 0.03);
        tick = !tick;
        next = t + 1;
        return Math.max(50, (next - ctx.currentTime) * 1e3 - 120);
      }, 0);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "vinyl": {
      const hiss = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 3500;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.035;
      hiss.connect(hp).connect(hissGain).connect(output);
      const crackleSrc = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2200;
      bp.Q.value = 1.5;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      crackleSrc.connect(bp).connect(gate).connect(output);
      const rand = rng(77);
      const timer = repeat(() => {
        const t = ctx.currentTime;
        const peak = 0.1 + rand() * 0.4;
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(0, t);
        gate.gain.linearRampToValueAtTime(peak, t + 2e-3);
        gate.gain.exponentialRampToValueAtTime(1e-3, t + 6e-3 + rand() * 0.012);
        return 60 + rand() * 700;
      }, 100);
      starts.push(timer.start);
      stops.push(timer.stop);
      const rumble = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 110;
      const rumbleGain = ctx.createGain();
      own(lfo(ctx, 0.55, 0.03, rumbleGain.gain, 0.07));
      rumble.connect(lp).connect(rumbleGain).connect(output);
      break;
    }
    case "heartbeat": {
      const osc = own(ctx.createOscillator());
      osc.type = "sine";
      osc.frequency.value = 50;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const level = ctx.createGain();
      level.gain.value = 0.9;
      osc.connect(gate).connect(level).connect(output);
      const thump = (t, amp) => {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setValueAtTime(75, t);
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(1e-4, t);
        gate.gain.linearRampToValueAtTime(amp, t + 0.012);
        gate.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
      };
      let next = 0;
      const timer = repeat(() => {
        next = Math.max(next, ctx.currentTime + 0.05);
        thump(next, 1);
        thump(next + 0.2, 0.55);
        next += 1;
        return Math.max(50, (next - ctx.currentTime) * 1e3 - 150);
      }, 0);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "drone": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 360;
      lp.Q.value = 0.9;
      own(lfo(ctx, 0.05, 140, lp.frequency, 360));
      const level = ctx.createGain();
      level.gain.value = 0.22;
      lp.connect(level).connect(output);
      for (const [hz, cents, amp] of [[55, -6, 0.5], [110, 5, 0.35], [110, -9, 0.35], [165, 7, 0.15]]) {
        const osc = own(ctx.createOscillator());
        osc.type = "sawtooth";
        osc.frequency.value = hz;
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = amp;
        osc.connect(g).connect(lp);
      }
      const sub = own(ctx.createOscillator());
      sub.type = "sine";
      sub.frequency.value = 27.5;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.25;
      sub.connect(subGain).connect(output);
      break;
    }
    case "space": {
      const hull = own(loopSource(ctx, noiseBuffer(ctx, "brown")));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 180;
      const hullGain = ctx.createGain();
      own(lfo(ctx, 0.04, 0.1, hullGain.gain, 0.5));
      hull.connect(lp).connect(hullGain).connect(output);
      const tone = own(ctx.createOscillator());
      tone.type = "sine";
      own(lfo(ctx, 0.017, 45, tone.frequency, 130));
      const toneGain = ctx.createGain();
      toneGain.gain.value = 0.06;
      tone.connect(toneGain).connect(output);
      const whistle = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 5e3;
      bp.Q.value = 18;
      own(lfo(ctx, 0.11, 1800, bp.frequency, 5e3));
      const whistleGain = ctx.createGain();
      own(lfo(ctx, 0.23, 0.02, whistleGain.gain, 0.025));
      whistle.connect(bp).connect(whistleGain).connect(output);
      break;
    }
    case "lofi": {
      const rand = rng(2024);
      const bus = ctx.createGain();
      bus.gain.value = 0.9;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      lp.Q.value = 0.5;
      bus.connect(lp).connect(output);
      const chords = ctx.createGain();
      chords.gain.value = 0.28;
      chords.connect(bus);
      const drums = ctx.createGain();
      drums.gain.value = 0.55;
      drums.connect(bus);
      const hits = createHits(ctx, drums);
      const bpm = 72, beat = 60 / bpm, step = beat / 2, swing = step * 0.16;
      const prog = LOFI_PROGRESSIONS[Math.floor(rand() * LOFI_PROGRESSIONS.length)];
      let bar = 0, next = 0;
      const timer = repeat(() => {
        next = Math.max(next, ctx.currentTime + 0.1);
        const t0 = next;
        const chord = prog[Math.floor(bar / 2) % prog.length];
        if (bar % 2 === 0) {
          chord.forEach((m, i) => epNote(ctx, chords, t0 + i * 0.012, m, 0.5, beat * 7.5));
          epNote(ctx, chords, t0, chord[0] - 12, 0.55, beat * 7.5);
        }
        for (let s = 0; s < 8; s++) {
          const t = t0 + s * step + (s % 2 ? swing : 0);
          if (s === 0 || s === 5 && rand() < 0.7 || s === 7 && rand() < 0.25) hits.play("kick", { when: t, velocity: 0.9 });
          if (s === 2 || s === 6) hits.play("snare", { when: t, velocity: 0.55 });
          hits.play("hat", { when: t, velocity: s % 2 ? 0.28 : 0.42 });
          if (s % 4 === 2 && rand() < 0.5) hits.play("shaker", { when: t + step / 2, velocity: 0.25 });
        }
        bar += 1;
        next = t0 + beat * 4;
        return Math.max(50, (next - ctx.currentTime) * 1e3 - 250);
      }, 0);
      starts.push(timer.start);
      stops.push(timer.stop);
      const hiss = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 4e3;
      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.012;
      hiss.connect(hp).connect(hissGain).connect(output);
      const crackleSrc = own(loopSource(ctx, noiseBuffer(ctx, "white")));
      const cbp = ctx.createBiquadFilter();
      cbp.type = "bandpass";
      cbp.frequency.value = 2200;
      cbp.Q.value = 1.5;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      crackleSrc.connect(cbp).connect(gate).connect(output);
      const crackle = repeat(() => {
        const t = ctx.currentTime;
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(0, t);
        gate.gain.linearRampToValueAtTime(0.05 + rand() * 0.2, t + 2e-3);
        gate.gain.exponentialRampToValueAtTime(1e-3, t + 6e-3 + rand() * 0.01);
        return 90 + rand() * 900;
      }, 200);
      starts.push(crackle.start);
      stops.push(crackle.stop);
      break;
    }
    case "pad": {
      const rand = rng(31);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.Q.value = 0.7;
      own(lfo(ctx, 0.04, 350, lp.frequency, 900));
      const level = ctx.createGain();
      level.gain.value = 0.25;
      lp.connect(level).connect(output);
      const prog = LOFI_PROGRESSIONS[1];
      let i = 0, next = 0;
      const timer = repeat(() => {
        next = Math.max(next, ctx.currentTime + 0.1);
        const t = next, chord = prog[i % prog.length];
        chord.forEach((m) => {
          for (const cents of [-7, 6]) {
            const o = ctx.createOscillator();
            o.type = "triangle";
            o.frequency.value = midiHz(m + 12);
            o.detune.value = cents;
            const g = ctx.createGain();
            g.gain.setValueAtTime(1e-4, t);
            g.gain.linearRampToValueAtTime(0.18, t + 4);
            g.gain.setValueAtTime(0.18, t + 12);
            g.gain.linearRampToValueAtTime(1e-4, t + 17);
            o.connect(g).connect(lp);
            o.start(t);
            o.stop(t + 17.1);
          }
        });
        i += 1 + (rand() < 0.2 ? 1 : 0);
        next = t + 16;
        return Math.max(50, (next - ctx.currentTime) * 1e3 - 500);
      }, 0);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "musicbox": {
      const rand = rng(88);
      const level = ctx.createGain();
      level.gain.value = 0.35;
      level.connect(output);
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];
      let degree = 3, next = 0;
      const timer = repeat(() => {
        next = Math.max(next, ctx.currentTime + 0.05);
        const t = next;
        if (rand() < 0.82) {
          degree = Math.max(0, Math.min(scale.length - 1, degree + Math.round((rand() - 0.5) * 3)));
          bellNote(ctx, level, t, midiHz(72 + scale[degree]), 0.45, 1.8, [1, 4.1, 6.9]);
        }
        next = t + 0.45 * (rand() < 0.3 ? 2 : 1);
        return Math.max(30, (next - ctx.currentTime) * 1e3 - 100);
      }, 0);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
    case "bells": {
      const rand = rng(64);
      const level = ctx.createGain();
      level.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      level.connect(lp).connect(output);
      const notes = [220, 261.6, 293.7, 329.6, 392];
      const timer = repeat(() => {
        const t = ctx.currentTime + 0.05;
        bellNote(ctx, level, t, notes[Math.floor(rand() * notes.length)] / (rand() < 0.3 ? 2 : 1), 0.6, 4.5, [1, 2.4, 3.9, 5.2]);
        return 1800 + rand() * 5e3;
      }, 300);
      starts.push(timer.start);
      stops.push(timer.stop);
      break;
    }
  }
  let started = false;
  return {
    output,
    start() {
      if (started) return;
      started = true;
      starts.forEach((f) => f());
    },
    stop() {
      if (!started) return;
      started = false;
      stops.forEach((f) => f());
    }
  };
}

// src/engine.ts
var DEFAULT_UNLOCK = ["pointerdown", "keydown", "touchstart"];
var bufferCache = /* @__PURE__ */ new Map();
var AmbientlyEngine = class {
  constructor(layers = [], options = {}) {
    this.master = null;
    this.reverb = null;
    this.analyser = null;
    this.layers = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Map();
    this.muted = false;
    this.unlockHandler = null;
    this.destroyed = false;
    this.ctx = options.context ?? null;
    this.masterVolume = clamp(options.masterVolume ?? 1);
    this.fadeMs = options.fadeMs ?? 800;
    this.room = { seconds: options.room?.seconds ?? 2.6, decay: options.room?.decay ?? 3 };
    this.unlockEvents = options.unlockOn === void 0 ? DEFAULT_UNLOCK : options.unlockOn;
    layers.forEach((l) => this.add(l));
    if (this.ctx) this.attachContext(this.ctx);
  }
  // ── layers ────────────────────────────────────────────────────────────
  /** Register a layer. Plays immediately if the engine is already playing. */
  add(config) {
    if (!config.id) throw new Error("ambiently: a layer needs an id");
    if (!config.src && !config.synth) throw new Error(`ambiently: layer "${config.id}" needs a src or a synth`);
    const existing = this.layers.get(config.id);
    if (existing) {
      existing.config = { ...existing.config, ...config };
      if (existing.gain && existing.playing) this.ramp(existing.gain.gain, existing.config.volume ?? 0.5, config.fadeMs ?? this.fadeMs);
      if (config.reverb !== void 0) this.applyReverb(existing, config.fadeMs ?? this.fadeMs);
      this.emit("layers");
      return this;
    }
    const layer = { config: { volume: 0.5, loop: true, reverb: 0, ...config }, gain: null, send: null, source: null, synth: null, buffer: null, wanted: false, playing: false, loading: false };
    this.layers.set(config.id, layer);
    if (this.isPlaying()) void this.play(config.id);
    this.emit("layers");
    return this;
  }
  /** Fade a layer out and forget it. */
  remove(id, fadeMs) {
    const layer = this.layers.get(id);
    if (!layer) return this;
    this.pauseLayer(layer, fadeMs);
    this.layers.delete(id);
    this.emit("layers");
    return this;
  }
  /** Replace the whole set of layers, fading out what is gone and fading in what is new. */
  crossfadeTo(layers, fadeMs) {
    const wasPlaying = this.isPlaying();
    const keep = new Set(layers.map((l) => l.id));
    for (const id of Array.from(this.layers.keys())) if (!keep.has(id)) this.remove(id, fadeMs);
    layers.forEach((l) => this.add({ fadeMs, ...l }));
    return wasPlaying ? this.play() : Promise.resolve();
  }
  // ── transport ─────────────────────────────────────────────────────────
  /** Start one layer, or all of them. Resolves once sources are running (or once unlocked). */
  async play(id) {
    const targets = id ? [this.layers.get(id)].filter(Boolean) : Array.from(this.layers.values());
    targets.forEach((l) => {
      l.wanted = true;
    });
    const ctx = this.ensureContext();
    await this.resume(ctx);
    if (this.destroyed) return;
    await Promise.all(targets.map((l) => this.startLayer(l, ctx)));
    this.emit("play");
  }
  /** Fade one layer, or all, to silence and stop the sources. */
  pause(id, fadeMs) {
    const targets = id ? [this.layers.get(id)].filter(Boolean) : Array.from(this.layers.values());
    targets.forEach((l) => this.pauseLayer(l, fadeMs));
    this.emit("pause");
  }
  toggle(id) {
    if (id) {
      const l = this.layers.get(id);
      if (!l) return;
      return l.wanted ? this.pause(id) : this.play(id);
    }
    return this.isPlaying() ? this.pause() : this.play();
  }
  /** Alias of pause() for symmetry with play(). */
  stop() {
    this.pause();
  }
  // ── volume ────────────────────────────────────────────────────────────
  setVolume(id, volume, fadeMs) {
    const layer = this.layers.get(id);
    if (!layer) return this;
    layer.config.volume = clamp(volume);
    if (layer.gain && layer.playing) this.ramp(layer.gain.gain, layer.config.volume, fadeMs ?? layer.config.fadeMs ?? this.fadeMs);
    this.emit("volume");
    return this;
  }
  /** How much of a layer goes to the shared reverb, 0 to 1. */
  setReverb(id, amount, fadeMs) {
    const layer = this.layers.get(id);
    if (!layer) return this;
    layer.config.reverb = clamp(amount);
    this.applyReverb(layer, fadeMs ?? layer.config.fadeMs ?? this.fadeMs);
    this.emit("volume");
    return this;
  }
  setMasterVolume(volume, fadeMs) {
    this.masterVolume = clamp(volume);
    if (this.master && !this.muted) this.ramp(this.master.gain, this.masterVolume, fadeMs ?? this.fadeMs);
    this.emit("volume");
    return this;
  }
  mute(fadeMs) {
    this.muted = true;
    if (this.master) this.ramp(this.master.gain, 0, fadeMs ?? this.fadeMs);
    this.emit("volume");
    return this;
  }
  unmute(fadeMs) {
    this.muted = false;
    if (this.master) this.ramp(this.master.gain, this.masterVolume, fadeMs ?? this.fadeMs);
    this.emit("volume");
    return this;
  }
  // ── introspection ─────────────────────────────────────────────────────
  isPlaying() {
    for (const l of this.layers.values()) if (l.wanted) return true;
    return false;
  }
  getState() {
    const layers = Array.from(this.layers.values()).map((l) => ({
      id: l.config.id,
      type: l.config.synth ? "synth" : "file",
      volume: l.config.volume ?? 0.5,
      reverb: l.config.reverb ?? 0,
      playing: l.wanted,
      loading: l.loading,
      error: l.error
    }));
    return { playing: this.isPlaying(), unlocked: this.ctx?.state === "running", masterVolume: this.masterVolume, muted: this.muted, layers };
  }
  /** An AnalyserNode fed by the master bus, for visualisers. Created on demand. */
  getAnalyser(fftSize = 256) {
    const ctx = this.ensureContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = fftSize;
      this.analyser.smoothingTimeConstant = 0.85;
      this.master.connect(this.analyser);
    }
    return this.analyser;
  }
  /** The underlying AudioContext, created if needed. */
  get context() {
    return this.ensureContext();
  }
  on(event, listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }
  /** Resume the context now (call from inside a user gesture handler if you manage unlocking yourself). */
  async unlock() {
    const ctx = this.ensureContext();
    await this.resume(ctx);
    return ctx.state === "running";
  }
  /** Stop everything, close the context and drop listeners. The instance is unusable afterwards. */
  destroy() {
    this.destroyed = true;
    for (const l of this.layers.values()) this.killLayer(l);
    this.layers.clear();
    this.detachUnlock();
    this.listeners.clear();
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close().catch(() => void 0);
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.analyser = null;
  }
  // ── internals ─────────────────────────────────────────────────────────
  ensureContext() {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") throw new Error("ambiently: AudioContext is only available in the browser");
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) throw new Error("ambiently: Web Audio API is not supported here");
    const ctx = new Ctor();
    this.attachContext(ctx);
    return ctx;
  }
  attachContext(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(ctx.destination);
    if (this.unlockEvents && typeof window !== "undefined") {
      this.unlockHandler = () => {
        void this.resume(ctx);
      };
      this.unlockEvents.forEach((e) => window.addEventListener(e, this.unlockHandler, { passive: true }));
    }
  }
  detachUnlock() {
    if (this.unlockHandler && this.unlockEvents && typeof window !== "undefined") {
      this.unlockEvents.forEach((e) => window.removeEventListener(e, this.unlockHandler));
    }
    this.unlockHandler = null;
  }
  async resume(ctx) {
    if (stateOf(ctx) === "running") return;
    try {
      await ctx.resume();
    } catch {
    }
    if (stateOf(ctx) === "running") {
      this.detachUnlock();
      this.emit("unlock");
      const pending = [];
      for (const l of this.layers.values()) if (l.wanted && !l.playing && !l.loading) pending.push(this.startLayer(l, ctx));
      await Promise.all(pending);
    }
  }
  async loadBuffer(ctx, src) {
    const key = `${src}`;
    let p = bufferCache.get(key);
    if (!p) {
      p = fetch(src).then(async (r) => {
        if (!r.ok) throw new Error(`ambiently: ${r.status} loading ${src}`);
        const data = await r.arrayBuffer();
        return await new Promise((res, rej) => {
          void ctx.decodeAudioData(data, res, rej);
        });
      });
      bufferCache.set(key, p);
      p.catch(() => bufferCache.delete(key));
    }
    return p;
  }
  async startLayer(layer, ctx) {
    if (!layer.wanted || layer.playing || layer.loading || ctx.state !== "running") return;
    if (layer.stopTimer) {
      clearTimeout(layer.stopTimer);
      layer.stopTimer = void 0;
    }
    const target = layer.config.volume ?? 0.5;
    const fade = layer.config.fadeMs ?? this.fadeMs;
    try {
      if (!layer.gain) {
        layer.gain = ctx.createGain();
        layer.gain.gain.value = 0;
        layer.gain.connect(this.master);
      }
      if ((layer.config.reverb ?? 0) > 0 && !layer.send) this.applyReverb(layer, 0);
      if (layer.config.synth) {
        if (!layer.synth) {
          layer.synth = createSynth(ctx, layer.config.synth);
          layer.synth.output.connect(layer.gain);
        }
        layer.synth.start();
      } else {
        layer.loading = true;
        this.emit("load");
        if (!layer.buffer) layer.buffer = await this.loadBuffer(ctx, layer.config.src);
        layer.loading = false;
        if (!layer.wanted || this.destroyed) return;
        const source = ctx.createBufferSource();
        source.buffer = layer.buffer;
        source.loop = layer.config.loop !== false;
        source.playbackRate.value = layer.config.playbackRate ?? 1;
        source.connect(layer.gain);
        source.onended = () => {
          if (layer.source === source && !source.loop) {
            layer.wanted = false;
            layer.playing = false;
            this.emit("pause");
          }
        };
        source.start();
        layer.source = source;
      }
      layer.playing = true;
      layer.error = void 0;
      this.ramp(layer.gain.gain, target, fade);
      this.emit("load");
    } catch (err) {
      layer.loading = false;
      layer.wanted = false;
      layer.error = err instanceof Error ? err.message : String(err);
      this.emit("error");
    }
  }
  pauseLayer(layer, fadeMs) {
    layer.wanted = false;
    if (!layer.gain || !layer.playing) return;
    const fade = fadeMs ?? layer.config.fadeMs ?? this.fadeMs;
    this.ramp(layer.gain.gain, 0, fade);
    if (layer.stopTimer) clearTimeout(layer.stopTimer);
    layer.stopTimer = setTimeout(() => {
      if (layer.wanted) return;
      this.stopSources(layer);
    }, fade + 30);
    layer.playing = false;
  }
  stopSources(layer) {
    if (layer.source) {
      try {
        layer.source.stop();
      } catch {
      }
      layer.source.disconnect();
      layer.source = null;
    }
    if (layer.synth) {
      layer.synth.stop();
      layer.synth.output.disconnect();
      layer.synth = null;
    }
    layer.playing = false;
  }
  killLayer(layer) {
    if (layer.stopTimer) clearTimeout(layer.stopTimer);
    this.stopSources(layer);
    if (layer.send) {
      layer.send.disconnect();
      layer.send = null;
    }
    if (layer.gain) {
      layer.gain.disconnect();
      layer.gain = null;
    }
    layer.wanted = false;
  }
  /** The shared reverb: a convolver fed by a synthetic impulse (decaying noise), built on first use. */
  ensureReverb(ctx) {
    if (this.reverb) return this.reverb;
    const { seconds, decay } = this.room;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let seed = 11 + ch * 17;
      for (let i = 0; i < length; i++) {
        seed ^= seed << 13;
        seed >>>= 0;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        seed >>>= 0;
        const r = seed / 4294967296 * 2 - 1;
        data[i] = r * Math.pow(1 - i / length, decay);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    convolver.connect(this.master);
    this.reverb = convolver;
    return convolver;
  }
  /** Point a layer's send at the shared reverb at its configured amount. Creates the send lazily. */
  applyReverb(layer, fadeMs) {
    const amount = layer.config.reverb ?? 0;
    if (!layer.gain || !this.ctx) return;
    if (!layer.send) {
      if (amount <= 0) return;
      layer.send = this.ctx.createGain();
      layer.send.gain.value = 0;
      layer.gain.connect(layer.send);
      layer.send.connect(this.ensureReverb(this.ctx));
    }
    this.ramp(layer.send.gain, amount, fadeMs);
  }
  ramp(param, target, ms) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(5e-3, ms / 1e3));
  }
  emit(event) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    const state = this.getState();
    set.forEach((l) => l(state));
  }
};
function stateOf(ctx) {
  return ctx.state;
}
function clamp(v) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

// src/types.ts
var SYNTH_PRESETS = [
  "rain",
  "wind",
  "fire",
  "ocean",
  "stream",
  "thunder",
  "crickets",
  "birds",
  "frogs",
  "snow",
  "city",
  "fan",
  "clock",
  "vinyl",
  "heartbeat",
  "hum",
  "drone",
  "space",
  "white",
  "pink",
  "brown",
  "lofi",
  "pad",
  "musicbox",
  "bells"
];

export { AmbientlyEngine, HIT_NAMES, SYNTH_PRESETS, createHits, createSynth, fillNoise, noiseBuffer };
