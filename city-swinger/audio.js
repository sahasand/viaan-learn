// City Swinger's sound, all synthesized: a bouncy hero tune and an effect for everything
// the hero does. Nothing plays until `set(true)` is called from a tap.
const TUNE = [72, 0, 76, 79, 0, 76, 72, 0, 74, 0, 77, 81, 0, 77, 74, 0, 76, 0, 79, 84, 0, 79, 76, 0, 79, 77, 76, 74, 72, 0, 67, 0];
const BASS = [48, 48, 53, 53, 55, 55, 48, 43];
const CLIMB = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const hz = note => 440 * 2 ** ((note - 69) / 12);

export function createSound() {
  let ctx = null, master = null, music = null, on = false, playing = false, step = 0, nextTime = 0, slow = 1, timer = 0;
  const now = () => ctx.currentTime;
  function note(freq, at, length, type = 'triangle', volume = .12, out = master, slideTo = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + length);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(volume, at + .012); g.gain.exponentialRampToValueAtTime(.0008, at + length);
    o.connect(g).connect(out); o.start(at); o.stop(at + length + .03);
  }
  function hiss(at, length, freq, volume = .08) {
    const size = Math.floor(ctx.sampleRate * length), buffer = ctx.createBuffer(1, size, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = buffer; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = volume;
    s.connect(f).connect(g).connect(master); s.start(at);
  }
  // The tune is scheduled a little ahead of time so it stays even when the page is busy.
  function schedule() {
    if (!on || !playing) return;
    const beat = .2 * slow;
    while (nextTime < now() + .25) {
      const n = TUNE[step % TUNE.length];
      if (n) note(hz(n), nextTime, beat * 1.6, 'triangle', .07, music);
      if (step % 4 === 0) note(hz(BASS[(step / 4) % BASS.length]), nextTime, beat * 3, 'sine', .11, music);
      if (step % 2 === 1) hiss(nextTime, .04, 6500, .012);
      step++; nextTime += beat;
    }
  }
  const ready = () => on && ctx;
  return {
    get on() { return on; },
    // Must be called from a tap or key press so the browser allows sound.
    async set(want) {
      if (want && !ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.connect(ctx.destination);
        master = ctx.createGain(); master.gain.value = 1.5; master.connect(limiter); music = ctx.createGain(); music.gain.value = .8; music.connect(master);
        timer = setInterval(schedule, 80);
      }
      on = want; if (ctx) { if (on) await ctx.resume(); else await ctx.suspend(); nextTime = now() + .05; }
      return on;
    },
    // The tune plays while a mission is being flown, slower at night.
    play(flying, theme = 'day') { playing = flying; slow = theme === 'night' ? 1.18 : theme === 'sunset' ? 1.08 : 1; if (ctx) nextTime = Math.max(nextTime, now() + .05); },
    throwRope() { if (ready()) { note(500, now(), .16, 'sawtooth', .06, master, 1500); hiss(now(), .12, 3200, .06); } },
    letGo() { if (ready()) note(900, now(), .12, 'sine', .05, master, 520); },
    land() { if (ready()) { note(150, now(), .1, 'sine', .14, master, 80); hiss(now(), .06, 900, .05); } },
    stick() { if (ready()) { note(320, now(), .07, 'square', .05); note(420, now() + .06, .07, 'square', .05); } },
    bounce() { if (ready()) note(180, now(), .32, 'sine', .16, master, 720); },
    leap() { if (ready()) note(380, now(), .18, 'triangle', .07, master, 640); },
    star(run = 0) { if (ready()) { const n = 76 + CLIMB[Math.min(run, CLIMB.length - 1)]; note(hz(n), now(), .22, 'triangle', .11); note(hz(n + 12), now() + .03, .18, 'sine', .05); } },
    bigStar() { if (ready()) [84, 88, 91, 96].forEach((n, i) => note(hz(n), now() + i * .06, .3, 'triangle', .1)); },
    friend() { if (ready()) [72, 76, 79, 84, 88].forEach((n, i) => note(hz(n), now() + i * .08, .34, 'triangle', .12)); },
    finish() { if (ready()) { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => note(hz(n), now() + i * .09, .5, 'triangle', .12)); for (let i = 0; i < 6; i++) hiss(now() + .5 + i * .16, .2, 2500 + i * 500, .05); } },
    tap() { if (ready()) note(660, now(), .06, 'sine', .07); },
    stop() { clearInterval(timer); }
  };
}
