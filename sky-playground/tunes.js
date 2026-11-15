// Synthesized sound for Little Pilot: a propeller engine, wind, effects and a music box
// with a song for each island. It shares the game's AudioContext; nothing is recorded
// or downloaded.
const pitch = note => 440 * 2 ** ((note - 69) / 12);
// Each song is four chords (MIDI notes) and two eight-bar-long tunes over them, eight
// steps to a bar, 0 for a rest. `root` is where the star notes start so they stay in key.
const SONGS = {
  sunny: { bpm: 116, root: 72, voice: 'triangle', ring: .3, drums: 'bounce', chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], tunes: [
    [76, 0, 79, 0, 84, 0, 79, 76, 77, 0, 81, 0, 84, 0, 81, 0, 79, 0, 83, 0, 86, 0, 83, 79, 84, 0, 79, 0, 76, 0, 72, 0],
    [72, 74, 76, 0, 79, 0, 76, 0, 77, 0, 81, 79, 77, 0, 76, 0, 74, 0, 79, 0, 83, 81, 79, 0, 84, 0, 0, 79, 84, 0, 0, 0]] },
  snowy: { bpm: 104, root: 74, voice: 'sine', ring: .55, drums: 'sleigh', chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], tunes: [
    [78, 0, 81, 0, 86, 0, 81, 0, 78, 0, 83, 0, 86, 0, 83, 0, 79, 0, 83, 0, 86, 0, 83, 79, 81, 0, 85, 0, 88, 0, 85, 0],
    [86, 85, 83, 0, 81, 0, 78, 0, 83, 0, 81, 0, 78, 0, 74, 0, 79, 0, 81, 83, 0, 81, 79, 0, 81, 0, 0, 76, 81, 0, 0, 0]] },
  jungle: { bpm: 126, root: 72, voice: 'triangle', ring: .22, drums: 'conga', chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], tunes: [
    [81, 0, 84, 81, 0, 79, 81, 0, 77, 0, 81, 77, 0, 76, 77, 0, 79, 0, 84, 79, 0, 76, 79, 0, 79, 0, 83, 86, 0, 83, 79, 0],
    [88, 0, 84, 0, 81, 0, 84, 0, 84, 0, 81, 0, 77, 0, 81, 0, 84, 0, 79, 0, 76, 0, 79, 0, 86, 83, 79, 0, 83, 0, 0, 0]] }
};
const ARP = [0, 1, 2, 1, 2, 1, 0, 1];
// Star notes climb this scale as a run of stars grows.
const CLIMB = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function createTunes(ctx) {
  const node = (make, set) => { const n = make(); set?.(n); return n; };
  const gain = (value, out) => { const g = ctx.createGain(); g.gain.value = value; if (out) g.connect(out); return g; };
  // Everything is turned up and then held under a limiter, so it carries on a phone speaker without crackling.
  const limiter = node(() => ctx.createDynamicsCompressor(), c => { c.threshold.value = -16; c.knee.value = 12; c.ratio.value = 6; c.attack.value = .004; c.release.value = .2; c.connect(ctx.destination); });
  const LOUD = 1.7, master = gain(0, limiter), musicBus = gain(.5, master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  let awake = false, calm = true, song = SONGS.sunny, step = 0, nextTime = 0, tempo = 1;

  // The propeller: two buzzing notes an octave apart, softened, then chopped by the blades.
  const engineGain = gain(0, master), chop = gain(.6, engineGain);
  const engineFilter = node(() => ctx.createBiquadFilter(), f => { f.type = 'lowpass'; f.frequency.value = 420; f.connect(chop); });
  const engineA = node(() => ctx.createOscillator(), o => { o.type = 'sawtooth'; o.frequency.value = 62; o.connect(engineFilter); o.start(); });
  const engineB = node(() => ctx.createOscillator(), o => { o.type = 'square'; o.frequency.value = 124; o.connect(gain(.4, engineFilter)); o.start(); });
  const blades = node(() => ctx.createOscillator(), o => { o.type = 'sine'; o.frequency.value = 22; o.connect(gain(.38, chop.gain)); o.start(); });
  // Wind grows with speed.
  const windGain = gain(0, master);
  const windFilter = node(() => ctx.createBiquadFilter(), f => { f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = .7; f.connect(windGain); });
  node(() => ctx.createBufferSource(), s => { s.buffer = noise; s.loop = true; s.connect(windFilter); s.start(); });

  function note(frequency, at, seconds, type, volume, out = master, slideTo = 0) {
    const oscillator = ctx.createOscillator(), level = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(volume, at + .012);
    level.gain.exponentialRampToValueAtTime(.001, at + seconds);
    oscillator.connect(level).connect(out); oscillator.start(at); oscillator.stop(at + seconds + .05);
  }
  function puff(at, seconds, kind, frequency, volume, out = master, slideTo = 0) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), level = ctx.createGain();
    source.buffer = noise; filter.type = kind; filter.frequency.setValueAtTime(frequency, at);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    level.gain.setValueAtTime(0, at); level.gain.linearRampToValueAtTime(volume, at + .01);
    level.gain.exponentialRampToValueAtTime(.001, at + seconds);
    source.connect(filter).connect(level).connect(out); source.start(at, Math.random() * .5, seconds + .05);
  }
  // Twelve bars go round: four of backing alone, then each tune in turn.
  function playStep(index, at) {
    const beat = index % 8, chord = song.chords[Math.floor(index / 8) % 4], part = Math.floor(index / 32);
    if (beat === 0 || beat === 4) note(pitch(chord[0] - 24), at, .3, 'triangle', .1, musicBus);
    if (beat === 3 || beat === 7) note(pitch(chord[beat === 3 ? 0 : 2] - 12), at, .14, 'triangle', .045, musicBus);
    note(pitch(chord[ARP[beat]] + 12), at, .17, 'triangle', calm ? .04 : .03, musicBus);
    const lead = part ? song.tunes[part - 1][index % 32] : 0;
    if (lead) { note(pitch(lead), at, song.ring, song.voice, .05, musicBus); note(pitch(lead + 12), at, song.ring * .5, 'sine', .012, musicBus); }
    if (calm) return;                                     // the airport plays the song without its drums
    if (song.drums === 'sleigh') {
      if (beat === 0) note(120, at, .16, 'sine', .11, musicBus, 45);
      puff(at, .05, 'highpass', 9000, beat % 2 ? .012 : .024, musicBus);
      return;
    }
    const kicks = song.drums === 'conga' ? [0, 3, 4] : [0, 4];
    if (kicks.includes(beat)) note(130, at, .14, 'sine', .13, musicBus, 45);
    if (beat === 2 || beat === 6) puff(at, .09, 'bandpass', 1800, .035, musicBus);
    if (beat % 2) puff(at, .03, 'highpass', 7000, .018, musicBus);
    if (song.drums === 'conga' && (beat === 5 || beat === 7)) note(beat === 5 ? 330 : 250, at, .12, 'sine', .06, musicBus, beat === 5 ? 240 : 180);
  }
  const timer = setInterval(() => {
    if (!awake) { nextTime = 0; return; }
    if (!nextTime || nextTime < ctx.currentTime - .2) nextTime = ctx.currentTime + .08;
    while (nextTime < ctx.currentTime + .25) { playStep(step, nextTime); nextTime += 30 / (song.bpm * tempo); step = (step + 1) % 96; }
  }, 60);
  const now = () => ctx.currentTime;
  const run = (notes, gap = .09, seconds = .35, volume = .08, type = 'sine') => notes.forEach((f, i) => note(f, now() + i * gap, seconds, type, volume));

  return {
    out: limiter,
    // The game says when sound may play (sound on, on screen) and whether it is at the airport.
    awake(flag) { awake = flag; master.gain.setTargetAtTime(flag ? LOUD : 0, now(), .08); },
    calm(flag) { calm = flag; musicBus.gain.setTargetAtTime(flag ? .36 : .5, now(), .3); },
    music(id) { const next = SONGS[id] || SONGS.sunny; if (next !== song) { song = next; step = 0; nextTime = 0; } },
    hurry(flag) { tempo = flag ? 1.12 : 1; },
    engine(speed, climb, running, boosting) {
      const f = 46 + speed * 2.3 + climb * 7, t = now();
      engineGain.gain.setTargetAtTime(running ? .05 : 0, t, .15);
      engineA.frequency.setTargetAtTime(f, t, .1); engineB.frequency.setTargetAtTime(f * 2.01, t, .1);
      blades.frequency.setTargetAtTime(13 + speed * 1.1, t, .1);
      engineFilter.frequency.setTargetAtTime(380 + speed * 30, t, .12);
      windGain.gain.setTargetAtTime(running ? .004 + speed * .0011 + (boosting ? .03 : 0) : 0, t, .2);
      windFilter.frequency.setTargetAtTime(500 + speed * 45, t, .2);
    },
    // Each star in a run plays the next note up, with a little twinkle above it.
    star(streak = 0) {
      if (!awake) return;
      const n = song.root + CLIMB[Math.min(streak, CLIMB.length - 1)];
      note(pitch(n), now(), .22, 'sine', .075); note(pitch(n + 12), now() + .05, .16, 'sine', .03);
    },
    bigStar() {
      if (!awake) return;
      run([0, 4, 7, 12, 16, 19, 24].map(n => pitch(song.root + n)), .055, .4, .07);
      puff(now(), .5, 'highpass', 6000, .03);
    },
    pop() { if (awake) { puff(now(), .09, 'bandpass', 1400, .16); note(520, now(), .12, 'sine', .07, master, 180); note(1200, now() + .08, .12, 'sine', .04); } },
    whoosh() { if (awake) { puff(now(), .7, 'bandpass', 500, .09, master, 3400); run([784, 988, 1319], .07, .3, .06); } },
    trick() { if (awake) { note(330, now(), .5, 'sine', .08, master, 1320); note(1320, now() + .5, .35, 'sine', .06, master, 660); } },
    poof() { if (awake) { puff(now(), .35, 'lowpass', 900, .08); run([988, 1319], .08, .2, .04); } },
    cheer() {
      if (!awake) return;
      for (let i = 0; i < 4; i++) puff(now() + i * .32, .5, 'bandpass', 1100 + i * 180, .05);
      run([0, 4, 7, 12].map(n => pitch(song.root - 12 + n)), .13, .5, .08, 'triangle');
    },
    chime(win = false) { if (awake) run(win ? [523, 659, 784, 1047] : [659, 880], .1, .35, .09); },
    unlock() { if (awake) { run([523, 659, 784, 1047, 1319], .07, .4, .08, 'triangle'); puff(now() + .3, .4, 'highpass', 6500, .025); } },
    tap() { if (awake) note(880, now(), .06, 'sine', .05); },
    // The suitcase lands in the hold.
    thump() { if (awake) { note(110, now(), .2, 'triangle', .16, master, 55); puff(now(), .12, 'lowpass', 350, .1); } },
    // Each passenger says hello in their own voice.
    hello(animal) {
      if (!awake) return;
      const t = now();
      if (animal === 'penguin') for (const d of [0, .16]) { note(680, t + d, .12, 'sawtooth', .05, master, 500); note(340, t + d, .12, 'square', .03, master, 250); }
      else if (animal === 'frog') { for (const d of [0, .11]) note(170, t + d, .08, 'square', .07, master, 110); note(230, t + .26, .18, 'square', .06, master, 320); }
      else { note(420, t, .2, 'sine', .1, master, 580); note(580, t + .18, .24, 'sine', .09, master, 400); }
    },
    // The cabin's two-note "ding dong" before takeoff.
    ding() { if (awake) { note(988, now(), .9, 'sine', .08); note(784, now() + .32, 1.1, 'sine', .08); } },
    touchdown() {
      if (!awake) return;
      for (const d of [0, .09]) puff(now() + d, .1, 'bandpass', 2600, .07);
      note(95, now(), .22, 'triangle', .14); puff(now(), .14, 'lowpass', 400, .08);
    },
    // A zoom has just filled up.
    ready() { if (awake) run([784, 1175], .08, .22, .06, 'triangle'); },
    toy(id) {
      if (!awake) return;
      const t = now();
      if (id === 'confetti') { note(300, t, .28, 'sawtooth', .05, master, 900); puff(t, .3, 'highpass', 5000, .05); run([1047, 1319, 1568], .06, .2, .05); }
      else if (id === 'fireworks') for (let i = 0; i < 3; i++) note(500, t + i * .22, .6, 'sine', .04, master, 1900);
      else if (id === 'presents') note(1400, t, .7, 'sine', .05, master, 500);
      else for (const d of [0, .2]) { note(349, t + d, .15, 'square', .05); note(440, t + d, .15, 'square', .05); }
    },
    boom() { if (awake) { note(95, now(), .45, 'sine', .22, master, 38); puff(now(), .45, 'lowpass', 800, .16); puff(now() + .08, .6, 'highpass', 4500, .035); } },
    splash() { if (awake) puff(now(), .35, 'bandpass', 1800, .12, master, 500); },
    close() { clearInterval(timer); }
  };
}
