/* Background sound: a small wrapper around the ambiently engine (our own npm package).
   Pick a sound and it plays until you pick Off; the timer does not interfere.
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

let engine = null;
let current = 'off';
let volume = 0.6;

async function get() {
    if (!engine) {
        const { AmbientlyEngine } = await import('./lib/ambiently-1.0.0.js');
        engine = new AmbientlyEngine([], { masterVolume: volume, fadeMs: 900 });
    }
    return engine;
}

window.TMSound = {
    ids: Object.keys(SOUNDS),
    get current() { return current; },
    get volume() { return volume; },
    get playing() { return !!engine && engine.isPlaying(); },
    /** Pick a sound; it plays until 'off' is picked. */
    async select(id) {
        current = SOUNDS[id] ? id : 'off';
        if (current === 'off') { if (engine) engine.pause(); return; }
        const e = await get();
        await e.crossfadeTo(SOUNDS[current]);
        await e.play();
    },
    setVolume(v) {
        volume = Math.max(0, Math.min(1, Number(v) || 0));
        if (engine) engine.setMasterVolume(volume);
    },
    stop() { current = 'off'; if (engine) engine.pause(); },
};
