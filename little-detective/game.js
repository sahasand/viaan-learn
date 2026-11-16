// Little Detective: six kinds of thinking puzzle, mixed into cases. The map, stars, eggs
// and stickers come from ../play-kit; the puzzles are in cases.js and rules.js.
import { SAVE_KEY, LANDS, STOPS, makeRound, V } from './rules.js?v=4';
import { PICTURES } from './cases.js?v=4';
import { $, art, wobble, tell, ask, miss, solved, sound, busy, startPlayground } from '../play-kit/kit.js?v=4';

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
    ask(V.oddAsk(), 'frog');
    choose(stage, task.answer, V.oddWrong(task), () => solved(V.oddRight(task)));
  },
  // A line of pictures that repeats: what comes next?
  pattern(task, stage) {
    stage.innerHTML = `<div class="line">${task.line.map(t => `<span>${art(t)}</span>`).join('')}<span class="missing" id="missing">?</span></div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask(V.patternAsk(), 'frog');
    choose(stage, task.answer, V.patternWrong(), () => { $('missing').innerHTML = art(task.answer); $('missing').classList.add('full'); solved(V.patternRight(task)); });
  },
  // One thing, and three others: which goes with it?
  goes(task, stage) {
    stage.innerHTML = `<div class="shown">${art(task.thing)}<b>${task.thing}</b></div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask(V.goesAsk(task), 'frog');
    choose(stage, task.answer, V.goesWrong(), () => solved([task.why]));
  },
  // A little story: what happens next?
  next(task, stage) {
    stage.innerHTML = `<div class="shown">${art(task.thing)}</div><div class="cards">${task.options.map(o => card(o)).join('')}</div>`;
    ask(V.nextAsk(task), 'frog');
    choose(stage, task.answer, V.nextWrong(), () => solved([task.why]));
  },
  // Three little stories: tap one to hear it, then say which could not really happen.
  silly(task, stage) {
    stage.innerHTML = `<div class="scenes">${task.scenes.map((s, i) => `<button class="scene" data-i="${i}" aria-label="${s.story}">${s.items.map(art).join('')}</button>`).join('')}</div><button class="go" id="pick" disabled>That one is silly!</button>`;
    ask(V.sillyAsk(), 'frog');
    let chosen = null;
    stage.onclick = e => {
      if (busy) return;
      const scene = e.target.closest('.scene');
      if (scene) { chosen = scene; stage.querySelectorAll('.scene').forEach(s => s.classList.toggle('chosen', s === scene)); $('pick').disabled = false; tell([task.scenes[scene.dataset.i].story]); return; }
      if (!e.target.closest('#pick') || !chosen) return;
      if (task.scenes[chosen.dataset.i].story !== task.answer) { wobble(chosen); miss(V.sillyWrong()); return; }
      chosen.classList.add('right'); solved([task.why]);
    };
  },
  // Three pictures of something that happens in steps: tap them in order.
  order(task, stage) {
    let placed = 0;
    stage.innerHTML = `<div class="steps-row" id="row">${task.order.map((_, i) => `<span class="slot">${i + 1}</span>`).join('')}</div><div class="cards">${task.tiles.map(o => card(o)).join('')}</div>`;
    ask(V.orderAsk(), 'frog');
    stage.onclick = e => {
      const picked = e.target.closest('.card'); if (!picked || busy || picked.disabled) return;
      if (picked.dataset.o !== task.order[placed]) { wobble(picked); miss(V.orderWrong(placed)); return; }
      const slot = $('row').children[placed]; slot.innerHTML = art(picked.dataset.o); slot.classList.add('full'); picked.disabled = true; placed++; sound.count(placed);
      if (placed === task.order.length) solved(V.orderRight(task));
    };
  }
};

startPlayground({ key: SAVE_KEY, world: 'crit', title: 'little detective', buddy: 'frog', lands: LANDS, stops: STOPS, pictures: PICTURES, makeRound, games: GAMES });
