// Story Garden: five reading games played through the phonics course, one stop a week.
// The map, stars, eggs and stickers come from ../play-kit; the course is in words.js.
import { SAVE_KEY, LANDS, STOPS, makeRound, soundClip, wordClip } from './rules.js?v=3';
import { PICTURES } from './words.js?v=3';
import { ANIMALS, TOYS } from '../play-kit/progress.js?v=3';
import { $, art, later, wobble, playClips, ask, miss, solved, sound, busy, startPlayground } from '../play-kit/kit.js?v=3';

const pictured = word => ANIMALS.includes(word) || TOYS.includes(word) || !!PICTURES[word];
const show = sound => sound.replace('_', '·');          // a_e is written a·e on a tile
const tile = (s, extra = '') => `<button class="tile" data-s="${s}" ${extra}>${show(s)}</button>`;

const GAMES = {
  // Hear a sound or a word, then tap the letters that say it. Or see a picture and find its first letter.
  hear(task, stage) {
    const start = task.kind === 'start';
    stage.innerHTML = (start ? `<div class="shown">${art(task.picture)}</div>` : '<button class="speaker" id="again" aria-label="Hear it again">🔊</button>')
      + `<div class="bubbles ${task.kind}">${task.options.map((o, i) => `<button class="bubble-letter c${i}" data-o="${o}" style="--d:${i * .4}s">${show(o)}</button>`).join('')}</div>`;
    ask(start ? 'What sound does it start with?' : task.kind === 'word' ? 'Which word says…' : 'Which one says…', 'owl', [task.clip]);
    stage.onclick = e => {
      if (busy) return;
      if (e.target.closest('#again')) { playClips([task.clip]); return; }
      const bubble = e.target.closest('[data-o]'); if (!bubble) return;
      if (bubble.dataset.o !== task.target) { wobble(bubble); miss(); later(() => playClips([task.clip]), 350); return; }
      bubble.classList.add('right');
      solved(start ? `${task.picture} starts with ${task.target}` : show(task.target), start ? [soundClip(task.target), task.clip] : [task.clip]);
    };
  },
  // Read a word from its sounds, then tap its picture.
  read(task, stage) {
    stage.innerHTML = `<div class="word">${task.sounds.map(s => tile(s)).join('')}</div><button class="blend" id="blend">▶ Say the sounds</button>
      <div class="cards">${task.options.map(o => `<button class="card" data-o="${o}" aria-label="A picture">${art(o)}</button>`).join('')}</div>`;
    ask('Read the word. Tap its picture!', 'owl');
    const run = (then) => { let i = 0; const tiles = [...stage.querySelectorAll('.word .tile')]; const next = () => { tiles.forEach((t, n) => t.classList.toggle('lit', n === i)); if (i >= tiles.length) { then?.(); return; } playClips([soundClip(task.sounds[i++])], next); }; next(); };
    stage.onclick = e => {
      if (busy) return;
      const one = e.target.closest('.tile'), card = e.target.closest('.card');
      if (one) { playClips([soundClip(one.dataset.s)]); wobble(one); return; }
      if (e.target.closest('#blend')) { run(); return; }
      if (!card) return;
      // After a miss the whole word is spoken, so the next try is about its meaning.
      if (card.dataset.o !== task.word) { wobble(card); miss(); later(() => run(() => playClips([wordClip(task.word)])), 300); return; }
      card.classList.add('right'); stage.querySelector('.word').classList.add('joined');
      solved(task.word, [wordClip(task.word)]);
    };
  },
  // Hear a word, then build it from sound tiles in order. The caterpillar grows a part for each sound.
  build(task, stage) {
    let placed = 0;
    stage.innerHTML = `<div class="shown">${pictured(task.word) ? art(task.word) : ''}<button class="speaker small" id="again" aria-label="Hear the word">🔊</button></div>
      <div class="caterpillar" id="slots"><span class="head" aria-hidden="true">🐛</span>${task.sounds.map(() => '<span class="part"></span>').join('')}</div>
      <div class="pool">${task.tiles.map(s => tile(s)).join('')}</div>`;
    ask('Build the word…', 'owl', [wordClip(task.word)]);
    stage.onclick = e => {
      if (busy) return;
      if (e.target.closest('#again')) { playClips([wordClip(task.word)]); return; }
      const one = e.target.closest('.pool .tile'); if (!one || one.disabled) return;
      if (one.dataset.s !== task.sounds[placed]) { wobble(one); miss(); later(() => playClips([wordClip(task.word)]), 300); return; }
      const part = $('slots').querySelectorAll('.part')[placed]; part.textContent = show(one.dataset.s); part.classList.add('full');
      one.disabled = true; placed++; sound.count(placed);
      if (placed < task.sounds.length) { playClips([soundClip(one.dataset.s)]); return; }
      $('slots').classList.add('happy'); solved(task.word, [wordClip(task.word)]);
    };
  },
  // Finish a sentence with the word that makes sense; then it is read aloud.
  story(task, stage) {
    const [before, after] = task.text.split('___');
    stage.innerHTML = `<p class="sentence">${before}<span class="gap" id="gap">?</span>${after}</p><div class="choices">${task.options.map(o => `<button class="choice" data-o="${o}">${o}</button>`).join('')}</div>`;
    ask('Finish the sentence. ' + task.text, 'owl');
    stage.onclick = e => {
      const choice = e.target.closest('.choice'); if (!choice || busy) return;
      if (choice.dataset.o !== task.answer) { wobble(choice); miss('Try each word. Which one makes sense? ' + task.text); return; }
      choice.classList.add('right'); $('gap').textContent = task.answer; $('gap').classList.add('full');
      solved(task.text.replace('___', task.answer));
    };
  },
  // Tap a card to hear it; choose the one that rhymes.
  rhyme(task, stage) {
    stage.innerHTML = `<div class="shown">${pictured(task.word) ? art(task.word) : ''}<b>${task.word}</b><button class="speaker small" id="again" aria-label="Hear ${task.word}">🔊</button></div>
      <div class="cards">${task.options.map(o => `<button class="card" data-o="${o}">${pictured(o) ? art(o) : ''}<b>${o}</b></button>`).join('')}</div><button class="go" id="pick" disabled>That one rhymes!</button>`;
    ask('What rhymes with…', 'owl', [wordClip(task.word)]);
    let chosen = null;
    stage.onclick = e => {
      if (busy) return;
      if (e.target.closest('#again')) { playClips([wordClip(task.word)]); return; }
      const card = e.target.closest('.card');
      if (card) { chosen = card; stage.querySelectorAll('.card').forEach(c => c.classList.toggle('chosen', c === card)); $('pick').disabled = false; playClips([wordClip(card.dataset.o)]); return; }
      if (!e.target.closest('#pick') || !chosen) return;
      if (chosen.dataset.o !== task.answer) { wobble(chosen); miss('Listen to the endings. Tap each one to hear it.'); return; }
      chosen.classList.add('right'); solved(`${task.word} · ${task.answer}`, [wordClip(task.word), wordClip(task.answer)]);
    };
  }
};

// Each stop is a plant: a seed until it is played, a sprout after one visit, a flower after two.
const stopArt = (stop, visits) => art(visits >= 2 ? 'flower' : visits === 1 ? 'sprout' : 'seed');
startPlayground({ key: SAVE_KEY, world: 'eng', title: 'story garden', buddy: 'owl', lands: LANDS, stops: STOPS, pictures: PICTURES, stopArt, makeRound: (stop, rng, friends) => makeRound(stop, rng, friends, pictured), games: GAMES });
