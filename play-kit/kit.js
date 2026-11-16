// The shell the three learning games share: the map of stops, a visit of tasks, speech,
// the win card, surprise eggs and the sticker book. A game supplies its stops, a round
// maker and one function per kind of task, then calls startPlayground. One page, one game.
import { REWARDS_KEY, EGG_COST, ANIMALS, TOYS, TREATS, STICKERS, normalizeRewards, normalizeVisits, reached, friendsOf, finishRound, canHatch, hatchEgg, advanceAdventure, dayStamp } from './progress.js?v=2';
import { createSound } from './audio.js?v=2';

export const $ = id => document.getElementById(id);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sound = createSound();
const PARTY = ['#ff6b6b', '#ffc93c', '#4ecdc4', '#6c8cff', '#ff8fd0', '#8ad66b'];
const CHEERS = ['cheer_awesome', 'cheer_great', 'cheer_super', 'cheer_wow', 'cheer_yes'];
const adventure = new URLSearchParams(location.search).has('adventure');
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
let game, rewards, visits, stop = null, tasks = [], at = 0, firsts = [], clean = true, clip = null, lastAsk = null, advanced = false, cracks = 0;
// True from the moment a task is solved until the next one is on screen; games ignore taps meanwhile.
export let busy = false;
const timers = new Set();

/* ---------- small helpers for the games ---------- */
// A picture by name: the clay model when there is one, otherwise the emoji the game registered.
export const art = name => ANIMALS.includes(name) || TOYS.includes(name) ? `<img src="../${ANIMALS.includes(name) ? 'memory-assets' : 'curriculum-assets'}/${name}.png" alt="" draggable="false">` : `<span class="emoji" aria-hidden="true">${game?.pictures?.[name] || TREATS[name] || '❔'}</span>`;
export const cap = word => word[0].toUpperCase() + word.slice(1);
export const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
const stopTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
export const wobble = el => { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); };
export const pad = (from, to) => `<div class="pad">${Array.from({ length: to - from + 1 }, (_, i) => `<button data-key="${from + i}">${from + i}</button>`).join('')}</div>`;
export const friends = () => friendsOf(rewards);
function keep() { write(REWARDS_KEY, rewards); write(game.key, visits); $('stars').textContent = rewards.stars; }

/* ---------- speaking ---------- */
export function hush() { if (clip) { clip.onended = null; clip.pause(); clip = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }
// Device speech for sentences. `then` runs when it has finished (only if sound is on).
export function say(text, then) {
  hush(); if (!rewards.sound) return;
  if (!('speechSynthesis' in window)) { then?.(); return; }
  const words = new SpeechSynthesisUtterance(text.replace(/−/g, ' take away ').replace(/\+/g, ' and ').replace(/=/g, ' is ').replace(/_+/g, ' blank ')); words.rate = .9; words.pitch = 1.15;
  if (then) words.onend = then;
  speechSynthesis.speak(words);
}
// Recorded clips from ../audio, one after another: sounds, words, numbers and cheers in a natural voice.
export function playClips(names, then) {
  hush(); if (!rewards.sound) return;
  let i = 0;
  const next = () => {
    if (i >= names.length) { clip = null; then?.(); return; }
    const one = new Audio(`../audio/${names[i++]}.mp3`); clip = one;
    one.onended = () => { if (clip === one) setTimeout(() => { if (clip === one) next(); }, 140); };
    one.onerror = one.onended; one.play().catch(() => {});
  };
  next();
}
const NUMBER_CLIPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 20, 25, 30];
export function sayNumber(n) { if (NUMBER_CLIPS.includes(n)) playClips(['num_' + n]); else say(String(n)); }
// The buddy asks the question. `clips` are recorded sounds played after the words; tapping the bubble repeats both.
export function ask(text, who = game.buddy, clips = null) {
  lastAsk = { text, clips }; $('askText').textContent = text; $('buddy').innerHTML = art(who);
  say(text, clips ? () => playClips(clips) : undefined);
}
export function tell(text) { $('askText').textContent = text; say(text); }
// Tapping dots, pins and the like counts them out loud and numbers them; it is help, never a mistake.
export function countOne(el) {
  if (el.classList.contains('counted')) return;
  const n = el.closest('.stage').querySelectorAll('.counted').length + 1;
  el.classList.add('counted'); el.textContent = n; sound.count(n); sayNumber(n);
}

