// Little Detective: six kinds of thinking puzzle, mixed into cases. The map, stars, eggs
// and stickers come from ../play-kit; the puzzles are in cases.js and rules.js.
import { SAVE_KEY, LANDS, STOPS, makeRound } from './rules.js?v=2';
import { PICTURES } from './cases.js?v=2';
import { $, art, wobble, say, ask, miss, solved, sound, busy, startPlayground } from '../play-kit/kit.js?v=2';

const card = (name, extra = '') => `<button class="card" data-o="${name}" aria-label="${name}" ${extra}>${art(name)}</button>`;
// The usual way to answer: tap the right picture card.
function choose(stage, answer, wrong, right) {
  stage.onclick = e => {
    const picked = e.target.closest('.card'); if (!picked || busy) return;
    if (picked.dataset.o !== answer) { wobble(picked); miss(wrong); return; }
    picked.classList.add('right'); right(picked);
  };
}

const GAMES = {
  // Four things: three belong together, one does not.
  odd(task, stage) {
    stage.innerHTML = `<div class="cards four">${task.options.map(o => card(o)).join('')}</div>`;
    ask('Which one does not belong?', 'frog');
    choose(stage, task.answer, `Three of them are ${task.group}. Which one is left over?`, () => solved(`The others are ${task.group}. The ${task.answer} is different.`));
  },
  // A line of pictures that repeats: what comes next?
  pattern(task, stage) {
    stage.innerHTML = `<div class="line">${task.line.map(t => `<span>${art(t)}</span>`).join('')}<span class="missing" id="missing">?</span></div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask('What comes next?', 'frog');
    choose(stage, task.answer, 'Say the pictures in order. Listen for the part that repeats.', () => { $('missing').innerHTML = art(task.answer); $('missing').classList.add('full'); solved(`${task.answer} comes next!`); });
  },
  // One thing, and three others: which goes with it?
  goes(task, stage) {
    stage.innerHTML = `<div class="shown">${art(task.thing)}<b>${task.thing}</b></div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask(`What goes with the ${task.thing}?`, 'frog');
    choose(stage, task.answer, 'Think about what we use together, or find together.', () => solved(task.why));
  },
  // A little story: what happens next?
  next(task, stage) {
    stage.innerHTML = `<div class="shown">${art(task.thing)}</div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask(task.story.replace(/ What might (happen|appear)\?$/, '') + ' What happens next?', 'frog');
    choose(stage, task.answer, 'Listen to the story again. What could change?', () => solved(task.why));
  },
  // Three little stories: tap one to hear it, then say which could not really happen.
  silly(task, stage) {
    stage.innerHTML = `<div class="scenes">${task.scenes.map((s, i) => `<button class="scene" data-i="${i}" aria-label="${s.story}">${s.items.map(art).join('')}</button>`).join('')}</div><button class="go" id="pick" disabled>That one is silly!</button>`;
    ask('Tap each picture to hear its story. Which one is silly?', 'frog');
    let chosen = null;
    stage.onclick = e => {
      if (busy) return;
      const scene = e.target.closest('.scene');
      if (scene) { chosen = scene; stage.querySelectorAll('.scene').forEach(s => s.classList.toggle('chosen', s === scene)); $('pick').disabled = false; $('askText').textContent = task.scenes[scene.dataset.i].story; say(task.scenes[scene.dataset.i].story); return; }
      if (!e.target.closest('#pick') || !chosen) return;
      if (task.scenes[chosen.dataset.i].story !== task.answer) { wobble(chosen); miss('That could really happen. Listen to the others.'); return; }
      chosen.classList.add('right'); solved(task.why);
    };
  },
  // Three pictures of something that happens in steps: tap them in order.
  order(task, stage) {
    let placed = 0;
    stage.innerHTML = `<div class="steps-row" id="row">${task.order.map((_, i) => `<span class="slot">${i + 1}</span>`).join('')}</div><div class="cards">${task.tiles.map(o => card(o)).join('')}</div>`;
    ask('What happens first? Tap them in order.', 'frog');
    stage.onclick = e => {
      const picked = e.target.closest('.card'); if (!picked || busy || picked.disabled) return;
      if (picked.dataset.o !== task.order[placed]) { wobble(picked); miss(placed ? 'What happens after that?' : 'Which one happens first?'); return; }
      const slot = $('row').children[placed]; slot.innerHTML = art(picked.dataset.o); slot.classList.add('full'); picked.disabled = true; placed++; sound.count(placed);
      if (placed === task.order.length) solved(`First ${task.order[0]}, then ${task.order.slice(1).join(', then ')}.`);
    };
  }
};

startPlayground({ key: SAVE_KEY, world: 'crit', title: 'little detective', buddy: 'frog', lands: LANDS, stops: STOPS, pictures: PICTURES, makeRound, games: GAMES });
