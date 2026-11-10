// A small synthesized music box and playful effects for Little Pilot.
// It shares the game's AudioContext; nothing is recorded or downloaded.
const pitch = note => 440 * 2 ** ((note - 69) / 12);
// A bright four-chord loop (MIDI notes): C, F, G, C with a skipping melody.
const CHORDS = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
const ARP = [0, 1, 2, 1, 2, 1, 0, 1], LEAD = [[0, 2], [2, 1], [4, 2], [6, 0]];

export function createTunes(ctx) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  let awake = false, step = 0, nextTime = 0;

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
    const bar = Math.floor(index / 8) % 4, beat = index % 8, chord = CHORDS[bar];
    if (beat === 0 || beat === 4) note(pitch(chord[0] - 24), at, .32, 'triangle', .09, musicBus);
    if (beat === 6) note(pitch(chord[2] - 24), at, .2, 'triangle', .06, musicBus);
    note(pitch(chord[ARP[beat]] + 12), at, .18, 'triangle', .03, musicBus);
    if (index >= 32) for (const [when, tone] of LEAD) if (beat === when) note(pitch(chord[tone] + 24), at, .3, 'sine', .04, musicBus);
    if (beat % 2) puff(at, .03, 'highpass', 7000, .014, musicBus);
  }
  const timer = setInterval(() => {
    if (!awake) { nextTime = 0; return; }
    if (!nextTime || nextTime < ctx.currentTime - .2) nextTime = ctx.currentTime + .08;
    while (nextTime < ctx.currentTime + .25) { playStep(step, nextTime); nextTime += 30 / 112; step = (step + 1) % 64; }
  }, 60);

  return {
    // The game says when music and effects may play (sound on, not paused).
    awake(flag) { awake = flag; master.gain.setTargetAtTime(flag ? 1 : 0, ctx.currentTime, .08); },
    star(streak = 0) { if (awake) note(pitch(84 + Math.min(streak, 7) * 2), ctx.currentTime, .16, 'sine', .06); },
    pop() { if (awake) { puff(ctx.currentTime, .09, 'bandpass', 1400, .16); note(520, ctx.currentTime, .12, 'sine', .07, master, 180); } },
    whoosh() { if (awake) { puff(ctx.currentTime, .7, 'bandpass', 500, .09, master, 3400); [784, 988, 1319].forEach((f, i) => note(f, ctx.currentTime + i * .07, .3, 'sine', .06)); } },
    trick() { if (awake) note(330, ctx.currentTime, .7, 'sine', .07, master, 1320); },
    poof() { if (awake) puff(ctx.currentTime, .35, 'lowpass', 900, .07); },
    cheer() { if (awake) for (let i = 0; i < 4; i++) puff(ctx.currentTime + i * .32, .5, 'bandpass', 1100 + i * 180, .05); },
    close() { clearInterval(timer); }
  };
}
