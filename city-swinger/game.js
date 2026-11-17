// City Swinger: the game loop, camera, input and screens. The rules are in swing.js, the hero
// in hero.js and the city in scenery.js; this file joins them up and adds the feel: the rope,
// trails, sparks, pop-up words, the progress bar and the first-swing lesson.
import * as THREE from 'three';
import { SAVE_KEY, BODY, SUITS, FINISH_STARS, makeMission, startHero, stepHero, gather, hookFor, normalizeSave, earn, rescue, finishMission, chooseSuit } from './swing.js?v=3';
import { makeHero, poseHero, STAR, BIG } from './hero.js?v=3';
import { buildCity, LOOK } from './scenery.js?v=3';
import { createSound } from './audio.js?v=3';

const $ = id => document.getElementById(id);
const canvas = $('world'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, sound = createSound();
const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), dummy = new THREE.Object3D(), paint = new THREE.Color();
const rand = Math.random, HAND = 2.75;                       // how far above his feet the hero's raised hands are
const CHEERS = ['Nice!', 'Super!', 'Awesome!', 'Amazing!', 'WOW!', 'Unstoppable!'], WHEE = ['Wheee!', 'Woohoo!', 'Yippee!', 'Zoom!'];
let renderer, scene, camera, sunLight, airLight, city = null, heroModel, rope, ropeEnd, sparks, shadow, aim, trail = [];
let save, mission, hero, phase = 'loading', paused = false, holding = false, clock = 0, last = 0, missionStars = 0, starRun = 0, lastStarAt = -9, hintUntil = 0, doneAt = 0;
let padAt = -9, pad = null, combo = 0, swung = false, ropeGrow = 1, lesson = 'ready', lessonAt = 0, zoom = 1, trailAt = 0, comboUntil = 0;
const spark = { at: [], go: [], life: [] };
try { save = normalizeSave(localStorage.getItem(SAVE_KEY)); } catch { save = normalizeSave(null); }
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...more });
const setPhase = next => { phase = next; document.body.dataset.phase = next; };

/* ---------- words and sparks that pop up where things happen ---------- */
function pop(text, x, y, kind = '') {
  const pops = $('pops'); if (pops.children.length > 9) pops.firstChild.remove();
  tmp.set(x, y, 0).project(camera);
  const el = document.createElement('span'); el.className = 'pop ' + kind; el.textContent = text;
  el.style.left = `${Math.max(8, Math.min(92, (tmp.x * .5 + .5) * 100))}%`; el.style.top = `${Math.max(14, Math.min(84, (-tmp.y * .5 + .5) * 100))}%`;
  pops.append(el); setTimeout(() => el.remove(), 1100);
}
function shout(text) { const el = $('combo'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); comboUntil = clock + 1.5; }
function burst(x, y, count, colors, speed = 7) {
  if (reduced) return;
  for (let i = 0; i < count; i++) { const a = rand() * Math.PI * 2, v = speed * (.4 + rand() * .6); spark.at.push(new THREE.Vector3(x, y, .6)); spark.go.push(new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v + 2, (rand() - .5) * 3)); spark.life.push({ t: .7 + rand() * .4, c: colors[i % colors.length] }); }
  while (spark.at.length > 180) { spark.at.shift(); spark.go.shift(); spark.life.shift(); }
}
function dressHero() { const s = SUITS.find(x => x.id === save.suit) || SUITS[0]; heroModel.suit.color.set(s.suit); heroModel.cape.color.set(s.cape); }

