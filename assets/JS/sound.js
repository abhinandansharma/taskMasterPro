/* Focus sound: a small wrapper around the ambiently engine (our own npm package).
   The engine is imported on first use so the page pays nothing until a sound is picked.
   Sounds are synthesised, so there is no audio to download. */
const SOUNDS = {
    rain:     [{ id: 'rain', synth: 'rain', volume: 0.75 }],
    fire:     [{ id: 'fire', synth: 'fire', volume: 0.7 }],
    ocean:    [{ id: 'ocean', synth: 'ocean', volume: 0.7 }],
    wind:     [{ id: 'wind', synth: 'wind', volume: 0.6 }],
    night:    [{ id: 'crickets', synth: 'crickets', volume: 0.55 }, { id: 'wind', synth: 'wind', volume: 0.2 }],
    brown:    [{ id: 'brown', synth: 'brown', volume: 0.6 }],
    lofi:     [{ id: 'lofi', synth: 'lofi', volume: 0.8 }, { id: 'vinyl', synth: 'vinyl', volume: 0.25 }],
    rainlofi: [{ id: 'lofi', synth: 'lofi', volume: 0.7 }, { id: 'rain', synth: 'rain', volume: 0.45 }],
    pad:      [{ id: 'pad', synth: 'pad', volume: 0.6, reverb: 0.5 }],
};
const PREVIEW_MS = 3500;

let engine = null;
let loaded = null;      // which SOUNDS key the engine currently holds
let current = 'off';
let volume = 0.6;
let running = false;    // is the focus timer running
let previewTimer = null;

async function get() {
    if (!engine) {
        const { AmbientlyEngine } = await import('./lib/ambiently-1.0.0.js');
        engine = new AmbientlyEngine([], { masterVolume: volume, fadeMs: 900 });
    }
    return engine;
}

async function ensure() {
    const e = await get();
    if (loaded !== current) { await e.crossfadeTo(SOUNDS[current] || []); loaded = current; }
    return e;
}

function clearPreview() { if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; } }

window.TMSound = {
    ids: Object.keys(SOUNDS),
    get current() { return current; },
    get volume() { return volume; },
    /** Pick a sound. Plays for real while the timer runs, otherwise a short preview. */
    async select(id, { preview = true } = {}) {
        current = SOUNDS[id] ? id : 'off';
        clearPreview();
        if (current === 'off') { if (engine) engine.pause(); return; }
        const e = await ensure();
        if (running) { await e.play(); return; }
        if (!preview) return;
        await e.play();
        previewTimer = setTimeout(() => { if (!running && engine) engine.pause(); }, PREVIEW_MS);
    },
    setVolume(v) {
        volume = Math.max(0, Math.min(1, Number(v) || 0));
        if (engine) engine.setMasterVolume(volume);
    },
    /** Called by the timer: true while a focus session is counting down. */
    async setRunning(isRunning) {
        running = !!isRunning;
        if (current === 'off') return;
        clearPreview();
        if (running) { const e = await ensure(); await e.play(); }
        else if (engine) engine.pause();
    },
    stop() { clearPreview(); if (engine) engine.pause(); },
};
