// Number Playground: the map, the six games, the surprise eggs and the sticker book.
// Every rule lives in rules.js; this file draws, listens and speaks.
import { SAVE_KEY, EGG_COST, ANIMALS, STICKERS, LANDS, STOPS, stopById, makeRound, judgeFeed, moreAnswer, normalizeSave, reached, friendsOf, finishRound, canHatch, hatchEgg, advanceAdventure, dayStamp } from './rules.js?v=1';
import { createSound } from './audio.js?v=1';

const $ = id => document.getElementById(id);
// Numbers with a recorded clip in ../audio; any other number is spoken by the device.
const CLIPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 20, 25, 30];
const PIPS = [[], [5], [1, 9], [1, 5, 9], [1, 3, 7, 9], [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]];
const PARTY = ['#ff6b6b', '#ffc93c', '#4ecdc4', '#6c8cff', '#ff8fd0', '#8ad66b'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const adventure = new URLSearchParams(location.search).has('adventure');
const sound = createSound();
let saved; try { saved = localStorage.getItem(SAVE_KEY); } catch {}
let save = normalizeSave(saved);
let stop = null, tasks = [], at = 0, firsts = [], clean = true, busy = false, clip = null, lastAsk = '', advanced = false;
const timers = new Set();

const art = name => `<img src="../${ANIMALS.includes(name) ? 'memory-assets' : 'curriculum-assets'}/${name}.png" alt="" draggable="false">`;
const cap = word => word[0].toUpperCase() + word.slice(1);
const many = (food, n) => n === 1 || food === 'fish' ? food : food + 's';
const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
const stopTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
const wobble = el => { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); };
function keep() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} $('stars').textContent = save.stars; }

