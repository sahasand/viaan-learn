import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const htmlPath = fileURLToPath(new URL('./plane.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf8');
const m = html.match(/\/\* LOGIC_START \*\/([\s\S]*?)\/\* LOGIC_END \*\//);
if (!m) throw new Error('LOGIC markers not found in plane.html');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);

// Deterministic RNG (mulberry32) so guess-dependent tests are reproducible.
// vm-created objects have a different prototype chain, so compare by value.
function plain(v){ return JSON.parse(JSON.stringify(v)); }

function seeded(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('CATS catalogue is well-formed (4 categories, unique ids, drawable options)', () => {
  const cats = sandbox.CATS;
  assert.equal(cats.length, 4);
  assert.equal(new Set(cats.map(c => c.id)).size, 4);
  for (const c of cats){
    assert.ok(c.label && c.icon);
    assert.ok(c.opts.length >= 2, `${c.id} needs >=2 options`);
    assert.equal(new Set(c.opts.map(o => o.id)).size, c.opts.length, `${c.id} has duplicate option ids`);
    for (const o of c.opts) assert.ok(o.label);
  }
  const color = cats.find(c => c.id === 'color');
  color.opts.forEach(o => assert.ok(o.sw && o.dk, `color ${o.id} needs sw+dk paints`));
  const decal = cats.find(c => c.id === 'decal');
  decal.opts.forEach(o => assert.ok(o.glyph, `decal ${o.id} needs a glyph`));
  assert.ok(sandbox.NUM_ORDERS >= 3);
  assert.ok(sandbox.CUSTOMERS.length >= 5);
});

test('randomSpec: every category filled with a valid option, deterministic under a seed', () => {
  const a = sandbox.randomSpec(seeded(9));
  const b = sandbox.randomSpec(seeded(9));
  assert.deepEqual(plain(a), plain(b));
  for (const c of sandbox.CATS){
    assert.ok(c.opts.some(o => o.id === a[c.id]), `${c.id}=${a[c.id]} is not a real option`);
  }
});

test('robotBuild: complete instructions are kept verbatim, nothing guessed', () => {
  const choices = { color:'red', wings:'big', engine:'jet', decal:'heart' };
  const out = sandbox.robotBuild(choices, seeded(1));
  assert.deepEqual(plain(out.spec), choices);
  assert.deepEqual(plain(out.guessed), {});
});

test('robotBuild: empty instructions -> every part is a (valid) robot guess', () => {
  const out = sandbox.robotBuild({}, seeded(3));
  for (const c of sandbox.CATS){
    assert.equal(out.guessed[c.id], true);
    assert.ok(c.opts.some(o => o.id === out.spec[c.id]));
  }
});

test('robotBuild: partial instructions -> given parts kept, missing parts guessed', () => {
  const out = sandbox.robotBuild({ color:'green' }, seeded(5));
  assert.equal(out.spec.color, 'green');
  assert.equal(out.guessed.color, undefined);
  assert.equal(out.guessed.wings, true);
  assert.equal(out.guessed.engine, true);
  assert.equal(out.guessed.decal, true);
});

test('compareSpec: exact match is ok; a mismatch names the wrong category', () => {
  const t = { color:'red', wings:'big', engine:'prop', decal:'star' };
  const good = sandbox.compareSpec(t, { ...t });
  assert.equal(good.ok, true);
  assert.deepEqual(plain(good.wrong), []);
  const bad = sandbox.compareSpec(t, { ...t, wings:'small' });
  assert.equal(bad.ok, false);
  assert.deepEqual(plain(bad.wrong), ['wings']);
  assert.equal(bad.match.wings, false);
  assert.equal(bad.match.color, true);
});

test('starsFor: first try 3, second 2, later 1', () => {
  assert.equal(sandbox.starsFor(1), 3);
  assert.equal(sandbox.starsFor(2), 2);
  assert.equal(sandbox.starsFor(3), 1);
  assert.equal(sandbox.starsFor(7), 1);
});

test('flightStep: holding climbs, releasing falls, altitude stays clamped to [0,1]', () => {
  let st = { y:0.5, vy:0 };
  for (let i=0;i<10;i++) st = sandbox.flightStep(st, true, 0.033);
  assert.ok(st.y < 0.5, 'holding should climb (y decreases)');
  let fall = { y:0.5, vy:0 };
  for (let i=0;i<10;i++) fall = sandbox.flightStep(fall, false, 0.033);
  assert.ok(fall.y > 0.5, 'releasing should descend (y increases)');
  // clamp at the top
  let top = { y:0.01, vy:-0.8 };
  for (let i=0;i<30;i++) top = sandbox.flightStep(top, true, 0.033);
  assert.equal(top.y, 0);
  assert.equal(top.vy, 0);
  // clamp at the ground
  let gnd = { y:0.99, vy:0.8 };
  for (let i=0;i<30;i++) gnd = sandbox.flightStep(gnd, false, 0.033);
  assert.equal(gnd.y, 1);
  // velocity clamp
  let v = { y:0.5, vy:0 };
  for (let i=0;i<200;i++) v = sandbox.flightStep(v, true, 0.033);
  assert.ok(Math.abs(v.vy) <= sandbox.FLY_VMAX + 1e-9);
});

test('starHit: collects when close in altitude, misses when far', () => {
  assert.equal(sandbox.starHit(0.5, 0.55), true);
  assert.equal(sandbox.starHit(0.5, 0.5), true);
  assert.equal(sandbox.starHit(0.5, 0.7), false);
  assert.equal(sandbox.starHit(0.1, 0.9), false);
});

// ---- UI control-flow (LOGIC + UI evaluated against a stubbed DOM + fake timers) ----
const logicSrc = html.match(/\/\* LOGIC_START \*\/([\s\S]*?)\/\* LOGIC_END \*\//)[1];
const uiSrc = html.match(/\/\* UI_START \*\/([\s\S]*?)\/\* UI_END \*\//)[1];

function makeEl(){
  const cls = new Set();
  return {
    _cls: cls, innerHTML:'', textContent:'', className:'',
    style:{ setProperty(){} },
    classList:{
      add:c=>cls.add(c), remove:c=>cls.delete(c), contains:c=>cls.has(c),
      toggle:(c,f)=>{ if(f===undefined){ cls.has(c)?cls.delete(c):cls.add(c); } else if(f){ cls.add(c); } else { cls.delete(c); } }
    },
    setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, appendChild(){}, querySelectorAll(){ return []; }, querySelector(){ return makeEl(); }
  };
}

function makeUiSandbox(){
  const pending = {}; let nid = 1;
  const els = {};
  const sb = {
    document:{ getElementById:id => els[id] || (els[id]=makeEl()), createElement:()=>makeEl() },
    setTimeout:(fn)=>{ const id=nid++; pending[id]=fn; return id; },
    clearTimeout:(id)=>{ delete pending[id]; },
    Math, Object,
    __pending: pending, __els: els
  };
  vm.createContext(sb);
  vm.runInContext(logicSrc + '\n' + uiSrc, sb);
  return sb;
}

// Fire every currently-pending fake timer once (snapshot, so chained ticks don't loop forever).
function firePending(sb){
  const ids = Object.keys(sb.__pending);
  for (const id of ids){
    const fn = sb.__pending[id];
    delete sb.__pending[id];
    if (fn) fn();
  }
}

test('UI: loads without error and startOrders opens the workshop with a valid order', () => {
  const sb = makeUiSandbox();
  sb.startOrders();
  assert.ok(sb.__els.shop._cls.has('on'));
  assert.equal(sb.R.orderN, 1);
  for (const c of sb.CATS){
    assert.ok(c.opts.some(o => o.id === sb.R.target[c.id]));
  }
});

test('UI: building the exact target awards 3 stars on the first try', () => {
  const sb = makeUiSandbox();
  sb.startOrders();
  sb.R.choices = { ...sb.R.target };
  sb.onBuild();
  assert.equal(sb.R.marks.ok, true);          // compared synchronously
  firePending(sb);                            // reveal timer -> speech + stars
  assert.equal(sb.R.phase, 'built');
  assert.equal(sb.R.buildStars, 3);
});

test('UI: two wrong builds turn on tile hints pointing at the correct options', () => {
  const sb = makeUiSandbox();
  sb.startOrders();
  const t = sb.R.target;
  const wrongColor = sb.CATS[0].opts.find(o => o.id !== t.color).id;
  sb.R.choices = { ...t, color: wrongColor };
  sb.onBuild(); firePending(sb);
  assert.equal(sb.R.marks.ok, false);
  assert.equal(sb.R.hints, null);             // first miss: no hint yet
  sb.onBuild(); firePending(sb);
  assert.ok(sb.R.hints);                      // second miss: hints appear
  assert.equal(sb.R.hints.color, t.color);    // ...pointing at the right tile
  assert.equal(sb.R.phase, 'pick');
  assert.equal(sb.R.buildStars, 0);
});

test('UI: leaving the workshop cancels the pending build-reveal timer', () => {
  const sb = makeUiSandbox();
  sb.startOrders();
  sb.R.choices = { ...sb.R.target };
  sb.onBuild();                               // schedules the 650ms reveal
  assert.equal(sb.timers.length, 1);
  assert.equal(Object.keys(sb.__pending).length, 1);
  sb.toSetup();
  assert.equal(sb.timers.length, 0);
  assert.equal(Object.keys(sb.__pending).length, 0);
});

test('UI: winGame does nothing when the workshop screen is not active', () => {
  const sb = makeUiSandbox();
  sb.toSetup();
  sb.winGame();
  assert.ok(!sb.__els.win._cls.has('show'));
});
