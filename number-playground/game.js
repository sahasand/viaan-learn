// Number Playground: six games where the playing is the maths. The map, stars, eggs and
// stickers come from ../play-kit; every rule about the numbers lives in rules.js.
import { SAVE_KEY, LANDS, STOPS, makeRound, judgeFeed, moreAnswer } from './rules.js?v=2';
import { $, art, cap, later, wobble, pad, sayNumber, ask, miss, solved, countOne, sound, busy, reduced, startPlayground } from '../play-kit/kit.js?v=2';

const PIPS = [[], [5], [1, 9], [1, 5, 9], [1, 3, 7, 9], [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]];
const many = (food, n) => n === 1 || food === 'fish' ? food : food + 's';

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
      if (pip) { countOne(pip); return; }
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
      } else if (pin && rolled && !pin.classList.contains('down')) countOne(pin);
      else if (key) {
        if (Number(key.dataset.key) !== task.answer) { wobble(key); miss('Count the pins still standing. Tap each one.'); return; }
        key.classList.add('right'); $('sum').hidden = false;
        solved(task.answer === 0 ? `Strike! ${task.pins} − ${task.down} = 0. None left!` : `${task.pins} − ${task.down} = ${task.answer}`);
      }
    };
  }
};

startPlayground({ key: SAVE_KEY, world: 'math', title: 'number playground', buddy: 'bear', lands: LANDS, stops: STOPS, makeRound, games: GAMES });