/* ---------- the map ---------- */
function show(screen) {
  for (const id of ['map', 'play']) $(id).hidden = id !== screen;
  $('back').hidden = $('steps').hidden = screen !== 'play'; $('home').hidden = screen === 'play';
  document.body.dataset.screen = screen; scrollTo(0, 0);
}
function drawMap() {
  const open = reached(visits, game.stops);
  $('path').innerHTML = game.lands.map((land, l) => `<section class="land land-${l % 3}"><h2>${land.title}</h2><div class="stops">${land.stops.map(id => {
    const i = game.stops.findIndex(s => s.id === id), s = game.stops[i], seen = visits.done[id] || 0, state = seen ? 'done' : i === open ? 'next' : 'locked';
    return `<button class="stop ${state}" data-stop="${id}" ${state === 'locked' ? 'disabled' : ''} aria-label="${s.title}${state === 'locked' ? ', locked' : state === 'done' ? ', played' : ', new'}"><span class="icon" aria-hidden="true">${state === 'locked' ? '🔒' : game.stopArt ? game.stopArt(s, seen) : s.icon}</span><b>${s.title}</b>${state === 'done' ? '<i aria-hidden="true">✓</i>' : ''}${state === 'next' ? `<span class="here">${art(game.buddy)}</span>` : ''}</button>`;
  }).join('')}</div></section>`).join('');
  const ready = canHatch(rewards), all = rewards.stickers.length === STICKERS.length;
  $('eggButton').classList.toggle('ready', ready);
  $('eggNote').textContent = all ? 'All found!' : ready ? 'Ready to hatch!' : `${EGG_COST - rewards.stars} more stars`;
  $('bookNote').textContent = `${rewards.stickers.length} of ${STICKERS.length}`;
  $('stars').textContent = rewards.stars;
}
function toMap() { hush(); stopTimers(); busy = false; drawMap(); show('map'); document.querySelector('.stop.next')?.scrollIntoView({ block: 'center' }); }

/* ---------- a visit to a stop ---------- */
export function startStop(id) {
  stop = game.stops.find(s => s.id === id); if (!stop) return;
  tasks = game.makeRound(stop, Math.random, friends()); at = 0; firsts = []; busy = false;
  show('play'); runTask();
}
function drawSteps() { $('steps').innerHTML = tasks.map((_, i) => `<i class="${i < firsts.length ? (firsts[i] ? 'gold' : 'done') : i === at ? 'now' : ''}"></i>`).join(''); }
function runTask() {
  stopTimers(); clean = true; busy = false;
  const task = tasks[at], stage = $('stage');
  stage.className = 'stage game-' + task.game; stage.onclick = null; stage.innerHTML = '';
  drawSteps(); game.games[task.game](task, stage);
}
// A wrong try is never punished: a boing, a hint, and the task stays open.
export function miss(text) { clean = false; sound.boing(); if (text) tell(text); }
// `clips` are recorded sounds to play in place of speaking the text (which is still shown).
export function solved(text, clips = null) {
  if (busy) return; busy = true;
  firsts.push(clean); sound.yay(); confetti(); drawSteps();
  if (clips) { $('askText').textContent = text; playClips(clips); } else tell(text);
  later(() => { at++; if (at < tasks.length) runTask(); else finish(); }, 2600);
}
function finish() {
  const before = reached(visits, game.stops), result = finishRound(rewards, visits, game.stops, stop.id, firsts);
  rewards = result.rewards; visits = result.visits; keep();
  if (adventure && !advanced) {
    const moved = advanceAdventure(read('vla4'), dayStamp(), game.world);
    if (moved) { write('vla4', moved); advanced = true; }
  }
  const index = game.stops.indexOf(stop), last = game.stops.length - 1, unlocked = reached(visits, game.stops) > before;
  $('winStars').textContent = result.earned;
  $('winNote').textContent = unlocked ? `New: ${game.stops[index + 1].title}!` : canHatch(rewards) ? 'You have enough stars for a surprise egg!' : '';
  $('winNext').hidden = index >= last; $('winEgg').hidden = !canHatch(rewards); $('winAdventure').hidden = !advanced;
  $('winNext').dataset.stop = game.stops[Math.min(index + 1, last)].id;
  // Arriving from the Daily Adventure, the way back to it comes first.
  if (advanced) { $('winNext').before($('winAdventure')); $('winAdventure').className = 'primary'; $('winNext').className = 'secondary'; }
  sound.win(); confetti(40); playClips([CHEERS[Math.floor(Math.random() * CHEERS.length)]], () => say(`${result.earned} new stars!`));
  drawMap(); $('win').showModal();
}
function confetti(count = 16) {
  if (reduced) return;
  const layer = document.createElement('div'); layer.className = 'confetti';
  for (let i = 0; i < count; i++) layer.insertAdjacentHTML('beforeend', `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--r:${Math.round(Math.random() * 720)}deg;--t:${(.8 + Math.random() * .7).toFixed(2)}s;left:${Math.round(20 + Math.random() * 60)}%;background:${PARTY[i % 6]}"></i>`);
  document.body.append(layer); setTimeout(() => layer.remove(), 1700);
}