/* ---------- what the rules report ---------- */
function happened(events) {
  for (const e of events) {
    if (e === 'throw') { sound.throwRope(); hintUntil = 0; ropeGrow = 0; swung = true; heroModel.squash = -.35; if (lesson === 'hold') { lesson = 'done'; $('teach').classList.remove('show'); shout('Wheee!'); } }
    else if (e === 'let go') { sound.letGo(); if (Math.hypot(hero.vx, hero.vy) > 9) { heroModel.flip = 1; if (rand() < .5) pop(WHEE[Math.floor(rand() * WHEE.length)], hero.x, hero.y + 4.5, 'word'); } }
    else if (e === 'land') {
      sound.land(); heroModel.squash = .6; burst(hero.x, hero.y + .2, 8, ['#ffffff', '#efe7d6'], 3.5);
      // Roof to roof without touching the street is a streak, and every link in it is worth a star.
      if (swung && hero.on >= 0) { combo++; if (combo >= 2) { shout(`${CHEERS[Math.min(combo - 2, CHEERS.length - 1)]} ×${combo}`); save = earn(save, 1); missionStars++; store(); showStars(); pop('+1', hero.x, hero.y + 4, 'star'); } }
      swung = false;
    }
    else if (e === 'stick') { sound.stick(); heroModel.squash = .35; combo = 0; swung = false; }
    else if (e === 'leap') { sound.leap(); heroModel.squash = -.3; }
    else if (e === 'bounce') { sound.bounce(); padAt = clock; pad = mission.bouncers.find(p => hero.x >= p.x0 && hero.x <= p.x1); heroModel.squash = -.5; heroModel.flip = 1; combo = 0; swung = false; burst(hero.x, 1.1, 12, ['#3f9fe0', '#ffffff', '#ffd23f'], 6.5); pop('Boing!', hero.x, 3.5, 'word'); }
    else if (e === 'finish') finish();
  }
}
function showStars() { $('stars').textContent = save.stars; const pill = $('starPill'); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
function caught(found) {
  for (const f of found) {
    save = earn(save, f.value); missionStars += f.value;
    if (f.kind === 'star') {
      starRun = clock - lastStarAt < 1.6 ? starRun + 1 : 0; lastStarAt = clock;
      if (f.thing.big) { sound.bigStar(); pop('+5', f.thing.x, f.thing.y, 'star big'); } else { sound.star(starRun); pop('+1', f.thing.x, f.thing.y, 'star'); }
      burst(f.thing.x, f.thing.y, f.thing.big ? 18 : 7, ['#ffd23f', '#fff6c9', '#ffffff']);
    } else {
      save = rescue(save, f.thing.id); sound.friend(); shout(`${f.thing.name} is safe! ${f.thing.icon}`); pop('+5', f.thing.x, f.thing.y + 1.5, 'star big');
      burst(f.thing.x, f.thing.y, 26, ['#ff7a45', '#ffd23f', '#58c7a0', '#5b8def', '#ffffff'], 9); f.thing.savedAt = clock; showTrack();
    }
  }
  if (found.length) { store(); showStars(); }
}
function finish() {
  setPhase('done'); doneAt = clock; save = finishMission(save); missionStars += FINISH_STARS; store(); showStars(); sound.finish(); sound.play(false); shout('You did it! 🎉');
}
// The bar along the top: how far along the street he is, where each friend waits, and the flag at the end.
function showTrack() {
  $('trackMarks').innerHTML = mission.friends.map(f => `<em class="${f.taken ? 'safe' : ''}" style="left:${Math.min(94, f.x / mission.finish.x * 100)}%">${f.icon}</em>`).join('');
}
function showFinish() {
  const got = mission.friends.filter(f => f.taken), fresh = SUITS.find(s => s.cost && !save.owned.includes(s.id) && save.stars >= s.cost);
  $('finishKicker').textContent = `MISSION ${mission.number} DONE`;
  $('finishTitle').textContent = got.length === 3 ? 'You saved everyone!' : 'You saved the day!';
  $('finishFriends').innerHTML = mission.friends.map((f, i) => `<span class="${f.taken ? '' : 'missed'}" style="animation-delay:${.15 + i * .18}s" title="${f.name}">${f.icon}</span>`).join('');
  $('finishNote').textContent = fresh ? `You can wear the ${fresh.name} suit now!` : '';
  $('finishTotal').textContent = '';
  $('finishCard').showModal();
  // The stars count up.
  const total = missionStars, began = performance.now(); (function count(now) { const k = reduced ? 1 : Math.min(1, (now - began) / 900); $('finishStars').textContent = `+${Math.round(total * k)} ⭐`; if (k < 1 && $('finishCard').open) requestAnimationFrame(count); else $('finishTotal').textContent = `You have ${save.stars} stars`; })(began);
}
function renderSuits() {
  $('bank').textContent = save.stars;
  $('suits').innerHTML = SUITS.map(s => {
    const mine = !s.cost || save.owned.includes(s.id), ready = !mine && save.stars >= s.cost, fill = s.id === 'rainbow' ? 'conic-gradient(#ff5f5f,#ffd24a,#58d68d,#4aa8ff,#b06bff,#ff5f5f)' : s.suit;
    return `<button data-suit="${s.id}" class="${mine ? '' : ready ? 'locked ready' : 'locked'}" style="background:${fill}" aria-label="${s.name} suit${mine ? '' : `, ${ready ? 'ready to unlock' : 'locked'}, needs ${s.cost} stars`}" aria-pressed="${s.id === save.suit}">${mine ? '' : '🔒<br>' + s.cost}<i style="background:${s.cape}"></i></button>`;
  }).join('');
}
// Opens the card for a mission: who needs help, and the suit to wear. The hero waits on the first roof, waving.
function openMission(number) {
  mission = makeMission(number); hero = startHero(mission); missionStars = 0; starRun = 0; combo = 0; swung = false; pad = null; holding = false; paused = false; lesson = save.missions === 0 && number === 1 ? 'ready' : 'done';
  city?.dispose(); city = buildCity({ scene, camera, mission, reduced });
  const look = city.look; document.body.dataset.theme = mission.theme; scene.fog.color.set(look.fog); sunLight.color.set(look.sun); sunLight.intensity = look.power; airLight.color.set(look.sky); airLight.groundColor.set(look.ground); airLight.intensity = look.air;
  setPhase('start'); dressHero(); showTrack(); $('stars').textContent = save.stars; $('trackHero').style.left = '0%'; $('trackFill').style.width = '0%'; $('teach').classList.remove('show');
  const names = mission.friends.map(f => f.name);
  $('startKicker').textContent = `MISSION ${mission.number}`;
  $('startTitle').textContent = mission.number === 1 ? 'To the rescue!' : ['The city needs you!', 'Up, up and away!', 'Time to be a hero!'][mission.number % 3];
  $('startText').textContent = `${names[0]}, ${names[1]} and ${names[2]} need help.`;
  $('startFriends').innerHTML = mission.friends.map(f => `<span>${f.icon}</span>`).join('');
  $('suitNote').textContent = ''; renderSuits();
  for (const id of ['finishCard', 'menu']) if ($(id).open) $(id).close();
  if (!$('startCard').open) $('startCard').show();
  frameCamera(true); sound.play(false);
}
function play() { $('startCard').close(); setPhase('play'); paused = false; holding = false; last = performance.now(); hintUntil = lesson === 'done' ? clock + 7 : 0; sound.play(true, mission.theme); }
function pause() { if (phase !== 'play' || paused) return; paused = true; holding = false; sound.play(false); $('menu').showModal(); }
function resume() { $('menu').close(); paused = false; last = performance.now(); sound.play(true, mission.theme); }
async function setSound(on) {
  try { await sound.set(on); } catch { return; }
  if (save.sound !== sound.on) { save = normalizeSave({ ...save, sound: sound.on }); store(); }
  $('sound').setAttribute('aria-pressed', sound.on); $('sound').setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on');
  if (sound.on) sound.play(phase === 'play' && !paused, mission.theme);
}

/* ---------- camera ---------- */
const view = { x: 0, y: 10, far: 30 };
function frameCamera(immediate, dt = 0) {
  const aspect = innerWidth / innerHeight, tall = aspect < 1, ease = k => immediate ? 1 : 1 - Math.exp(-k * dt);
  if (phase === 'start') {
    // Before the mission the camera comes in close, with the hero held clear of the card.
    const far = tall ? 24 : 14; view.far += (far - view.far) * ease(3); view.x += (hero.x + (tall ? 0 : 3.4) - view.x) * ease(4); view.y += (hero.y + (tall ? -2.6 : 1.6) - view.y) * ease(4);
    camera.position.set(view.x + 2, view.y + 1.5, view.far); camera.lookAt(view.x, view.y, 0);
  } else {
    // In play he sits a third of the way across with the way ahead in view; the camera draws back a little at speed.
    const speed = Math.hypot(hero.vx, hero.vy), want = 1 + (hero.mode === 'swing' || hero.mode === 'air' ? Math.min(.16, speed * .012) : 0); zoom += (want - zoom) * ease(2.5);
    const far = Math.max(17.5, (tall ? 14.5 : 30) / aspect) / .849 * zoom, half = far * .849 * aspect / 2;
    view.far += (far - view.far) * ease(3); view.x += (hero.x + half * (tall ? .42 : .36) - view.x) * ease(7); view.y += (Math.max(7.5, hero.y + (tall ? 5.2 : 3.6)) - view.y) * ease(3.4);
    camera.position.set(view.x - view.far * .1, view.y + 1.6, view.far); camera.lookAt(view.x, view.y - .8, 0);
  }
  scene.fog.near = view.far + 45; scene.fog.far = view.far + 210; city.sky.position.set(tall ? -13 : -46, tall ? 36 : 21, -120);
  sunLight.position.set(view.x + 28, 60, 44); sunLight.target.position.set(view.x, 0, 0);
}

/* ---------- one frame ---------- */
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
  if (phase === 'loading') return;
  if (!paused) {
    clock += dt;
    if (phase === 'play') {
      // The very first gap is a lesson: time nearly stops at the roof's edge until the screen is held.
      const roof = mission.buildings[0];
      if (lesson === 'ready' && hero.mode === 'run' && hero.on === 0 && hero.x > roof.x1 - 2.6) { lesson = 'hold'; lessonAt = clock; $('teach').classList.add('show'); }
      if (lesson === 'hold' && (clock - lessonAt > 6 || hero.mode !== 'run')) { lesson = 'done'; $('teach').classList.remove('show'); hintUntil = clock + 6; }
      const pace = lesson === 'hold' && !holding ? .06 : 1;
      for (let left = dt * pace; left > 1e-5; left -= 1 / 60) { const out = stepHero(mission, hero, holding, Math.min(left, 1 / 60)); hero = out.hero; happened(out.events); caught(gather(mission, hero)); if (phase !== 'play') break; }
      const along = Math.max(0, Math.min(1, hero.x / mission.finish.x)) * 100; $('trackHero').style.left = `${along}%`; $('trackFill').style.width = `${along}%`;
    } else if (phase === 'done' && clock - doneAt > 2.4 && !$('finishCard').open) showFinish();
    if (phase === 'done' && !reduced && Math.floor(clock * 3.5) !== Math.floor((clock - dt) * 3.5)) burst(hero.x + (rand() - .5) * 16, hero.y + 5 + rand() * 8, 20, ['#ff7a45', '#ffd23f', '#58c7a0', '#5b8def', '#f2559c'], 9);
    // The hero, his rope, his shadow and the dotted line to the hook a rope would catch.
    const tied = hero.mode === 'swing', hook = tied ? mission.hooks[hero.hook] : null, speed = Math.hypot(hero.vx, hero.vy);
    poseHero(heroModel, { what: phase === 'done' ? 'cheer' : phase === 'start' ? 'wait' : hero.mode, x: hero.x, y: hero.y, vx: hero.vx, vy: hero.vy, rope: tied ? Math.atan2(hook.x - hero.x, hook.y - hero.y - HAND) : 0, holding, t: clock, dt, reduced });
    if (save.suit === 'rainbow') { heroModel.suit.color.setHSL((clock * .2) % 1, .8, .55); heroModel.cape.color.setHSL((clock * .2 + .5) % 1, .9, .6); }
    ropeGrow = Math.min(1, ropeGrow + dt * 11); rope.visible = ropeEnd.visible = tied;
    if (tied) { tmp.set(hook.x - hero.x, hook.y - hero.y - HAND, 0); const long = tmp.length() * ropeGrow; tmp.normalize(); rope.position.set(hero.x + tmp.x * long / 2, hero.y + HAND + tmp.y * long / 2, 0); rope.scale.set(1, long, 1); rope.quaternion.setFromUnitVectors(UP, tmp); ropeEnd.position.set(hero.x + tmp.x * long, hero.y + HAND + tmp.y * long, 0); ropeEnd.rotation.z = clock * 6; }
    const under = mission.buildings.find(b => hero.x >= b.x0 && hero.x <= b.x1 && hero.y >= b.top - .1), floor = under ? under.top : 0, high = hero.y - floor;
    shadow.visible = high < 16; shadow.position.set(hero.x, floor + .06, 0); shadow.scale.setScalar(Math.max(.35, 1.5 - high * .07)); shadow.material.opacity = Math.max(0, .32 - high * .02);
    const next = phase === 'play' && !tied && hero.mode !== 'climb' ? hookFor(mission, hero) : -1;
    for (let i = 0; i < 7; i++) {
      if (next >= 0) { const h = mission.hooks[next], k = (i + 1 + (reduced ? 0 : (clock * 1.6) % 1)) / 8; dummy.position.set(hero.x + (h.x - hero.x) * k, hero.y + HAND + (h.y - hero.y - HAND) * k, .3); dummy.scale.setScalar(.2 + k * .12); } else dummy.scale.setScalar(0);
      dummy.updateMatrix(); aim.setMatrixAt(i, dummy.matrix);
    }
    aim.instanceMatrix.needsUpdate = true; dummy.scale.setScalar(1);
    // A streak of light behind him when he is going fast.
    if (!reduced && phase === 'play' && speed > 11 && clock - trailAt > .035) { trailAt = clock; const t = trail.find(s => s.material.opacity <= 0); if (t) { t.position.set(hero.x, hero.y + BODY * BIG, -.3); t.material.opacity = .55; t.material.color.copy(heroModel.cape.color); t.scale.setScalar(2.6); } }
    for (const t of trail) if (t.material.opacity > 0) { t.material.opacity -= dt * 1.5; t.scale.multiplyScalar(1 - dt * 1.2); }
    city.update({ dt, clock, hero, phase, next, pad, padAt });
    for (let i = spark.at.length - 1; i >= 0; i--) { spark.life[i].t -= dt; if (spark.life[i].t <= 0) { spark.at.splice(i, 1); spark.go.splice(i, 1); spark.life.splice(i, 1); continue; } spark.go[i].y -= 14 * dt; spark.at[i].addScaledVector(spark.go[i], dt); }
    for (let i = 0; i < 180; i++) { if (i < spark.at.length) { dummy.position.copy(spark.at[i]); dummy.scale.setScalar(.24 * Math.min(1, spark.life[i].t * 2.5)); sparks.setColorAt(i, paint.set(spark.life[i].c)); } else dummy.scale.setScalar(0); dummy.updateMatrix(); sparks.setMatrixAt(i, dummy.matrix); }
    sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true; dummy.scale.setScalar(1);
    frameCamera(false, dt);
  }
  if (clock > comboUntil) $('combo').classList.remove('show');
  $('hint').classList.toggle('show', phase === 'play' && !paused && clock < hintUntil);
  renderer.render(scene, camera);
}

