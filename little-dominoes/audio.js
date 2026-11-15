// Synthesized sound for Little Dominoes. Nothing is recorded or downloaded.
// Each falling domino plays the next note of a five-note scale, so a long fall sounds like a tune running up and down.
const SCALE = [0, 2, 4, 7, 9];
const note = step => 392 * 2 ** ((SCALE[step % 5] + 12 * Math.floor(step / 5)) / 12);

export function createSound() {
  let ctx = null, master = null, noise = null, on = false, lastClick = 0;

  function ready() {
    if (!on) return false;
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      ctx = new Audio();
      const squash = ctx.createDynamicsCompressor();
      master = ctx.createGain(); master.gain.value = .55; master.connect(squash).connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, at = 0, length = .2, type = 'sine', gain = .1, slideTo = 0) {
    if (!ready()) return;
    const t = ctx.currentTime + at, osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(gain, t + .008); amp.gain.exponentialRampToValueAtTime(.0005, t + length);
    osc.connect(amp).connect(master); osc.start(t); osc.stop(t + length + .03);
  }

  function hiss(at, length, gain, from, to, q = 1) {
    if (!ready()) return;
    const t = ctx.currentTime + at, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    source.buffer = noise; source.loop = true;
    filter.type = 'bandpass'; filter.Q.value = q; filter.frequency.setValueAtTime(from, t); filter.frequency.exponentialRampToValueAtTime(to, t + length);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(gain, t + Math.min(.05, length / 3)); amp.gain.exponentialRampToValueAtTime(.0005, t + length);
    source.connect(filter).connect(amp).connect(master); source.start(t); source.stop(t + length + .03);
  }

  const chime = (notes, gap = .08, gain = .08) => notes.forEach((f, i) => tone(f, i * gap, .5, 'sine', gain));

  return {
    get on() { return on; },
    set(value) { on = Boolean(value); if (on) ready(); else if (ctx) ctx.suspend(); if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); },
    wake() { ready(); },
    // One domino knocking the next. `count` is how many have fallen so far.
    click(count) {
      if (!ready() || ctx.currentTime - lastClick < .03) return;
      lastClick = ctx.currentTime;
      const up = count % 30, step = up < 15 ? up : 30 - up;
      tone(note(step), 0, .16, 'triangle', .09);
      hiss(0, .03, .05, 2600, 1800, 2);
    },
    pop(count) { tone(520 + (count % 12) * 45, 0, .07, 'sine', .05, 900 + (count % 12) * 45); },
    thud() { tone(150, 0, .16, 'sine', .14, 70); hiss(0, .08, .05, 500, 200); },
    zip() { tone(220, 0, .55, 'triangle', .07, 1320); hiss(0, .5, .03, 600, 3000); },
    bell() { [0, .42, .84].forEach((at, i) => { tone(1318, at, 1.4, 'sine', .12 / (i + 1)); tone(1976, at, .9, 'sine', .05 / (i + 1)); tone(2637, at, .5, 'sine', .03 / (i + 1)); }); },
    launch() { hiss(0, 2.2, .16, 300, 2400, .6); tone(90, 0, 2, 'sawtooth', .06, 520); },
    boom() { hiss(0, .5, .16, 900, 150, .5); chime([1568, 2093, 2637, 3136, 2637, 3520], .07, .05); },
    party() { hiss(0, .12, .14, 1800, 500, .8); chime([523, 659, 784, 1047, 1319], .09); },
    cheer() { chime([523, 659, 784, 1047], .1, .07); },
    say(text) {
      if (!on || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const words = new SpeechSynthesisUtterance(text); words.rate = .95; words.pitch = 1.15;
      speechSynthesis.speak(words);
    },
    close() { if ('speechSynthesis' in window) speechSynthesis.cancel(); if (ctx) ctx.suspend(); }
  };
}
