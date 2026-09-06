import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clamp, angleDelta, groundHeight, initialFlight, stepFlight, touchesTarget, TRAIL, PICNIC, RUNWAY, AIRPORT_APPROACH, runwayLanding, runwayTakeoff } from './flight.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer, scene, camera, plane, propeller, water, sun, beacon;
let state = initialFlight(), phase = 'loading', collected = 0, guided = false;
let paused = false, soundOn = false, pointer = null, toastUntil = 0, hintUntil = 12;
let elapsed = 0, lastTime = 0, lastMap = 0, landingTime = 0, landingStart;
let freeFlight = false, input = { x: 0, y: 0 }, keys = new Set();
let obstacles = [];
let airportLeg = -1;
let audio, engine, engineGain;
const rings = [], clouds = [], boats = [], birds = [], particles = [];
const particleGeometry = new THREE.SphereGeometry(.15, 5, 4);
const v = new THREE.Vector3(), cameraGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3();
const currentLook = new THREE.Vector3(), currentCamera = new THREE.Vector3();
const map = $('map').getContext('2d');
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...options });
const rand = (() => { let n = 947; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();

function mesh(geometry, material, x, y, z, parent = scene) {
  const o = new THREE.Mesh(geometry, material); o.position.set(x, y, z); parent.add(o); return o;
}
function say(text) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .86; utterance.pitch = 1.1; utterance.volume = .85;
  speechSynthesis.speak(utterance);
}
function chime(win = false) {
  if (!soundOn || !audio) return;
  (win ? [523, 659, 784, 1047] : [659, 880]).forEach((frequency, i) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const t = audio.currentTime + i * .10;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.09, t + .01);
    gain.gain.exponentialRampToValueAtTime(.001, t + .35);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(t); oscillator.stop(t + .4);
  });
}
function updateSound() {
  if (engineGain && audio) engineGain.gain.setTargetAtTime(soundOn && !paused && ['flying', 'landing', 'takeoff'].includes(phase) ? .017 : 0, audio.currentTime, .15);
}
async function toggleSound() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      engine = audio.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 65;
      engineGain = audio.createGain(); engineGain.gain.value = 0;
      engine.connect(engineGain).connect(audio.destination); engine.start();
    }
    await audio.resume(); soundOn = !soundOn;
    $('sound').setAttribute('aria-pressed', soundOn);
    $('sound').setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    updateSound();
    if (soundOn) say(freeFlight ? 'The island is yours to explore!' : 'Let’s take Bear a picnic. Follow the golden rings!');
    else if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch { toast('Sound is unavailable. You can still fly!'); }
}
function toast(text, seconds = 3) {
  $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = elapsed + seconds;
}

