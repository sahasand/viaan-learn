// Synthesized sound for Little Racer: engine, effects and a small music box.
// Nothing is recorded or downloaded; everything is built from oscillators and noise.
const pitch = note => 440 * 2 ** ((note - 69) / 12);
// Each song is four chords (MIDI notes) looped at its own speed.
const SONGS = {
  beach: { bpm: 124, chords: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]] },
  snow: { bpm: 110, chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]] },
  jungle: { bpm: 134, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]] },
  galaxy: { bpm: 128, chords: [[64, 68, 71], [61, 64, 68], [57, 61, 64], [59, 63, 66]] }
};
const ARP = [0, 1, 2, 1, 2, 1, 0, 1], LEAD = [[0, 2], [3, 1], [6, 0]];

export function createSound() {
  let ctx, master, musicBus, engineGain, engineA, engineB, engineFilter, squeal, noise;
  let on = false, awake = true, song = null, step = 0, nextTime = 0, timer = 0, tempo = 1;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineA = ctx.createOscillator(); engineA.type = 'sawtooth'; engineB = ctx.createOscillator(); engineB.type = 'square';
    engineA.connect(engineFilter); engineB.connect(engineFilter); engineFilter.connect(engineGain).connect(master);
    engineA.start(); engineB.start();
    // Tyre squeal for drifting: looping noise through a narrow filter.
    const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 2100; band.Q.value = 7;
    squeal = ctx.createGain(); squeal.gain.value = 0; source.connect(band).connect(squeal).connect(master); source.start();
    timer = setInterval(schedule, 60);
  }
  function note(frequency, at, seconds, type, volume, out = master, slideTo = 0) {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .012);
    gain.gain.exponentialRampToValueAtTime(.001, at + seconds);
    oscillator.connect(gain).connect(out); oscillator.start(at); oscillator.stop(at + seconds + .05);
  }
  function puff(at, seconds, kind, frequency, volume, out = master, slideTo = 0) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; filter.type = kind; filter.frequency.setValueAtTime(frequency, at);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .01);
    gain.gain.exponentialRampToValueAtTime(.001, at + seconds);
    source.connect(filter).connect(gain).connect(out); source.start(at, Math.random() * .5, seconds + .05);
  }
  function playStep(index, at) {
    const bar = Math.floor(index / 8) % 4, beat = index % 8, chord = song.chords[bar];
    if (beat === 0 || beat === 4) { note(pitch(chord[0] - 24), at, .3, 'triangle', .1, musicBus); note(130, at, .14, 'sine', .14, musicBus, 45); }
    if (beat === 3 || beat === 7) note(pitch(chord[0] - 12), at, .14, 'triangle', .05, musicBus);
    note(pitch(chord[ARP[beat]] + 12), at, .17, 'triangle', .035, musicBus);
    if (index >= 32) for (const [when, tone] of LEAD) if (beat === when) note(pitch(chord[tone] + 24), at, .34, 'sine', .045, musicBus);
    if (beat % 2) puff(at, .03, 'highpass', 7000, .02, musicBus);
    if (beat === 2 || beat === 6) puff(at, .09, 'bandpass', 1800, .04, musicBus);
  }
  function schedule() {
    if (!on || !awake || !song) { nextTime = 0; return; }
    if (!nextTime || nextTime < ctx.currentTime - .2) nextTime = ctx.currentTime + .08;
    while (nextTime < ctx.currentTime + .25) {
      playStep(step, nextTime);
      nextTime += 30 / (song.bpm * tempo); step = (step + 1) % 64;
    }
  }
  const level = () => { if (master) master.gain.setTargetAtTime(on && awake ? 1 : 0, ctx.currentTime, .08); };
  const ready = () => on && awake && ctx;

  return {
    get on() { return on; },
    // Must be called from a tap or key press so the browser allows sound.
    async toggle() {
      if (!ctx) build();
      await ctx.resume(); on = !on; level();
      if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
      return on;
    },
    // Pausing the game silences everything without losing the song position.
    awake(flag) { awake = flag; level(); },
    music(id) { if (song !== SONGS[id]) { song = SONGS[id] || null; step = 0; nextTime = 0; } tempo = 1; },
    hurry(flag) { tempo = flag ? 1.1 : 1; },
    engine(speed, running) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(running ? .03 : 0, ctx.currentTime, .12);
      const f = 50 + speed * 4.2;
      engineA.frequency.setTargetAtTime(f, ctx.currentTime, .06); engineB.frequency.setTargetAtTime(f * 1.5, ctx.currentTime, .06);
      engineFilter.frequency.setTargetAtTime(380 + speed * 22, ctx.currentTime, .1);
    },
    squeal(flag) { if (ctx) squeal.gain.setTargetAtTime(flag && ready() ? .028 : 0, ctx.currentTime, .06); },
    tone(frequency, delay = 0, seconds = .3, type = 'sine', volume = .09, slideTo = 0) { if (ready()) note(frequency, ctx.currentTime + delay, seconds, type, volume, master, slideTo); },
    chime(notes, gap = .09) { if (ready()) notes.forEach((f, i) => note(f, ctx.currentTime + i * gap, .35, 'sine', .09)); },
    horn() { if (ready()) { note(392, ctx.currentTime, .42, 'square', .035); note(494, ctx.currentTime, .42, 'square', .035); } },
    // Two happy barks: a quick falling yelp with a little breath of noise, twice.
    woof(volume = .3) {
      if (!ready()) return;
      for (const delay of [0, .17]) { note(520, ctx.currentTime + delay, .11, 'sawtooth', volume * .22, master, 250); note(260, ctx.currentTime + delay, .12, 'square', volume * .1, master, 150); puff(ctx.currentTime + delay, .08, 'bandpass', 1100, volume * .3); }
    },
    coin() { if (ready()) { note(1568, ctx.currentTime, .1, 'sine', .05); note(2093, ctx.currentTime + .06, .16, 'sine', .05); } },
    whoosh() { if (ready()) puff(ctx.currentTime, .6, 'bandpass', 500, .09, master, 3200); },
    thud() { if (ready()) { note(95, ctx.currentTime, .22, 'triangle', .15); puff(ctx.currentTime, .12, 'lowpass', 400, .08); } },
    cheer() { if (ready()) for (let i = 0; i < 4; i++) puff(ctx.currentTime + i * .32, .5, 'bandpass', 1100 + i * 180, .05); },
    say(text) {
      if (!on || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = .9; utterance.pitch = 1.1; utterance.volume = .85;
      speechSynthesis.speak(utterance);
    },
    close() { clearInterval(timer); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  };
}