/* ---------- speaking ---------- */
function hush() { if (clip) { clip.pause(); clip = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function say(text) {
  hush(); if (!save.sound || !('speechSynthesis' in window)) return;
  const words = new SpeechSynthesisUtterance(text.replace(/−/g, ' take away ').replace(/\+/g, ' and ').replace(/=/g, ' is ')); words.rate = .9; words.pitch = 1.15;
  speechSynthesis.speak(words);
}
function sayNumber(n) {
  hush(); if (!save.sound) return;
  if (!CLIPS.includes(n)) { say(String(n)); return; }
  clip = new Audio(`../audio/num_${n}.mp3`); clip.play().catch(() => {});
}
function ask(text, who = 'bear') { lastAsk = text; $('askText').textContent = text; $('buddy').innerHTML = art(who); say(text); }
function tell(text) { $('askText').textContent = text; say(text); }

/* ---------- the map ---------- */
function show(screen) {
  for (const id of ['map', 'play']) $(id).hidden = id !== screen;
  $('back').hidden = $('steps').hidden = screen !== 'play'; $('home').hidden = screen === 'play';
  document.body.dataset.screen = screen; scrollTo(0, 0);
}
function drawMap() {
  const open = reached(save);
  $('path').innerHTML = LANDS.map((land, l) => `<section class="land land-${l}"><h2>${land.title}</h2><div class="stops">${land.stops.map(id => {
    const i = STOPS.findIndex(s => s.id === id), s = STOPS[i], state = save.done[id] ? 'done' : i === open ? 'next' : 'locked';
    return `<button class="stop ${state}" data-stop="${id}" ${state === 'locked' ? 'disabled' : ''} aria-label="${s.title}${state === 'locked' ? ', locked' : state === 'done' ? ', played' : ', new'}"><span class="icon" aria-hidden="true">${state === 'locked' ? '🔒' : s.icon}</span><b>${s.title}</b>${state === 'done' ? '<i aria-hidden="true">✓</i>' : ''}${state === 'next' ? `<span class="here">${art('bear')}</span>` : ''}</button>`;
  }).join('')}</div></section>`).join('');
  const ready = canHatch(save), all = save.stickers.length === STICKERS.length;
  $('eggButton').classList.toggle('ready', ready);
  $('eggNote').textContent = all ? 'All found!' : ready ? 'Ready to hatch!' : `${EGG_COST - save.stars} more stars`;
  $('bookNote').textContent = `${save.stickers.length} of ${STICKERS.length}`;
  $('stars').textContent = save.stars;
}
function toMap() { hush(); stopTimers(); busy = false; drawMap(); show('map'); document.querySelector('.stop.next')?.scrollIntoView({ block: 'center' }); }

/* ---------- a visit to a stop ---------- */
function startStop(id) {
  stop = stopById(id); if (!stop) return;
  tasks = makeRound(stop, Math.random, friendsOf(save)); at = 0; firsts = []; busy = false;
  show('play'); runTask();
}
function drawSteps() { $('steps').innerHTML = tasks.map((_, i) => `<i class="${i < firsts.length ? (firsts[i] ? 'gold' : 'done') : i === at ? 'now' : ''}"></i>`).join(''); }
function runTask() {
  stopTimers(); clean = true; busy = false;
  const task = tasks[at], stage = $('stage');
  stage.className = 'stage game-' + task.game; stage.onclick = null; stage.innerHTML = '';
  drawSteps(); GAMES[task.game](task, stage);
}
// A wrong try is never punished: a boing, a hint, and the task stays open.
function miss(text) { clean = false; sound.boing(); if (text) tell(text); }
function solved(text) {
  if (busy) return; busy = true;
  firsts.push(clean); sound.yay(); confetti(); drawSteps(); tell(text);
  later(() => { at++; if (at < tasks.length) runTask(); else finish(); }, 2400);
}
function finish() {
  const before = reached(save), result = finishRound(save, stop.id, firsts);
  save = result.save; keep();
  if (adventure && !advanced) try {
    const moved = advanceAdventure(localStorage.getItem('vla4'), dayStamp());
    if (moved) { localStorage.setItem('vla4', JSON.stringify(moved)); advanced = true; }
  } catch {}
  const index = STOPS.indexOf(stop), unlocked = reached(save) > before || (index === before && save.done[stop.id] === 1 && index < STOPS.length - 1);
  $('winStars').textContent = result.earned;
  $('winNote').textContent = unlocked ? `New game: ${STOPS[index + 1].title}!` : canHatch(save) ? 'You have enough stars for a surprise egg!' : '';
  $('winNext').hidden = index >= STOPS.length - 1; $('winEgg').hidden = !canHatch(save); $('winAdventure').hidden = !advanced;
  $('winNext').dataset.stop = STOPS[Math.min(index + 1, STOPS.length - 1)].id;
  // Arriving from the Daily Adventure, the way back to it comes first.
  if (advanced) { $('winNext').before($('winAdventure')); $('winAdventure').className = 'primary'; $('winNext').className = 'secondary'; }
  sound.win(); confetti(40); say(`You did it! ${result.earned} new stars!`);
  drawMap(); $('win').showModal();
}
function confetti(count = 16) {
  if (reduced) return;
  const layer = document.createElement('div'); layer.className = 'confetti';
  for (let i = 0; i < count; i++) layer.insertAdjacentHTML('beforeend', `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--r:${Math.round(Math.random() * 720)}deg;--t:${(.8 + Math.random() * .7).toFixed(2)}s;left:${Math.round(20 + Math.random() * 60)}%;background:${PARTY[i % 6]}"></i>`);
  document.body.append(layer); setTimeout(() => layer.remove(), 1700);
}
const pad = (from, to) => `<div class="pad">${Array.from({ length: to - from + 1 }, (_, i) => `<button data-key="${from + i}">${from + i}</button>`).join('')}</div>`;
// Tapping dots or pins counts them out loud and numbers them; it is help, never a mistake.
function countOne(el, mark) {
  if (el.classList.contains('counted')) return;
  const n = el.parentNode.closest('.stage').querySelectorAll('.counted').length + 1;
  el.classList.add('counted'); if (mark) el.textContent = n; else el.dataset.count = n;
  sound.count(n); sayNumber(n);
}

/* ---------- the six games ---------- */
const GAMES = {
  // Put exactly the right number of things on a friend's plate.
  feed(task, stage) {
    const name = cap(task.animal), foods = many(task.food, task.want);
    stage.innerHTML = `<button class="eater" id="eater" aria-label="Feed ${name}">${art(task.animal)}<span class="want"><b>${task.want}</b>${art(task.food)}</span></button>
      <div class="plate" id="plate" aria-label="${name}’s plate" data-count="0"></div>
      <button class="go" id="feedGo">Feed ${name}!</button>
      <div class="basket ${task.pile > 10 ? 'lots' : ''}" id="basket">${`<button class="food" aria-label="${task.food}">${art(task.food)}</button>`.repeat(task.pile)}</div>`;
    ask(`${name} wants ${task.want} ${foods}. Put them on the plate!`, task.animal);
    const plate = $('plate'), basket = $('basket');
    let eating = false;
    stage.onclick = e => {
      if (busy || eating) return;
      const food = e.target.closest('.food');
      if (food) {
        const onto = food.parentNode === basket; (onto ? plate : basket).append(food);
        const n = plate.children.length; plate.dataset.count = n; sound.count(n); if (onto) sayNumber(n);
        return;
      }
      if (!e.target.closest('#feedGo, #eater')) return;
      const n = plate.children.length, verdict = judgeFeed(task, n);
      if (verdict !== 'right') { wobble($('eater')); miss(n === 0 ? `Tap the ${many(task.food, 2)} to put them on the plate.` : `That is ${n}. ${name} wants ${task.want}. ${verdict === 'few' ? 'Add some more!' : 'Take some back!'}`); return; }
      eating = true; $('eater').classList.add('happy');
      [...plate.children].forEach((bite, i) => later(() => { bite.classList.add('eaten'); sound.munch(); }, i * 150));
      later(() => solved(`Yum! ${task.want} ${foods}. Thank you!`), task.want * 150 + 250);
    };
  },
  // Pop the balloon with the number asked for, or pop a whole sequence in order.
  pop(task, stage) {
    const find = task.mode === 'find', seq = task.sequence || [], step = find ? 1 : Math.abs(seq[1] - seq[0]);
    let index = 0;
    stage.innerHTML = `<div class="sky n${task.numbers.length}">${task.numbers.map((n, i) => `<button class="balloon c${i % 6}" data-n="${n}" style="--d:${(i * .37 % 1.6).toFixed(2)}s" aria-label="${n}">${n}</button>`).join('')}</div>`
      + (find ? '' : `<div class="trail" id="trail">${seq.map(() => '<span></span>').join('')}</div>`) + (task.launch ? '<div class="rocket" id="rocket" aria-hidden="true">🚀</div>' : '');
    ask(find ? `Pop number ${task.target}!` : task.launch ? `Count down from ${seq[0]} to blast off!` : step > 1 ? `Count by ${step}s. Start at ${seq[0]}!` : `Pop them in order. Start at ${seq[0]}!`);
    stage.onclick = e => {
      const balloon = e.target.closest('.balloon'); if (!balloon || busy || balloon.disabled) return;
      const n = Number(balloon.dataset.n), want = find ? task.target : seq[index];
      if (n !== want) { wobble(balloon); miss(find ? `That is ${n}. Find ${want}!` : `Not yet. Find ${want}!`); return; }
      balloon.classList.add('popped'); balloon.disabled = true; sound.pop();
      if (find) { solved(`Pop! Number ${n}!`); return; }
      const slot = $('trail').children[index]; slot.textContent = n; slot.classList.add('filled'); index++;
      if (index < seq.length) { sayNumber(n); return; }
      if (task.launch) { $('rocket').classList.add('go'); sound.launch(); solved('Blast off!'); }
      else solved(step > 1 ? `You counted by ${step}s to ${n}!` : `You counted to ${n}!`);
    };
  },
  // Two friends, two piles (or two number cards): who has more, or fewer?
  more(task, stage) {
    const side = moreAnswer(task), word = task.numerals ? (task.ask === 'more' ? 'bigger' : 'smaller') : task.ask;
    const pile = n => task.numerals ? `<b class="card">${n}</b>` : `<span class="pile ${n > 6 ? 'lots' : ''}">${art(task.food).repeat(n)}</span><b class="total" hidden>${n}</b>`;
    stage.innerHTML = `<div class="versus">${['left', 'right'].map((s, i) => `<button class="side" data-side="${s}" aria-label="${cap(task.animals[i])}${task.numerals ? ' with ' + task[s] : ''}">${art(task.animals[i])}${pile(task[s])}</button>`).join('<i>or</i>')}</div>`;
    ask(task.numerals ? `Which number is ${word}?` : `Who has ${word} ${many(task.food, 2)}?`);
    stage.onclick = e => {
      const button = e.target.closest('.side'); if (!button || busy) return;
      stage.querySelectorAll('.total').forEach(total => { total.hidden = false; });
      if (button.dataset.side !== side) { wobble(button); miss(task.numerals ? `Look again. Which number is ${word}?` : `Count them. Who has ${word}?`); return; }
      button.classList.add('happy');
      const [win, lose] = side === 'left' ? [task.left, task.right] : [task.right, task.left];
      solved(`${win} is ${task.numerals ? word : task.ask} than ${lose}!`);
    };
  },
  // A domino: how many dots altogether?
  domino(task, stage) {
    const half = n => `<span class="half">${PIPS[n].map(p => `<button class="pip p${p}" aria-label="Count this dot"></button>`).join('')}</span>`;
    stage.innerHTML = `<div class="domino" id="domino">${half(task.a)}<i></i>${half(task.b)}</div><p class="sum" id="sum" hidden>${task.a} + ${task.b} = ${task.answer}</p>${pad(0, task.max)}`;
    ask('How many dots altogether? Tap the dots to count them.');
    stage.onclick = e => {
      if (busy) return;
      const pip = e.target.closest('.pip'), key = e.target.closest('[data-key]');
      if (pip) { countOne(pip, true); return; }
      if (!key) return;
      if (Number(key.dataset.key) !== task.answer) { wobble(key); miss('Count every dot. Tap them one by one.'); return; }
      key.classList.add('right'); $('domino').classList.add('fall'); $('sum').hidden = false;
      solved(`${task.a} + ${task.b} = ${task.answer}`);
    };
  },
  // A frog on a number line: where does it land, or how many hops to the fly?
  hop(task, stage) {
    const land = task.ask === 'land', back = task.by < 0, hops = Math.abs(task.by), goal = task.start + task.by;
    stage.innerHTML = `<p class="sum big">${land ? `${task.start} ${back ? '−' : '+'} ${hops}` : `${task.start} → ${goal}`}</p>
      <div class="pond m${task.max}" id="pond">${Array.from({ length: task.max + 1 }, (_, i) => `<button class="lily" data-n="${i}" aria-label="${i}"><b>${i}</b></button>`).join('')}</div>${land ? '' : pad(1, 5)}`;
    const pads = [...stage.querySelectorAll('.lily')], frog = document.createElement('span');
    frog.className = 'frog'; frog.innerHTML = art('frog'); pads[task.start].append(frog);
    if (!land) pads[goal].insertAdjacentHTML('beforeend', '<span class="fly" aria-hidden="true">🪰</span>');
    ask(land ? `Frog is on ${task.start}. Hop ${hops} ${back ? 'back' : 'forward'}. Where does he land?` : `Frog is on ${task.start}. How many hops to the fly on ${goal}?`, 'frog');
    let hopping = false;
    // The frog hops one pad at a time while the hops are counted aloud.
    const jump = (count, then) => {
      let made = 0, at = task.start;
      const one = () => {
        at += back ? -1 : 1; pads[at].append(frog); wobble(frog); made++; sound.hop(); sayNumber(made);
        if (made < count) later(one, 560); else later(then, 700);
      };
      hopping = true; one();
    };
    stage.onclick = e => {
      if (busy || hopping) return;
      const lily = e.target.closest('.lily'), key = e.target.closest('[data-key]');
      if (land && lily) {
        if (Number(lily.dataset.n) !== task.answer) {
          // After a miss the pads along the way show which hop they are.
          wobble(lily); for (let i = 1; i <= hops; i++) pads[task.start + (back ? -i : i)].dataset.hop = i;
          miss(`Count ${hops} ${hops === 1 ? 'hop' : 'hops'} from ${task.start}.`); return;
        }
        jump(hops, () => solved(`${task.start} ${back ? '−' : '+'} ${hops} = ${task.answer}`));
      } else if (!land && key) {
        const tried = Number(key.dataset.key), can = Math.min(tried, task.max - task.start);
        jump(can, () => {
          if (tried === task.answer) { frog.classList.add('happy'); stage.querySelector('.fly')?.remove(); solved(`${tried} ${tried === 1 ? 'hop' : 'hops'}! ${task.start} + ${tried} = ${goal}`); return; }
          miss(tried < task.answer ? 'Not there yet! Try more hops.' : 'Too far! Try fewer hops.');
          later(() => { pads[task.start].append(frog); hopping = false; }, 900);
        });
      }
    };
  },
  // Roll the ball, then say how many pins are still standing.
  bowl(task, stage) {
    const rows = []; let left = task.pins, size = Math.ceil((Math.sqrt(8 * task.pins + 1) - 1) / 2);
    while (left > 0) { rows.push(Math.min(size, left)); left -= size; size--; }
    stage.innerHTML = `<div class="lane"><div class="pins">${rows.map(n => `<div>${'<button class="pin" aria-label="Count this pin"></button>'.repeat(n)}</div>`).join('')}</div><button class="ball" id="ball" aria-label="Roll the ball">${art('ball')}</button></div>
      <p class="sum" id="sum" hidden>${task.pins} − ${task.down} = ${task.answer}</p><div id="keys" hidden>${pad(0, task.pins)}</div>`;
    ask(`${task.pins} pins! Tap the ball to roll it.`);
    let rolled = false;
    stage.onclick = e => {
      if (busy) return;
      const pin = e.target.closest('.pin'), key = e.target.closest('[data-key]');
      if (e.target.closest('#ball') && !rolled) {
        rolled = true; $('ball').classList.add('roll'); sound.roll();
        later(() => {
          const pins = [...stage.querySelectorAll('.pin')].sort(() => Math.random() - .5);
          pins.slice(0, task.down).forEach(p => { p.classList.add('down'); p.disabled = true; });
          sound.crash(); $('ball').hidden = true; $('keys').hidden = false; ask('Crash! How many pins are still standing?');
        }, reduced ? 50 : 650);
      } else if (pin && rolled && !pin.classList.contains('down')) countOne(pin, true);
      else if (key) {
        if (Number(key.dataset.key) !== task.answer) { wobble(key); miss('Count the pins still standing. Tap each one.'); return; }
        key.classList.add('right'); $('sum').hidden = false;
        solved(task.answer === 0 ? `Strike! ${task.pins} − ${task.down} = 0. None left!` : `${task.pins} − ${task.down} = ${task.answer}`);
      }
    };
  }
};

/* ---------- surprise eggs and the sticker book ---------- */
let cracks = 0;
function openEgg() {
  if (!canHatch(save)) { wobble($('eggButton')); say(save.stickers.length === STICKERS.length ? 'You found every sticker!' : `You need ${EGG_COST - save.stars} more stars. Play a game!`); return; }
  cracks = 0; $('eggTap').hidden = false; $('eggTap').className = 'egg'; $('hatched').hidden = true; $('eggDone').hidden = true;
  $('eggTitle').textContent = 'Tap the egg!'; $('eggText').textContent = 'Tap, tap, tap…';
  if ($('win').open) $('win').close();
  $('egg').showModal(); say('Tap the egg!');
}
function crackEgg() {
  cracks++; sound.crack(); wobble($('eggTap')); $('eggTap').classList.add('crack' + Math.min(cracks, 3));
  if (cracks < 3) return;
  const egg = hatchEgg(save); if (!egg) { $('egg').close(); return; }
  save = egg.save; keep();
  const name = cap(egg.sticker);
  $('eggTap').hidden = true; $('hatched').hidden = false; $('hatched').innerHTML = art(egg.sticker); $('eggDone').hidden = false;
  $('eggTitle').textContent = `It’s ${name}!`; $('eggText').textContent = ANIMALS.includes(egg.sticker) ? `${name} will play the games with you.` : 'A new sticker for your book.';
  sound.hatch(); confetti(30); say(`Surprise! It’s ${name}!`); drawMap(); $('eggDone').focus();
}
function openBook() {
  $('stickers').innerHTML = ['bear', ...STICKERS].map(name => {
    const mine = name === 'bear' || save.stickers.includes(name);
    return `<button class="sticker ${mine ? '' : 'missing'}" ${mine ? `data-name="${name}"` : 'disabled'} aria-label="${mine ? cap(name) : 'Not found yet'}">${art(name)}<small>${mine ? cap(name) : '?'}</small></button>`;
  }).join('');
  $('book').showModal();
}

/* ---------- controls ---------- */
async function setSound(on) {
  save = { ...save, sound: on }; keep();
  $('sound').setAttribute('aria-pressed', on); $('sound').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  if (!on) hush();
  try { await sound.set(on); } catch {}
}
// Browsers only allow sound after a tap, so it starts with the first one.
function firstTap(e) { if (save.sound && !sound.on && !e.target.closest?.('#sound')) sound.set(true).catch(() => {}); }
for (const event of ['pointerup', 'keydown']) addEventListener(event, firstTap);
$('sound').onclick = () => setSound(!save.sound);
$('back').onclick = toMap;
$('ask').onclick = () => { if (!busy) say(lastAsk); };
$('path').onclick = e => { const button = e.target.closest('[data-stop]'); if (button && !button.disabled) { sound.tap(); startStop(button.dataset.stop); } };
$('eggButton').onclick = openEgg; $('winEgg').onclick = openEgg; $('eggTap').onclick = crackEgg;
$('eggDone').onclick = () => $('egg').close();
// An egg opened from the end of a visit leaves a finished game behind it, so go back to the map.
$('egg').addEventListener('close', () => { if (!$('play').hidden && at >= tasks.length) toMap(); });
$('bookButton').onclick = openBook; $('bookDone').onclick = () => $('book').close();
$('stickers').onclick = e => { const sticker = e.target.closest('[data-name]'); if (sticker) { wobble(sticker); sound.tap(); say(cap(sticker.dataset.name)); } };
$('winNext').onclick = () => { $('win').close(); startStop($('winNext').dataset.stop); };
$('winAgain').onclick = () => { $('win').close(); startStop(stop.id); };
$('winMap').onclick = () => { $('win').close(); toMap(); };
$('win').addEventListener('cancel', e => { e.preventDefault(); $('winMap').click(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) hush(); sound.awake(!document.hidden); });
addEventListener('pagehide', hush);

$('sound').setAttribute('aria-pressed', save.sound); $('sound').setAttribute('aria-label', save.sound ? 'Turn sound off' : 'Turn sound on');
// For checking the game by hand from the browser console.
window.numberPlayground = { get save() { return save; }, get task() { return tasks[at]; }, startStop };
toMap();
// Arriving from the Daily Adventure goes straight into the next game.
if (adventure) startStop(STOPS[reached(save)].id);