function makeOcean() {
  // Small geometric waves; no textures, network services, or expensive reflections.
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: new THREE.Color('#bde5df') } },
    vertexShader: `uniform float time; varying vec3 world; varying float depth;
      void main(){ vec3 p=position; p.z += sin(p.x*.065+time*.7)*.10 + cos(p.y*.08+time*.5)*.08;
        vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;vec4 mv=viewMatrix*w;depth=-mv.z;gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float time; uniform vec3 fogColor; varying vec3 world; varying float depth;
      void main(){ float ripple=sin(world.x*.45+world.z*.19+time)*sin(world.z*.37-time*.6);
        vec3 col=mix(vec3(.16,.66,.69),vec3(.29,.77,.77),ripple*.5+.5);
        float glint=pow(max(0.,sin(world.x*.76+world.z*.35+time*.8)),28.)*pow(max(0.,cos(world.z*.86-time*.6)),18.);
        col+=vec3(.20,.20,.13)*glint; col=mix(col,fogColor,smoothstep(100.,350.,depth));gl_FragColor=vec4(col,1.); }`
  });
  water = mesh(new THREE.PlaneGeometry(1200, 1200, 90, 90), material, 0, -.1, 0);
  water.rotation.x = -Math.PI / 2;
  // A wide translucent turquoise shelf makes the sandy island read against the sea.
  const shelf = mesh(new THREE.CircleGeometry(1, 80), new THREE.MeshBasicMaterial({ color: '#71d2c5', transparent: true, opacity: .37, depthWrite: false }), 0, .12, 0);
  shelf.rotation.x = -Math.PI / 2; shelf.scale.set(101, 83, 1);
}
function makeClouds() {
  const geometry = new THREE.SphereGeometry(1, 12, 8), material = mat('#fff9e9', { flatShading: false });
  for (let i = 0; i < 23; i++) {
    const group = new THREE.Group();
    const angle = rand() * Math.PI * 2, radius = 80 + rand() * 190;
    group.position.set(Math.sin(angle) * radius, 43 + rand() * 32, Math.cos(angle) * radius);
    for (let j = 0; j < 4; j++) {
      const puff = mesh(geometry, material, (j - 1.5) * 3.4, j % 2 ? 1.5 : 0, 0, group);
      puff.scale.set(4 + rand() * 2, 2.3 + rand() * 1.8, 2.8 + rand() * 2);
    }
    group.userData.speed = .2 + rand() * .4; scene.add(group); clouds.push(group);
  }
}
function makeExtras() {
  const ivory = mat('#fff7dd'), coral = mat('#e96949'), dark = mat('#356263');
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    const hull = mesh(new THREE.SphereGeometry(1, 12, 6), coral, 0, .3, 0, group); hull.scale.set(1.3, .55, 2.8);
    mesh(new THREE.CylinderGeometry(.065, .065, 5), dark, 0, 2.8, 0, group);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, 5.1, 0, 2.4, 1.1, 0], 3)); sailGeo.computeVertexNormals();
    mesh(sailGeo, new THREE.MeshStandardMaterial({ color: '#fff6da', side: THREE.DoubleSide }), 0, 0, 0, group);
    group.position.set(-115 + i * 54, .2, i % 2 ? -103 : 104); group.rotation.y = i * 1.3;
    scene.add(group); boats.push(group);
  }
  // A rainbow over the sea, made of open arcs.
  ['#ed7767', '#f6b451', '#f2da74', '#81bd86', '#69babe'].forEach((color, i) => {
    const arc = mesh(new THREE.TorusGeometry(21 - i * 1.05, .65, 6, 50, Math.PI), mat(color), 109, 2, -68);
    arc.rotation.y = -.5;
  });
  const balloon = new THREE.Group();
  const globe = mesh(new THREE.SphereGeometry(1, 18, 12), mat('#ed7654'), 0, 0, 0, balloon); globe.scale.set(4.1, 5.2, 4.1);
  mesh(new THREE.CylinderGeometry(.8, .6, 1.3, 8), mat('#bd8753'), 0, -7.2, 0, balloon);
  for (const x of [-.7, .7]) mesh(new THREE.CylinderGeometry(.035, .035, 2), ivory, x, -5.8, 0, balloon);
  balloon.position.set(-105, 35, 30); scene.add(balloon);
  for (let i = 0; i < 8; i++) {
    const group = new THREE.Group();
    for (let side of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(.32, 1.5, 3), ivory, side * .5, 0, 0, group); wing.rotation.z = side * 1.3;
    }
    group.userData.offset = i * .7; scene.add(group); birds.push(group);
  }
}
function makeTrail() {
  const geometry = new THREE.TorusGeometry(4.3, .22, 10, 56);
  TRAIL.forEach((target, i) => {
    const ring = mesh(geometry, mat('#ffc947', { emissive: '#c98516', emissiveIntensity: .25 }), target.x, target.y, target.z);
    const before = i === 0 ? initialFlight() : TRAIL[i - 1];
    ring.lookAt(before.x, target.y, before.z);
    const dots = new THREE.Group();
    for (let j = 0; j < 8; j++) {
      const a = j / 8 * Math.PI * 2;
      mesh(new THREE.SphereGeometry(.13, 6, 4), mat('#fff7d6', { emissive: '#ffce65', emissiveIntensity: .45 }), Math.cos(a) * 4.85, Math.sin(a) * 4.85, 0, dots);
    }
    ring.add(dots); rings.push(ring);
  });
  beacon = new THREE.Group(); beacon.position.set(PICNIC.x, groundHeight(PICNIC.x, PICNIC.z) + .3, PICNIC.z);
  const pad = mesh(new THREE.RingGeometry(6, 6.35, 60), new THREE.MeshBasicMaterial({ color: '#ffe29b', side: THREE.DoubleSide }), 0, .1, 0, beacon); pad.rotation.x = -Math.PI / 2;
  const beam = mesh(new THREE.CylinderGeometry(1.5, 6, 20, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe4a4', transparent: true, opacity: .10, side: THREE.DoubleSide, depthWrite: false }), 0, 10, 0, beacon);
  beam.name = 'Delivery glow'; scene.add(beacon); beacon.visible = false;
}
function burst(at) {
  for (let i = 0; i < 24; i++) {
    const p = mesh(particleGeometry, mat(i % 2 ? '#ffd260' : '#fff4d2', { emissive: '#a26c10', emissiveIntensity: .3 }), at.x, at.y, at.z);
    p.userData.velocity = new THREE.Vector3((rand() - .5) * 9, (rand() - .2) * 8, (rand() - .5) * 9);
    p.userData.life = 1; particles.push(p);
  }
}
function setGuided(on) {
  guided = on; $('guide').setAttribute('aria-pressed', on);
  $('guide').innerHTML = on ? '<span>✧</span> Helping you' : '<span>✧</span> Guide me';
}
function updateMission() {
  const airport = airportLeg >= 0;
  $('land').disabled = phase !== 'flying';
  $('land').innerHTML = airport && phase === 'flying' ? '<span>↗</span> Keep flying' : '<span>↘</span> Land';
  $('guide').disabled = airport || phase !== 'flying';
  document.querySelector('.ring-counter').hidden = airport;
  $('progress').style.visibility = airport ? 'hidden' : '';
  $('count').textContent = collected;
  [...$('progress').children].forEach((p, i) => p.classList.toggle('done', i < collected));
  rings.forEach((r, i) => {
    r.visible = !airport && !freeFlight && i >= collected;
    r.material.emissiveIntensity = i === collected ? .65 : .05;
  });
  beacon.visible = !airport && !freeFlight && collected === TRAIL.length;
  if (airport) {
    $('missionKicker').textContent = phase === 'takeoff' ? 'READY, SET, FLY!' : 'SUNNY AIRPORT';
    $('missionTitle').textContent = phase === 'takeoff' ? 'Up into the sky!' : phase === 'landing' ? 'Wheels down!' : 'Let’s land the plane';
    $('missionSubtitle').textContent = phase === 'takeoff' ? 'Speeding up along the runway' : phase === 'landing' ? 'A gentle landing on the runway' : airportLeg === 0 ? 'Flying around to line up' : 'Lined up. Coming in to land.';
    $('missionIcon').textContent = phase === 'takeoff' ? '🛫' : '🛬';
    return;
  }
  $('missionKicker').textContent = freeFlight ? 'THE SKY IS YOURS' : collected === 5 ? 'BEAR IS WAITING!' : 'SPECIAL DELIVERY';
  $('missionTitle').textContent = freeFlight ? 'Where shall we fly?' : 'A picnic for Bear';
  $('missionSubtitle').textContent = freeFlight ? 'Explore the island. Find a surprise.' : collected === 5 ? 'Fly into the golden glow' : 'Follow the golden rings';
  $('missionIcon').textContent = freeFlight ? '☀️' : '🐻';
}
function getTarget() {
  if (airportLeg >= 0) return AIRPORT_APPROACH[Math.min(airportLeg, AIRPORT_APPROACH.length - 1)];
  return freeFlight ? { x: 22, y: 14, z: 40 } : collected < TRAIL.length ? TRAIL[collected] : PICNIC;
}
function visitAirport() {
  if (phase !== 'flying') return;
  airportLeg = 0; clearInput(); setGuided(true); updateMission();
  toast('Let’s line up with the runway. 🛬', 4);
  say('Time to land! I’ll line us up with the runway.');
}
function takeControl() {
  setGuided(false);
  if (airportLeg >= 0 && phase === 'flying') { airportLeg = -1; updateMission(); }
}
function clearInput() {
  keys.clear(); input = { x: 0, y: 0 }; pointer = null; $('joystick').style.display = 'none';
}
function openMenu(help = false) {
  if (phase === 'loading' || phase === 'error' || $('celebration').open) return;
  paused = true; clearInput(); updateSound();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('instructions').hidden = !help;
  $('menuKicker').textContent = help ? 'SMALL HANDS. BIG ADVENTURES.' : 'TAKE A LITTLE BREATHER';
  $('menuTitle').textContent = help ? 'Let’s learn to fly.' : 'Parked in the clouds.';
  $('menuText').hidden = help;
  if (!$('menu').open) $('menu').showModal();
}
function resume() { $('menu').close(); paused = false; lastTime = performance.now(); updateSound(); }
function restart() {
  if ($('menu').open) $('menu').close(); if ($('celebration').open) $('celebration').close();
  clearInput(); state = initialFlight(); collected = 0; freeFlight = false; airportLeg = -1; phase = 'flying'; paused = false;
  setGuided(false); updateMission(); setCamera(true); hintUntil = elapsed + 10;
  toast('Let’s take Bear a picnic! 🧺', 4); updateSound();
}

function setupControls() {
  $('sound').addEventListener('click', toggleSound);
  $('pause').addEventListener('click', () => openMenu()); $('help').addEventListener('click', () => openMenu(true));
  $('resume').addEventListener('click', resume); $('restart').addEventListener('click', restart); $('again').addEventListener('click', restart);
  $('menu').addEventListener('cancel', e => { e.preventDefault(); resume(); });
  $('celebration').addEventListener('cancel', e => e.preventDefault());
  $('land').addEventListener('click', () => {
    if (phase !== 'flying' || paused) return;
    if (airportLeg >= 0) { takeControl(); toast('You’re the pilot!'); }
    else visitAirport();
  });
  $('guide').addEventListener('click', () => {
    if (phase !== 'flying' || paused) return;
    setGuided(!guided); clearInput();
    toast(guided ? 'I’ll help! Steer anytime to take over. ✧' : 'You’re the pilot!');
    if (guided) say('I’ll help you. You can steer whenever you like.');
  });
  $('explore').addEventListener('click', () => {
    if (phase !== 'parked') return;
    $('celebration').close(); paused = false; phase = 'takeoff'; landingTime = 0;
    landingStart = { ...state }; clearInput(); setGuided(false); updateMission(); toast('Rolling down the runway… 🛫', 4); updateSound();
  });
  canvas.addEventListener('pointerdown', e => {
    if (phase !== 'flying' || paused || pointer !== null) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId); takeControl();
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    $('joystick').style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px`;
    $('stick').style.transform = 'translate(-50%,-50%)'; hintUntil = elapsed + 1;
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = clamp((e.clientX - pointer.x) / 65, -1, 1), dy = clamp((pointer.y - e.clientY) / 65, -1, 1);
    input = { x: dx, y: dy }; $('stick').style.transform = `translate(calc(-50% + ${dx * 34}px),calc(-50% - ${dy * 34}px))`;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => {
    if (pointer?.id === e.pointerId) { pointer = null; input = { x: 0, y: 0 }; $('joystick').style.display = 'none'; }
  });
  const controlKeys = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape' && !$('menu').open && !$('celebration').open) { e.preventDefault(); openMenu(); return; }
    if (!controlKeys.includes(k) || paused || phase !== 'flying') return;
    e.preventDefault(); keys.add(k); takeControl(); hintUntil = elapsed + 1;
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { clearInput(); if (!paused && phase !== 'loading') openMenu(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); openMenu(); } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The sky needs a fresh start. Please reload this page.'); });
}
function setCamera(immediate = false, dt = 0) {
  const forward = v.set(Math.sin(state.heading), 0, -Math.cos(state.heading));
  const distance = innerWidth < 650 && innerHeight > innerWidth ? 13 : 11;
  cameraGoal.set(state.x - forward.x * distance, state.y + 4.6, state.z - forward.z * distance);
  cameraGoal.y = Math.max(cameraGoal.y, groundHeight(cameraGoal.x, cameraGoal.z) + 3);
  lookGoal.set(state.x + forward.x * 13, state.y + 1.5, state.z + forward.z * 13);
  const blend = immediate ? 1 : 1 - Math.exp(-4 * dt);
  currentCamera.lerp(cameraGoal, blend); currentLook.lerp(lookGoal, blend);
  camera.position.copy(currentCamera); camera.lookAt(currentLook);
}
function drawMap() {
  const c = map, toX = x => 80 + x * .54, toY = z => 80 + z * .54;
  c.clearRect(0, 0, 160, 160); c.fillStyle = '#91ccb7'; c.beginPath();
  for (let i = 0; i <= 70; i++) {
    const a = i / 70 * Math.PI * 2, r = 1 + .055 * Math.sin(a * 3) + .035 * Math.cos(a * 7);
    c.lineTo(toX(Math.cos(a) * 90 * r), toY(Math.sin(a) * 72 * r));
  }
  c.closePath(); c.fill(); c.strokeStyle = '#e9d59a'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#657b67'; c.lineWidth = 5; c.beginPath(); c.moveTo(toX(RUNWAY.x), toY(16)); c.lineTo(toX(RUNWAY.x), toY(60)); c.stroke();
  if (!freeFlight || airportLeg >= 0) {
    c.strokeStyle = '#fff5c5aa'; c.lineWidth = 1.3; c.setLineDash([3, 4]); c.beginPath();
    const route = airportLeg >= 0 ? [...AIRPORT_APPROACH.slice(airportLeg), { x:22, z:26 }] : [...TRAIL.slice(collected), PICNIC];
    route.forEach(p => c.lineTo(toX(p.x), toY(p.z))); c.stroke(); c.setLineDash([]);
  }
  const target = getTarget(); c.fillStyle = '#fff4d1'; c.beginPath(); c.arc(toX(target.x), toY(target.z), 4, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(clamp(toX(state.x), 7, 153), clamp(toY(state.z), 7, 153)); c.rotate(state.heading);
  c.fillStyle = '#e6583f'; c.strokeStyle = '#fff9df'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function updateMarker() {
  const marker = $('targetMarker');
  if (phase !== 'flying' || (freeFlight && !guided)) { marker.style.display = 'none'; return; }
  const target = getTarget(); v.set(target.x, target.y, target.z);
  const distance = v.distanceTo(plane.position); v.project(camera);
  // The clamped compass marker remains useful when the next ring is behind us.
  const behind = v.z > 1;
  let x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight;
  if (behind) {
    const delta = angleDelta(Math.atan2(target.x - state.x, -(target.z - state.z)), state.heading);
    x = delta > 0 ? innerWidth - 35 : 35; y = innerHeight * .52;
  }
  marker.style.display = 'flex'; marker.style.left = `${clamp(x, 30, innerWidth - 40)}px`;
  marker.style.top = `${clamp(y - 72, innerWidth < 650 ? 200 : 90, innerHeight - 150)}px`;
  marker.style.transform = 'translateX(-50%)';
  marker.firstElementChild.textContent = behind ? (x > innerWidth / 2 ? '→' : '←') : airportLeg >= 0 ? '🛬' : collected === 5 && !freeFlight ? '🧺' : '◎';
  $('distance').textContent = `${Math.round(distance)} m`;
}
function updateFlight(dt) {
  const previous = state;
  const keyboard = keys.size > 0;
  const steer = keyboard ? {
    x: Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a')),
    y: Number(keys.has('arrowup') || keys.has('w')) - Number(keys.has('arrowdown') || keys.has('s'))
  } : input;
  state = stepFlight(state, steer, dt, guided ? getTarget() : null, obstacles);
  if (state.returning && !previous.returning) toast('Let’s stay near our island. ☀️');
  if (airportLeg >= 0) {
    if (touchesTarget(previous, state, getTarget(), 4.5)) {
      if (airportLeg === 0) { airportLeg = 1; updateMission(); toast('There’s the runway. Coming in! 🛬'); }
      else if (Math.abs(angleDelta(0, state.heading)) < .45) {
        phase = 'landing'; landingTime = 0; landingStart = { ...state }; clearInput(); updateMission();
        toast('A gentle landing… 🛬', 4); updateSound();
      } else { airportLeg = 0; updateMission(); toast('One more turn to line up. ✈'); }
    }
    return;
  }
  if (freeFlight) {
    if (guided && touchesTarget(previous, state, getTarget(), 9)) visitAirport();
  } else if (touchesTarget(previous, state, getTarget(), collected === 5 ? 9 : 5.8)) {
    if (collected < 5) {
      burst(TRAIL[collected]); collected++; chime(); updateMission();
      toast(['', 'Through the first ring! ✨', 'Lovely flying! ✨', 'Look at you go! ✨', 'One more golden ring! ✨', 'There’s Bear! Follow the golden glow. 🐻'][collected]);
      if (collected === 5) say('There’s Bear! Fly into the golden glow to drop off the picnic.');
    } else {
      freeFlight = true; chime(true); burst(PICNIC); visitAirport();
      toast('Picnic delivered! Let’s land at the airport. 🧺', 5);
      say('Bear has his picnic! Now let’s land at the airport.');
    }
  }
}
function updateLanding(dt) {
  landingTime += dt;
  if (phase === 'landing') {
    state = runwayLanding(landingStart, landingTime);
    if (state.finished) {
      phase = 'parked'; paused = true; setGuided(false); chime(true); burst(plane.position);
      $('landingMessage').textContent = freeFlight ? 'Bear has his picnic, and you’re back at Sunny Airport. Ready to explore?' : 'Wheels down. Right on the runway. Your adventure is waiting whenever you’re ready.';
      updateMission(); $('celebration').showModal(); say('What a lovely landing! Welcome to Sunny Airport.');
    }
  } else {
    state = runwayTakeoff(landingStart, landingTime);
    if (state.finished) { phase = 'flying'; airportLeg = -1; updateMission(); updateSound(); toast('You’re flying! ✈'); }
  }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (lastTime || now)) / 1000, .05); lastTime = now;
  if (!renderer || phase === 'loading' || phase === 'error') return;
  if (!paused) {
    elapsed += dt;
    if (phase === 'flying') updateFlight(dt);
    else if (phase === 'landing' || phase === 'takeoff') updateLanding(dt);
    plane.position.set(state.x, state.y, state.z);
    plane.rotation.set(state.climb * .19, -state.heading, -state.turn * .48, 'YXZ');
    if (propeller) propeller.rotation.z += dt * 42;
    water.material.uniforms.time.value = elapsed;
    clouds.forEach(c => { c.position.x += c.userData.speed * dt; if (c.position.x > 310) c.position.x = -310; });
    boats.forEach((b, i) => { b.position.y = .2 + Math.sin(elapsed + i) * .1; b.rotation.z = Math.sin(elapsed * .7 + i) * .025; });
    birds.forEach((b, i) => {
      const a = elapsed * .13 + b.userData.offset;
      b.position.set(Math.sin(a) * 40 - 30, 27 + Math.sin(a * 2) * 2 + i * .4, Math.cos(a) * 30 - 10);
      b.rotation.y = -a - Math.PI / 2;
      b.children.forEach((wing, j) => { wing.rotation.z = (j ? 1 : -1) * (1.3 + Math.sin(elapsed * 6 + i) * .35); });
    });
    rings.forEach((r, i) => { if (!reducedMotion) r.children[0].rotation.z = elapsed * .18 + i; });
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.userData.life -= dt; p.position.addScaledVector(p.userData.velocity, dt);
      p.scale.setScalar(Math.max(0, p.userData.life));
      if (p.userData.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); }
    }
    setCamera(false, dt);
    sun.position.set(state.x + 60, 120, state.z + 50); sun.target.position.set(state.x, 0, state.z);
    if (engine && audio) engine.frequency.setTargetAtTime(65 + Math.abs(state.turn) * 10 + state.climb * 6, audio.currentTime, .1);
  }
  if (elapsed > toastUntil) $('toast').classList.remove('show');
  $('steeringHint').style.opacity = elapsed < hintUntil && phase === 'flying' ? 1 : 0;
  updateMarker(); if (now - lastMap > 100) { drawMap(); lastMap = now; }
  renderer.render(scene, camera);
}
function fail(message) {
  phase = 'error'; paused = true; updateSound();
  $('loading').classList.remove('done'); $('loading').classList.add('error');
  $('loading').setAttribute('aria-hidden', 'false'); $('loading').inert = false;
  $('loading').querySelector('h2').textContent = 'A little trouble taking off.';
  $('loadText').textContent = message;
  for (const id of ['pause', 'help', 'guide', 'land', 'sound']) $(id).disabled = true;
}
async function init() {
  setupControls();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color('#bde5df'); scene.fog = new THREE.Fog('#bde5df', 135, 360);
    camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, .2, 700);
    scene.add(new THREE.HemisphereLight('#fff2d2', '#568c84', 2.0));
    sun = new THREE.DirectionalLight('#fff3db', 2.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.camera.far = 240;
    sun.shadow.normalBias = .04; sun.shadow.bias = -.0002; scene.add(sun, sun.target);
    makeOcean(); makeClouds(); makeExtras(); makeTrail();
    const loader = new GLTFLoader();
    const [islandAsset, planeAsset, obstacleData] = await Promise.all([loader.loadAsync('./assets/sunny-island.glb'), loader.loadAsync('./assets/toy-plane.glb'), fetch('./assets/obstacles.json').then(r => { if (!r.ok) throw new Error('Island data failed to load'); return r.json(); })]);
    obstacles = obstacleData;
    islandAsset.scene.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    scene.add(islandAsset.scene); plane = planeAsset.scene;
    plane.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    propeller = plane.getObjectByName('Propeller'); scene.add(plane);
    window.addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    });
    restart(); $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true'); $('loading').inert = true;
    requestAnimationFrame(animate);
  } catch (error) { console.error('Flight startup failed', error); fail('Please reload to try again. This game needs a browser with WebGL 2.'); }
}
init();
