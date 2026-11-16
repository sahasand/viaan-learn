// Synthesized sound for Number Playground: a bouncy tune and the game's effects.
// Nothing is recorded or downloaded here; spoken numbers are played by game.js.
const pitch = note => 440 * 2 ** ((note - 69) / 12);
const CHORDS = [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]];
const TUNE = [72, 0, 76, 79, 0, 76, 72, 0, 69, 0, 72, 76, 0, 72, 69, 0, 77, 0, 81, 84, 0, 81, 77, 0, 79, 0, 83, 86, 83, 79, 0, 0];

export function createSound() {
  let ctx, master, music, noise, on = false, awake = true, step = 0, nextTime = 0;
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -16; limiter.ratio.value = 6; limiter.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0; master.connect(limiter);
    music = ctx.createGain(); music.gain.value = .3; music.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    setInterval(() => {
      if (!on || !awake) { nextTime = 0; return; }
      if (!nextTime || nextTime < ctx.currentTime - .2) nextTime = ctx.currentTime + .08;
      while (nextTime < ctx.currentTime + .25) { playStep(step, nextTime); nextTime += 30 / 108; step = (step + 1) % 64; }
    }, 60);
  }
  function note(frequency, at, seconds, type, volume, out = master, slideTo = 0) {
    const oscillator = ctx.createOscillator(), level = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(volume, at + .012);
    level.gain.exponentialRampToValueAtTime(.001, at + seconds);
    oscillator.connect(level).connect(out); oscillator.start(at); oscillator.stop(at + seconds + .05);
  }
  function puff(at, seconds, kind, frequency, volume, out = master) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), level = ctx.createGain();
    source.buffer = noise; filter.type = kind; filter.frequency.value = frequency;
    level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(volume, at + .01);
    level.gain.exponentialRampToValueAtTime(.001, at + seconds);
    source.connect(filter).connect(level).connect(out); source.start(at, Math.random() * .5, seconds + .05);
  }
  // Eight bars: the second four add the tune.
  function playStep(index, at) {
    const beat = index % 8, chord = CHORDS[Math.floor(index / 8) % 4];
    if (beat === 0 || beat === 4) note(pitch(chord[0] - 24), at, .3, 'triangle', .12, music);
    if (beat % 2 === 0) note(pitch(chord[beat / 2 % 3] + 12), at, .2, 'triangle', .05, music);
    if (index >= 32 && TUNE[index - 32]) note(pitch(TUNE[index - 32]), at, .26, 'sine', .07, music);
    if (beat === 2 || beat === 6) puff(at, .05, 'highpass', 6000, .02, music);
  }
  const ready = () => on && awake && ctx, now = () => ctx.currentTime;
  const run = (notes, gap = .08, seconds = .3, volume = .1, type = 'sine') => notes.forEach((n, i) => note(pitch(n), now() + i * gap, seconds, type, volume));
  const level = () => { if (master) master.gain.setTargetAtTime(on && awake ? 1.6 : 0, now(), .08); };
  return {
    get on() { return on; },
    // Must be called from a tap or key press so the browser allows sound.
    async set(flag) { if (!ctx) { if (!flag) return; build(); } await ctx.resume(); on = flag; level(); },
    awake(flag) { awake = flag; level(); },
    // A soft pluck that climbs as a count goes up.
    count(n) { if (ready()) note(pitch(72 + [0, 2, 4, 5, 7, 9, 11, 12][n % 8] + 12 * Math.floor(n % 16 / 8)), now(), .16, 'triangle', .1); },
    tap() { if (ready()) note(700, now(), .06, 'sine', .07); },
    pop() { if (ready()) { puff(now(), .08, 'bandpass', 1500, .25); note(600, now(), .12, 'sine', .1, master, 200); } },
    boing() { if (ready()) { note(220, now(), .14, 'sine', .12, master, 130); note(180, now() + .12, .2, 'sine', .08, master, 260); } },
    munch() { if (ready()) { puff(now(), .07, 'lowpass', 900, .2); note(160, now(), .08, 'square', .05, master, 110); } },
    hop() { if (ready()) note(330, now(), .16, 'sine', .11, master, 660); },
    roll() { if (ready()) puff(now(), .7, 'lowpass', 300, .14); },
    crash() { if (ready()) { puff(now(), .35, 'bandpass', 1200, .28); for (let i = 0; i < 4; i++) note(500 + i * 130, now() + i * .04, .12, 'triangle', .07); } },
    yay() { if (ready()) run([72, 76, 79, 84], .07, .3, .1); },
    win() { if (ready()) { run([72, 76, 79, 84, 88, 91], .1, .5, .11, 'triangle'); for (let i = 0; i < 3; i++) puff(now() + i * .3, .4, 'bandpass', 1300 + i * 200, .06); } },
    crack() { if (ready()) { puff(now(), .06, 'highpass', 3000, .22); note(900, now(), .05, 'square', .05); } },
    hatch() { if (ready()) { run([67, 72, 76, 79, 84, 88], .06, .45, .11); puff(now() + .2, .5, 'highpass', 6000, .04); } },
    launch() { if (ready()) { puff(now(), 1.6, 'lowpass', 600, .22); note(120, now(), 1.6, 'sawtooth', .07, master, 900); } }
  };
}