/* ---------- input ---------- */
function setup() {
  const press = e => { if (phase !== 'play' || paused) return; e.preventDefault?.(); holding = true; }, release = () => { holding = false; };
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture?.(e.pointerId); press(e); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
  addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowUp') { if (phase === 'play' && !paused) e.preventDefault(); if (!e.repeat) press(e); } else if (e.key === 'Escape' && phase === 'play' && !paused) { e.preventDefault(); pause(); } });
  addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'ArrowUp') release(); });
  // A player who chose sound last time gets it back with the first tap or key press.
  let woke = false; const wake = e => { if (woke || !save.sound || e.target?.closest?.('#sound')) return; woke = true; setSound(true); };
  for (const name of ['pointerup', 'keydown']) addEventListener(name, wake);
  $('sound').addEventListener('click', () => { woke = true; setSound(!sound.on); });
  $('pause').addEventListener('click', pause); $('resume').addEventListener('click', resume);
  $('restart').addEventListener('click', () => openMission(mission.number));
  $('play').addEventListener('click', () => { sound.tap(); play(); });
  $('next').addEventListener('click', () => { sound.tap(); openMission(save.missions + 1); });
  $('suits').addEventListener('click', e => {
    const b = e.target.closest('[data-suit]'); if (!b) return;
    const suit = SUITS.find(s => s.id === b.dataset.suit), had = save.owned.includes(suit.id), before = save.suit; save = chooseSuit(save, suit.id); store();
    $('suitNote').textContent = save.suit !== suit.id ? `${suit.cost - save.stars} more stars for the ${suit.name} suit` : suit.cost && !had ? `You unlocked the ${suit.name} suit!` : '';
    if (save.suit !== before) { sound.tap(); heroModel.squash = -.4; burst(hero.x, hero.y + 2, 14, [suit.suit, suit.cape, '#ffffff'], 5); } dressHero(); renderSuits();
  });
  $('finishCard').addEventListener('cancel', e => e.preventDefault());
  $('menu').addEventListener('cancel', e => { e.preventDefault(); resume(); });
  addEventListener('blur', () => { holding = false; pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { holding = false; pause(); } });
  addEventListener('pagehide', store);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
}
function fail() { setPhase('loading'); $('loading').classList.remove('done'); $('loadText').textContent = 'Please reload the page to play.'; }
function init() {
  setup();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(LOOK.day.fog, 60, 240);
    camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .5, 700); scene.add(camera);
    airLight = new THREE.HemisphereLight('#ffffff', '#6f9a80', 2); scene.add(airLight);
    sunLight = new THREE.DirectionalLight('#fff4dc', 2.6); sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunLight.shadow.camera, { left: -42, right: 42, top: 44, bottom: -22, far: 170 }); sunLight.shadow.bias = -.0004; sunLight.shadow.normalBias = .05; scene.add(sunLight, sunLight.target);
    heroModel = makeHero(); scene.add(heroModel.g);
    rope = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1, 8), mat('#fff6d6', { emissive: '#ffd98a', emissiveIntensity: .5 })); ropeEnd = new THREE.Mesh(STAR, mat('#ffd23f', { emissive: '#c98a00', emissiveIntensity: .7 })); ropeEnd.scale.setScalar(.55); rope.visible = ropeEnd.visible = false; scene.add(rope, ropeEnd);
    shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#1b2233', transparent: true, opacity: .3, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    aim = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85 }), 7); aim.frustumCulled = false; scene.add(aim);
    const dot = document.createElement('canvas'); dot.width = dot.height = 64; const g = dot.getContext('2d'), fill = g.createRadialGradient(32, 32, 0, 32, 32, 32); fill.addColorStop(0, '#ffffffcc'); fill.addColorStop(1, '#ffffff00'); g.fillStyle = fill; g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(dot); for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(s); trail.push(s); }
    sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial(), 180); sparks.frustumCulled = false; sparks.setColorAt(0, paint.set('#fff')); scene.add(sparks);
    // For checking the game by hand from the browser console.
    window.citySwinger = { get hero() { return hero; }, get mission() { return mission; }, get save() { return save; }, get phase() { return phase; }, get lesson() { return lesson; }, sound, hold(on) { holding = on; } };
    openMission(save.missions + 1);
    $('loading').classList.add('done'); $('loading').inert = true;
    requestAnimationFrame(animate);
  } catch (error) { console.error('City Swinger could not start', error); fail(); }
}
init();