/* ---------- surprise eggs and the sticker book ---------- */
function openEgg() {
  if (!canHatch(rewards)) { wobble($('eggButton')); say(rewards.stickers.length === STICKERS.length ? 'You found every sticker!' : `You need ${EGG_COST - rewards.stars} more stars. Play a game!`); return; }
  cracks = 0; $('eggTap').hidden = false; $('eggTap').className = 'egg'; $('hatched').hidden = true; $('eggDone').hidden = true;
  $('eggTitle').textContent = 'Tap the egg!'; $('eggText').textContent = 'Tap, tap, tap…';
  if ($('win').open) $('win').close();
  $('egg').showModal(); say('Tap the egg!');
}
function crackEgg() {
  cracks++; sound.crack(); wobble($('eggTap')); $('eggTap').classList.add('crack' + Math.min(cracks, 3));
  if (cracks < 3) return;
  const egg = hatchEgg(rewards); if (!egg) { $('egg').close(); return; }
  rewards = egg.rewards; keep();
  const name = cap(egg.sticker);
  $('eggTap').hidden = true; $('hatched').hidden = false; $('hatched').innerHTML = art(egg.sticker); $('eggDone').hidden = false;
  $('eggTitle').textContent = `It’s ${name}!`; $('eggText').textContent = ANIMALS.includes(egg.sticker) ? `${name} will play the games with you.` : 'A new sticker for your book.';
  sound.hatch(); confetti(30); say(`Surprise! It’s ${name}!`); drawMap(); $('eggDone').focus();
}
function openBook() {
  $('stickers').innerHTML = ['bear', ...STICKERS].map(name => {
    const mine = name === 'bear' || rewards.stickers.includes(name);
    return `<button class="sticker ${mine ? '' : 'missing'}" ${mine ? `data-name="${name}"` : 'disabled'} aria-label="${mine ? cap(name) : 'Not found yet'}">${art(name)}<small>${mine ? cap(name) : '?'}</small></button>`;
  }).join('');
  $('book').showModal();
}

/* ---------- the page ---------- */
const PAGE = title => `<header class="top">
  <a class="round" id="home" href="../index.html" aria-label="Back to Viaan">⌂</a>
  <button class="round" id="back" aria-label="Back to the map" hidden>←</button>
  <div class="brand">${title}<span>.</span></div>
  <div class="steps" id="steps" aria-hidden="true"></div>
  <div class="bank" aria-label="Stars"><span aria-hidden="true">⭐</span><b id="stars">0</b></div>
  <button class="round" id="sound" aria-label="Turn sound off" aria-pressed="true">♫</button>
</header>
<main class="screen" id="map" aria-label="The path of games">
  <div class="shelf">
    <button class="prize" id="eggButton"><img src="../curriculum-assets/egg.png" alt=""><span><b>Surprise egg</b><small id="eggNote"></small></span></button>
    <button class="prize" id="bookButton"><img src="../memory-assets/panda.png" alt=""><span><b>My stickers</b><small id="bookNote"></small></span></button>
  </div>
  <div id="path"></div>
</main>
<main class="screen" id="play" aria-label="The game" hidden>
  <button class="ask" id="ask" aria-label="Hear it again"><span class="buddy" id="buddy"></span><span class="bubble" id="askText" role="status" aria-live="polite"></span><span class="again" aria-hidden="true">♪</span></button>
  <div class="stage" id="stage"></div>
</main>
<dialog id="win" aria-labelledby="winTitle"><div class="burst" aria-hidden="true">🎉</div><h2 id="winTitle">You did it!</h2>
  <p class="earned"><span aria-hidden="true">⭐</span> <b id="winStars">0</b> new stars</p><p id="winNote"></p>
  <button class="primary" id="winNext">Next game →</button><button class="secondary" id="winEgg">Open a surprise egg 🥚</button>
  <button class="secondary" id="winAgain">Play this one again</button><a class="secondary" id="winAdventure" href="../index.html" hidden>Back to my adventure →</a>
  <button class="text" id="winMap">Back to the map</button></dialog>
<dialog id="egg" aria-labelledby="eggTitle"><h2 id="eggTitle">Tap the egg!</h2>
  <button class="egg" id="eggTap" aria-label="Tap the egg to crack it"><img src="../curriculum-assets/egg.png" alt=""></button>
  <div class="hatched" id="hatched" hidden></div><p id="eggText"></p><button class="primary" id="eggDone" hidden>Hooray!</button></dialog>
<dialog id="book" aria-labelledby="bookTitle"><h2 id="bookTitle">My stickers</h2><div class="stickers" id="stickers"></div><button class="primary" id="bookDone" autofocus>Done</button></dialog>`;

async function setSound(on) {
  rewards = { ...rewards, sound: on }; keep();
  $('sound').setAttribute('aria-pressed', on); $('sound').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  if (!on) hush();
  try { await sound.set(on); } catch {}
}
// config: { key, world, title, buddy, lands, stops, makeRound(stop, rng, friends), games: { kind(task, stage) }, pictures?, stopArt?(stop, visits) }
export function startPlayground(config) {
  game = { buddy: 'bear', ...config };
  // Stars and stickers are shared; Number Playground's first saves kept their own, read once.
  rewards = normalizeRewards(read(REWARDS_KEY), read('viaan-numbers-v1')); visits = normalizeVisits(read(game.key), game.stops);
  document.body.insertAdjacentHTML('afterbegin', PAGE(game.title));
  // Browsers only allow sound after a tap, so it starts with the first one.
  const firstTap = e => { if (rewards.sound && !sound.on && !e.target.closest?.('#sound')) sound.set(true).catch(() => {}); };
  for (const event of ['pointerup', 'keydown']) addEventListener(event, firstTap);
  $('sound').onclick = () => setSound(!rewards.sound);
  $('back').onclick = toMap;
  $('ask').onclick = () => { if (!busy && lastAsk) say(lastAsk.text, lastAsk.clips ? () => playClips(lastAsk.clips) : undefined); };
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
  $('sound').setAttribute('aria-pressed', rewards.sound); $('sound').setAttribute('aria-label', rewards.sound ? 'Turn sound off' : 'Turn sound on');
  keep();
  // For checking the game by hand from the browser console.
  window.playground = { get rewards() { return rewards; }, get visits() { return visits; }, get task() { return tasks[at]; }, startStop };
  toMap();
  // Arriving from the Daily Adventure goes straight into the next game.
  if (adventure) startStop(game.stops[reached(visits, game.stops)].id);
}
