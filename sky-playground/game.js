import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clamp, angleDelta, groundHeight, initialFlight, stepFlight, touchesTarget, TRAIL, PICNIC, RUNWAY, AIRPORT_APPROACH, runwayLanding, runwayTakeoff } from './flight.js?v=9';

import { PILOT_KEY, BOOST_SECONDS, BOOST_SPEED, CLOUD_STARS, LANDING_STARS, GIFT_STARS, SIGHT_STARS, WISH_STARS, SHOOTING_STARS, ZOOM_PULL, ZOOM_MAX, PLANE_MODELS, PLANE_PAINTS, PLANE_TRAILS, PLANE_TOYS, buildSky, resetSky, collectSky, autoTarget, tourFrom, CITY_TOUR, starHeight, freshZoom, chargeZoom, spendZoom, normalizePilot, earnStars, buyForPilot, pilotOwns, nowAffordable } from './sky.js?v=9';
import { createFun } from './fx.js?v=9';
import { createTunes } from './tunes.js?v=9';
import { createCity } from './cityscape.js?v=9';
import { allObstacles, LIMITS } from './city.js?v=9';
import { AIRPORTS, SPEEDS, WORLD, CITY, nightAt, airportById, airportRunway, approachFor, parkedAt, worldGroundHeight, worldObstacles, nearestAirport, newTrip, prepareTrip, arriveTrip, normalizePassport, stampArrival, assistedLanding } from './airline.js?v=9';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer, scene, camera, plane, propeller, flame, water, sun, hemi, beacon, city;
const planeModels = {};          // each plane's loaded model, by id; `plane` is the frame that holds the chosen one
let state = initialFlight(), phase = 'loading', collected = 0, guided = false;
let paused = false, soundOn = false, pointer = null, toastUntil = 0, hintUntil = 12;
let elapsed = 0, lastTime = 0, lastMap = 0, landingTime = 0, landingStart;
let freeFlight = false, input = { x: 0, y: 0 }, keys = new Set();
let obstacles = [];
let airportLeg = -1;
let mode='airline', currentAirport='sunny', landingAirport='sunny', landingStyle='hands', speedMode='cruise', trip=null, passengerModel;
let savedPassport; try { savedPassport=localStorage.getItem('viaan-airline-v1'); } catch {}
let passport=normalizePassport(savedPassport);
const approachLights=new Map();
let audio, away = false, touched = false, zoom = freshZoom(), toyAt = -9;
// The autopilot: a mode that stays on until its button is tapped again. `guided` says whether it is steering right now.
// Which part of the airport card is showing (a chosen flight shows its boarding instead of 'pick'),
// the number last shown by the takeoff countdown, and how dark the sky was last drawn.
let boardView = 'pick', countShown = '', nightShown = -1, nightSaid = false;
let autopilot = false, autoHeld = null, autoSince = 0, autoTrickAt = 0, handsAt = -9, wish = null, nextWish = 0, wishes = 0;
const shy = new Set();
let skyItems = [], fun = null, tunes = null, flightStars = 0, starStreak = 0, lastStarAt = -9, boostUntil = -1, bubbleUntil = 0;
let savedPilot; try { savedPilot = localStorage.getItem(PILOT_KEY); } catch {}
let pilot = normalizePilot(savedPilot);
const rings = [], clouds = [], boats = [], birds = [], particles = [];
const particleGeometry = new THREE.SphereGeometry(.15, 5, 4);
let shade;
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
const chime = win => tunes?.chime(win);
const inFlight = () => ['flying', 'landing', 'takeoff'].includes(phase);
// Full sound while flying; the same song without drums at the airport; silence in a
// pause menu or when the page is not in front.
function updateSound() {
  const flying = !paused && inFlight(), lobby = phase === 'parked' && ($('airportBoard').open || $('celebration').open);
  tunes?.music(mode === 'picnic' ? 'sunny' : trip?.status === 'flying' ? trip.destination : currentAirport);
  tunes?.calm(!flying); tunes?.awake(soundOn && !away && (flying || lobby));
}
// Must be called from a tap or key press so the browser allows sound.
async function setSound(on) {
  try {
    if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); tunes = createTunes(audio); tunes.setEngine((PLANE_MODELS.find(p => p.id === pilot.plane) || PLANE_MODELS[0]).engine); }
    await audio.resume(); soundOn = on;
    for (const id of ['sound', 'boardSound']) { $(id).setAttribute('aria-pressed', soundOn); $(id).setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on'); }
    if (pilot.sound !== on) { pilot = { ...pilot, sound: on }; savePilot(); }
    updateSound();
    return true;
  } catch { toast('Sound is unavailable. You can still fly!'); return false; }
}
async function toggleSound() {
  if (!await setSound(!soundOn)) return;
  if (soundOn) say(mode === 'picnic' ? 'Let’s take Bear a picnic. Follow the golden rings!' : 'Welcome to your little airline. Choose a destination and take your friend on a trip!');
  else if ('speechSynthesis' in window) speechSynthesis.cancel();
}
// A pilot who chose sound last time gets it back with the first tap or key press.
function wakeSound(e) {
  if (away && !document.hidden) { away = false; updateSound(); }   // back in front without a focus event
  if (audio || !pilot.sound || e.target?.closest?.('#sound,#boardSound')) return;
  setSound(true);
}
function toast(text, seconds = 3) {
  $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = elapsed + seconds;
}

function makeOcean() {
  // Small geometric waves; no textures, network services, or expensive reflections.
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, night: { value: 0 }, fogColor: { value: new THREE.Color('#bde5df') } },
    vertexShader: `uniform float time; varying vec3 world; varying float depth;
      void main(){ vec3 p=position; p.z += sin(p.x*.065+time*.7)*.10 + cos(p.y*.08+time*.5)*.08;
        vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;vec4 mv=viewMatrix*w;depth=-mv.z;gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float time, night; uniform vec3 fogColor; varying vec3 world; varying float depth;
      void main(){ float ripple=sin(world.x*.45+world.z*.19+time)*sin(world.z*.37-time*.6);
        vec3 col=mix(vec3(.16,.66,.69),vec3(.29,.77,.77),ripple*.5+.5);
        float glint=pow(max(0.,sin(world.x*.76+world.z*.35+time*.8)),28.)*pow(max(0.,cos(world.z*.86-time*.6)),18.);
        col=mix(col,col*vec3(.13,.2,.42)+vec3(.012,.02,.07),night); col+=vec3(.20,.20,.13)*glint*(1.+night*1.5); col=mix(col,fogColor,smoothstep(100.,350.,depth));gl_FragColor=vec4(col,1.); }`
  });
  water = mesh(new THREE.PlaneGeometry(1900, 1900, 120, 120), material, WORLD.x, -.1, WORLD.z);
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
function savePilot() { try { localStorage.setItem(PILOT_KEY, JSON.stringify(pilot)); } catch {} }
// The badge shows every star the pilot owns, so it never appears to start again.
function showStars() { $('stars').textContent = pilot.stars; }
// The passenger (or pilot bear) pipes up in a little speech bubble.
function chatter(text, seconds = 2.6) { $('bubble').textContent = text; $('bubble').classList.add('show'); bubbleUntil = elapsed + seconds; }
const PRAISE = ['So many stars!', 'Twinkle twinkle!', 'Star catcher!', 'Wow, look at them all!'];
// Stars are banked and saved the moment they are earned, so leaving mid-flight loses nothing.
function bank(count) {
  const before = pilot;
  flightStars += count; pilot = earnStars(pilot, count); savePilot(); showStars();
  const filled = zoom.ready; zoom = chargeZoom(zoom, count); showZoom();
  if (zoom.ready > filled && phase === 'flying') tunes?.ready();
  const badge = $('starCounter'); badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  const prize = nowAffordable(before, pilot)[0];
  if (prize) { toast(`You can get ${prize.name} now! 🎁`, 3.5); tunes?.unlock(); }
}
// The zoom button shows how many zooms are ready and how full the next one is.
function showZoom() {
  $('zoomPips').textContent = '●'.repeat(zoom.ready) + '○'.repeat(ZOOM_MAX - zoom.ready);
  $('zoom').classList.toggle('empty', !zoom.ready);
  $('zoom').setAttribute('aria-label', zoom.ready ? `Zoom, ${zoom.ready} ready` : 'Zoom, catch stars to fill it');
}
function doZoom() {
  if (phase !== 'flying' || paused) return;
  const left = spendZoom(zoom);
  if (!left) { toast('Catch stars to fill your zoom! ⭐', 1.8); return; }
  zoom = left; showZoom(); boostUntil = elapsed + BOOST_SECONDS; tunes?.whoosh(); toast('Zoom! 🚀', 1.4);
  return true;
}
// While the autopilot flies, the passenger asks for a loop, a zoom or the toy. Doing it earns stars.
const ASKS = { trick: () => 'Do a loop! 🌀', zoom: () => 'Zoom, zoom! 🚀', toy: () => `Tap the ${(PLANE_TOYS.find(t => t.id === pilot.toy) || PLANE_TOYS[0]).icon} button!` };
function setWish(next) {
  wish = next;
  for (const id of ['trick', 'zoom', 'toy']) $(id).classList.toggle('wanted', wish?.kind === id);
}
function askWish() {
  // No zooming on the way down to the runway.
  const kinds = ['trick', 'toy', ...(zoom.ready && airportLeg < 0 ? ['zoom'] : [])], kind = kinds[wishes++ % kinds.length];
  setWish({ kind, until: elapsed + 6 }); chatter(ASKS[kind](), 6);
}
function grantWish(kind) {
  if (wish?.kind !== kind) return;
  setWish(null); nextWish = elapsed + 5; bank(WISH_STARS); tunes?.chime(); chatter(`Yay, thank you! +${WISH_STARS} ⭐`);
}
function showToy() {
  const toy = PLANE_TOYS.find(t => t.id === pilot.toy) || PLANE_TOYS[0];
  $('toyIcon').textContent = toy.icon; $('toyName').textContent = toy.name; $('toy').setAttribute('aria-label', toy.name);
}
function doToy() {
  if (phase !== 'flying' || paused || elapsed - toyAt < .7) return;
  toyAt = elapsed; fun?.toy(pilot.toy, state.speed); tunes?.toy(pilot.toy);
  return true;
}
function gather(found) {
  let earned = 0;
  for (const thing of found) {
    earned += thing.value; fun?.collected(thing);
    if (thing.kind === 'star') {
      starStreak = elapsed - lastStarAt < 2.5 ? starStreak + 1 : 0; lastStarAt = elapsed;
      if (thing.big) { tunes?.bigStar(); toast(`Big star! +${thing.value} ⭐`, 1.6); } else tunes?.star(starStreak);
      if (starStreak && starStreak % 8 === 0) { fun?.shower(); chatter(PRAISE[(starStreak / 8 - 1) % PRAISE.length]); }
    } else if (thing.kind === 'balloon') { tunes?.pop(); toast('Pop! +3 ⭐', 1.4); }
    else { boostUntil = elapsed + BOOST_SECONDS; tunes?.whoosh(); toast('Zoom! 🌈', 1.6); }
    // The autopilot celebrates a hoop or a big star with a loop of its own.
    if (autopilot && guided && (thing.kind === 'hoop' || thing.big)) autoTrickAt = elapsed + .45;
  }
  bank(earned);
}
// Which star trail is in the sky: the trip's own, the round trip when just flying, none over the picnic.
const skyRoute = () => mode === 'picnic' ? 'picnic' : mode === 'tour' ? CITY_TOUR : trip?.status === 'flying' ? `${trip.origin}>${trip.destination}` : '';
// On a City Tour the plane is kept over the city; otherwise it may roam the whole world.
const limits = () => { const c = airportById('city'); return mode === 'tour' ? { boundary: LIMITS.radius, center: { x: c.x + LIMITS.x, z: c.z + LIMITS.z } } : { boundary: WORLD.radius, center: WORLD }; };
function newSky() {
  resetSky(skyItems); flightStars = 0; starStreak = 0; boostUntil = -1; zoom = freshZoom(); showStars(); showZoom(); showToy();
  shy.clear(); autoHeld = null; autoTrickAt = 0; setWish(null); nextWish = elapsed + 10.5;
  fun?.setRoute(skyRoute());
}
function doTrick() {
  if (phase !== 'flying' || paused) return;
  if (fun?.trick()) { tunes?.trick(); chatter('Wheee!'); return true; }
}
const TRAIL_ICONS = { clouds: '☁️', bubbles: '🫧', ribbon: '🌈', hearts: '💗' };
// Puts the chosen plane's model on the frame the game flies, with its passenger seat, paint and engine sound.
function showPlane() {
  const choice = PLANE_MODELS.find(p => p.id === pilot.plane) || PLANE_MODELS[0], model = planeModels[choice.id];
  $('myPlaneIcon').src = `./assets/plane-${choice.id}.png`;
  if (!plane || !model) return;
  for (const other of Object.values(planeModels)) plane.remove(other);
  plane.add(model); plane.userData.view = choice.view;
  propeller = model.getObjectByName('Propeller'); flame = model.getObjectByName('Flame');
  passengerModel?.position.set(...choice.seat);
  fun?.setPlane(choice.tail); tunes?.setEngine(choice.engine);
}
function renderHangar() {
  $('starBank').textContent = pilot.stars;
  $('planeModels').innerHTML = PLANE_MODELS.map(p => `<button data-plane="${p.id}" aria-label="${p.name}" aria-pressed="${p.id === pilot.plane}"><img src="./assets/plane-${p.id}.png" alt=""><small>${p.name}</small></button>`).join('');
  $('planePaints').innerHTML = PLANE_PAINTS.map(p => {
    const mine = pilotOwns(pilot, p), ready = !mine && pilot.stars >= p.cost, fill = p.id === 'rainbow' ? 'conic-gradient(#ff5f5f,#ffd24a,#58d68d,#4aa8ff,#b06bff,#ff5f5f)' : p.color;
    return `<button data-paint="${p.id}" class="${mine ? '' : ready ? 'locked ready' : 'locked'}" style="background:${fill}" aria-label="${p.name}${mine ? '' : `, ${ready ? 'ready to unlock' : 'locked'}, costs ${p.cost} stars`}" aria-pressed="${p.id === pilot.paint}">${mine ? '' : '🔒<br>' + p.cost}</button>`;
  }).join('');
  $('planeTrails').innerHTML = PLANE_TRAILS.map(t => {
    const mine = pilotOwns(pilot, t), ready = !mine && pilot.stars >= t.cost;
    return `<button data-trail="${t.id}" class="${mine ? '' : ready ? 'locked ready' : 'locked'}" aria-label="${t.name}${mine ? '' : `, ${ready ? 'ready to unlock' : 'locked'}, costs ${t.cost} stars`}" aria-pressed="${t.id === pilot.trail}"><span aria-hidden="true">${TRAIL_ICONS[t.id]}</span><small>${mine ? t.name : '🔒 ' + t.cost}</small></button>`;
  }).join('');
  $('planeToys').innerHTML = PLANE_TOYS.map(t => {
    const mine = pilotOwns(pilot, t), ready = !mine && pilot.stars >= t.cost;
    return `<button data-toy="${t.id}" class="${mine ? '' : ready ? 'locked ready' : 'locked'}" aria-label="${t.name} toy${mine ? '' : `, ${ready ? 'ready to unlock' : 'locked'}, costs ${t.cost} stars`}" aria-pressed="${t.id === pilot.toy}"><span aria-hidden="true">${t.icon}</span><small>${mine ? t.name : '🔒 ' + t.cost}</small></button>`;
  }).join('');
}
// Tapping something locked buys it when there are enough stars, and says how many are missing when not.
function choosePlane(kind, id) {
  const thing = ({ plane: PLANE_MODELS, paint: PLANE_PAINTS, trail: PLANE_TRAILS, toy: PLANE_TOYS })[kind].find(i => i.id === id); if (!thing) return;
  if (!pilotOwns(pilot, thing)) {
    if (pilot.stars < thing.cost) { $('hangarNote').textContent = `${thing.cost - pilot.stars} more stars for ${thing.name}`; return; }
    pilot = buyForPilot(pilot, id); $('hangarNote').textContent = `You unlocked ${thing.name}!`; tunes?.unlock();
  } else { $('hangarNote').textContent = ''; if (kind === 'toy') tunes?.toy(id); else tunes?.tap(); }
  pilot = normalizePilot({ ...pilot, [kind]: id }); savePilot();
  if (kind === 'plane') { showPlane(); $('hangarNote').textContent = `${thing.name} is ready to fly!`; }
  fun?.setPaint(pilot.paint); fun?.setTrail(pilot.trail); showToy(); renderHangar();
}
function tripAirport() { return trip?.status === 'flying' ? trip.destination : currentAirport; }
function chooseSpeed(mode) {
  speedMode = Object.hasOwn(SPEEDS, mode) ? mode : 'cruise';
  document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', b.dataset.speed === speedMode));
}
function savePassport() { try { localStorage.setItem('viaan-airline-v1', JSON.stringify(passport)); } catch {} }
function airportBoard() {
  paused = true; clearInput(); updateSound();
  if ($('celebration').open) $('celebration').close();
  if ($('menu').open) $('menu').close();
  $('departureAirport').textContent = airportById(currentAirport).airport;
  const view = boardView === 'hangar' ? 'hangar' : trip?.status === 'boarding' ? 'board' : 'pick';
  $('airportBoard').dataset.view = view;
  $('airportHeading').textContent = view === 'hangar' ? 'My plane' : view === 'board' ? `Off to ${airportById(trip.destination).name}!` : 'Where shall we fly?';
  // One big ticket for each of the other islands; a place not yet visited says so.
  $('destinationCards').innerHTML = AIRPORTS.filter(a => a.id !== currentAirport).map(a =>
    `<button class="ticket" data-destination="${a.id}"><span class="ticket-sky ${a.id}"><i aria-hidden="true">${a.icon}</i><img src="../memory-assets/${a.animal}.png" alt=""></span><span class="ticket-words"><strong>${a.name}</strong><small>${a.passenger} wants ${a.wish}</small></span>${passport.stamps.includes(a.id) ? '' : '<em>New!</em>'}<b aria-hidden="true">➜</b></button>`).join('');
  $('destinationCards').querySelectorAll('button').forEach(b => b.onclick = () => {
    trip = newTrip(currentAirport, b.dataset.destination); mode = 'airline'; boardView = 'pick'; airportBoard(); tunes?.tap();
    say(`${airportById(trip.destination).passenger} is coming with you! First, load the suitcase.`);
  });
  $('boardingSteps').hidden = view !== 'board';
  if (trip?.status === 'boarding') {
    // Boarding shows one big button at a time: the suitcase, then the friend, then takeoff.
    const a = airportById(trip.destination), scene = $('boardScene');
    $('boardingPortrait').src = `../memory-assets/${a.animal}.png`; scene.dataset.place = a.id;
    scene.classList.toggle('bag', trip.bag); scene.classList.toggle('aboard', trip.boarded);
    $('boardingName').textContent = trip.boarded ? 'All aboard!' : trip.bag ? `Now welcome ${a.passenger}!` : `${a.passenger} is ready!`;
    $('boardingStatus').textContent = trip.boarded ? 'Ready for takeoff!' : trip.bag ? `Tap to let ${a.passenger} hop in.` : 'Tap the suitcase to put it on the plane.';
    $('loadBag').innerHTML = '<span aria-hidden="true">🧳</span> Load the suitcase'; $('loadBag').disabled = trip.bag; $('loadBag').hidden = trip.bag;
    $('boardPassenger').innerHTML = `<span aria-hidden="true">👋</span> Welcome ${a.passenger}!`; $('boardPassenger').disabled = !trip.bag || trip.boarded; $('boardPassenger').hidden = !trip.bag || trip.boarded;
    $('depart').disabled = !trip.bag || !trip.boarded; $('depart').hidden = !trip.boarded;
    $('dotBag').classList.toggle('done', trip.bag); $('dotFriend').classList.toggle('done', trip.boarded);
  }
  // My plane glows when the stars can buy something new.
  $('openHangar').classList.toggle('ready', [...PLANE_PAINTS, ...PLANE_TRAILS, ...PLANE_TOYS].some(i => i.cost && !pilotOwns(pilot, i) && pilot.stars >= i.cost));
  $('starBankOpen').textContent = pilot.stars;
  $('passportStamps').innerHTML = AIRPORTS.map(a => `<span class="passport-stamp ${passport.stamps.includes(a.id) ? 'earned' : ''}"><b>${passport.stamps.includes(a.id) ? a.icon : '○'}</b>${a.name}</span>`).join('');
  $('tripTotal').textContent = `${passport.trips} happy passenger trip${passport.trips === 1 ? '' : 's'}`;
  renderHangar();
  // Opening the card puts keyboard focus on the first flight rather than on the sound button.
  if (!$('airportBoard').open) { $('airportBoard').showModal(); $('destinationCards').querySelector?.('button')?.focus(); }
  else if (view === 'board') [$('loadBag'), $('boardPassenger'), $('depart')].find(b => !b.hidden)?.focus?.();
  updateMission(); updateSound();
}
// `kind` is 'trip' (the passenger flight chosen), 'free' (just fly) or 'tour' (the City Tour, which always starts at City Airport).
function leaveAirport(kind = 'trip') {
  if (phase !== 'parked') return;
  const free = kind !== 'trip';
  if (kind === 'tour') { mode = 'tour'; trip = null; currentAirport = landingAirport = 'city'; state = parkedAt('city'); plane.position.set(state.x, state.y, state.z); setCamera(true); }
  else if (free) { mode = 'free'; trip = null; }
  else { const next = prepareTrip(trip, 'depart'); if (next?.status !== 'flying') return; trip = next; mode = 'airline'; }
  $('airportBoard').close(); $('celebration').close();
  paused = false; phase = 'takeoff'; landingTime = 0; landingStart = { ...state }; airportLeg = -1;
  clearInput(); setGuided(false); updatePassenger(); newSky(); updateMission(); updateSound();
  lastTime = performance.now(); countShown = ''; boardView = 'pick';
  say(kind === 'tour' ? 'City tour! Follow the stars between the buildings.' : free ? 'Cleared for takeoff!' : 'Passenger ready. Bags ready. Cleared for takeoff!');
}
function openLandingChoice() {
  if (phase !== 'flying' || paused) return;
  paused = true; clearInput(); updateSound();
  $('landingDestination').textContent = airportById(trip?.status === 'flying' ? trip.destination : nearestAirport(state)).airport;
  $('landingChoice').showModal();
}
function beginLanding(style) {
  // Choosing to steer the landing takes the plane back from the autopilot.
  if (style === 'hands' && autopilot) setAutopilot(false);
  landingStyle = style; $('landingChoice').close(); paused = false;
  lastTime = performance.now(); visitAirport(); updateSound();
}
function restartAirline() {
  for (const id of ['menu','celebration','airportBoard','landingChoice']) if ($(id).open) $(id).close();
  mode = 'airline'; trip = null; boardView = 'pick'; currentAirport = 'sunny'; landingAirport = 'sunny';
  clearInput(); state = parkedAt('sunny'); phase = 'parked'; paused = true; airportLeg = -1;
  collected = 0; freeFlight = true; landingStyle = 'hands'; chooseSpeed('cruise'); autopilot = false; setGuided(false);
  updatePassenger(); updateMission(); setCamera(true); airportBoard();
}
function updatePassenger() {
  if (!passengerModel) return;
  passengerModel.visible = !!trip?.boarded && trip.status !== 'arrived';
  const name = trip ? airportById(trip.destination).animal : 'panda';
  passengerModel.getObjectByName('Passenger head').material.color.set(name === 'frog' ? '#92bb70' : name === 'penguin' ? '#374954' : name === 'owl' ? '#b98a5a' : name === 'giraffe' ? '#f2c14e' : '#ffefcf');
  passengerModel.children.filter(o => o.name === 'Passenger ear').forEach(o => { o.visible = name !== 'penguin'; o.material.color.set(name === 'frog' ? '#92bb70' : name === 'owl' ? '#8a5f38' : name === 'giraffe' ? '#c98a2b' : '#374954'); });
}
function makePassenger() {
  passengerModel = new THREE.Group(); passengerModel.position.set(0,.65,.83);
  mesh(new THREE.SphereGeometry(.21,12,8), mat('#ffefcf'),0,0,0,passengerModel).name = 'Passenger head';
  for (const side of [-1,1]) {
    mesh(new THREE.SphereGeometry(.075,8,6),mat('#374954'),side*.17,.14,0,passengerModel).name='Passenger ear';
    mesh(new THREE.SphereGeometry(.04,8,6),mat('#20343b'),side*.09,.03,-.18,passengerModel);
  }
  plane.add(passengerModel); passengerModel.visible=false;
}
function makeAirportDetails() {
  for (const a of AIRPORTS) {
    const board = document.createElement('canvas'); board.width=512; board.height=128;
    const c=board.getContext('2d'); c.fillStyle='#fff9e9'; c.fillRect(0,0,512,128);
    c.fillStyle='#234e4b';c.font='bold 35px sans-serif';c.textAlign='center';c.fillText(a.airport,256,73);
    const texture=new THREE.CanvasTexture(board);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));
    sign.position.set(a.x+40,19,a.z+43);sign.scale.set(32,8,1);scene.add(sign);
    const group=new THREE.Group(); group.position.set(a.x,0,a.z);scene.add(group); approachLights.set(a.id,group);
    for (let z=20;z<=60;z+=5) for(const x of [16,28]) mesh(new THREE.SphereGeometry(.24,7,5),mat('#ffe9a9',{emissive:'#ffd763',emissiveIntensity:.8}),a.x+x,2.95,a.z+z);
    for (let i=0;i<4;i++) {
      const z=78-i*7,y=11-i*1.65;
      const ring=mesh(new THREE.TorusGeometry(3.8,.08,5,32),new THREE.MeshBasicMaterial({color:'#fff1b6',transparent:true,opacity:.65}),22,y,z,group);
      ring.name='Helping wing gate';
    }
    group.visible=false;
  }
}

// The button reads Autopilot (off), Auto ON, Your turn (the pilot has taken the stick for
// a moment), or Helping you (lining up a landing the pilot asked for).
function setGuided(on, hands = false) {
  guided = on; $('guide').setAttribute('aria-pressed', on || autopilot);
  $('guide').innerHTML = autopilot ? (hands ? '<span aria-hidden="true">🖐️</span> Your turn' : '<span aria-hidden="true">🤖</span> Auto ON') : on ? '<span aria-hidden="true">✧</span> Helping you' : '<span aria-hidden="true">🤖</span> Autopilot';
}
function setAutopilot(on) {
  autopilot = on; autoHeld = null; setWish(null); nextWish = elapsed + 3.5; setGuided(on);
  if (phase !== 'parked') updateMission();
}
function updateMission() {
  const airline = mode !== 'picnic';
  document.body.dataset.phase = phase;
  for (const id of ['trick', 'zoom', 'toy']) $(id).disabled = phase !== 'flying';
  $('speedControls').hidden = phase === 'parked' || phase === 'loading';
  $('speedControls').querySelectorAll('button').forEach(b=>b.disabled=phase!=='flying'||airportLeg>=0);
  approachLights.forEach((g,id)=>g.visible=id===landingAirport&&airportLeg>=0);
  $('islandName').textContent = airline ? 'LITTLE AIRLINE' : 'SUNNY ISLAND';
  if (airline) {
    rings.forEach(r=>r.visible=false);beacon.visible=false;document.querySelector('.ring-counter').hidden=true;$('progress').style.visibility='hidden';
    const dest=airportById(airportLeg>=0?landingAirport:tripAirport());
    $('missionIcon').innerHTML=trip?.boarded?`<img src="../memory-assets/${airportById(trip.destination).animal}.png" alt="">`:'✈';
    $('missionKicker').textContent=phase==='parked'?airportById(currentAirport).airport:airportLeg>=0?dest.airport:trip?'HAPPY PASSENGER FLIGHT':mode==='tour'?'BIG CITY':'FREE FLIGHT';
    $('missionTitle').textContent=phase==='takeoff'?'Ready, set, fly!':phase==='landing'?(landingStyle==='hands'?'You’re landing the plane!':'A lovely gentle landing'):phase==='parked'?'Where shall we go?':trip?`${dest.passenger} → ${dest.name}`:mode==='tour'?'City tour':'Explore our five islands';
    $('missionSubtitle').textContent=phase==='landing'?(landingStyle==='hands'?'Steer gently. Helping wings keep you safe.':'Wheels down. Rolling to a stop.'):airportLeg>=0?'Follow the glowing runway gates':phase==='takeoff'?'Speeding up along the runway':autopilot?'You do the tricks! 🤖':trip?'Follow the stars! ⭐':mode==='tour'?'Follow the stars round the city! 🏙️':'Find stars. Pop balloons. Land anywhere.';
    $('land').innerHTML=phase==='landing'&&landingStyle==='hands'?'Land for me':airportLeg>=0&&phase==='flying'?'Keep flying':'↘ Land';
    $('land').disabled=!(phase==='flying'||phase==='landing'&&landingStyle==='hands');
    $('guide').disabled=phase!=='flying'||airportLeg>=0;
    return;
  }
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
  if (airportLeg >= 0) return approachFor(landingAirport)[Math.min(airportLeg, 1)];
  if (mode !== 'picnic') return approachFor(trip?.status === 'flying' ? trip.destination : nearestAirport(state))[0];
  return freeFlight ? { x: 22, y: 14, z: 40 } : collected < TRAIL.length ? TRAIL[collected] : PICNIC;
}
// Where the guided plane heads: the runway approach, the picnic rings, or the autopilot's
// next treat. Something it cannot catch in a while is left alone for the rest of the flight.
function guideTarget() {
  if (airportLeg >= 0 || mode === 'picnic') return getTarget();
  // On a trip the autopilot follows its trail; just flying, it follows the round-trip trail from this island to the next.
  const next = autoTarget(skyItems, skyRoute() || (mode === 'free' ? tourFrom(currentAirport) : ''), state, autoHeld, shy);
  if (next !== autoHeld) { autoHeld = next; autoSince = elapsed; }
  else if (next && elapsed - autoSince > 12) { shy.add(next); autoHeld = null; }
  return next || getTarget();
}
// Run every frame of flight: the autopilot takes the stick back when it is let go, does
// its own loops and zooms, and passes on what the passenger asks for.
function flyAutopilot(steering) {
  if (!autopilot) return;
  if (steering) { handsAt = elapsed; return; }
  if (!guided) { if (elapsed - handsAt > 1.2 && airportLeg < 0) setGuided(true); return; }
  if (wish && (elapsed > wish.until || wish.kind === 'zoom' && airportLeg >= 0)) { setWish(null); nextWish = elapsed + 4; }
  else if (!wish && elapsed > nextWish) askWish();
  if (airportLeg >= 0) return;
  if (autoTrickAt && elapsed > autoTrickAt) { autoTrickAt = 0; if (wish?.kind !== 'trick' && fun?.trick()) tunes?.trick(); }
  if (zoom.ready === ZOOM_MAX && elapsed > boostUntil + 2 && Math.abs(state.turn) < .25 && wish?.kind !== 'zoom') doZoom();
}
function visitAirport() {
  if (phase !== 'flying') return;
  landingAirport = mode === 'picnic' ? 'sunny' : trip?.status === 'flying' ? trip.destination : nearestAirport(state);
  airportLeg = 0; clearInput(); setGuided(true); updateMission();
  toast('Let’s line up with the runway. 🛬', 4);
  say('Time to land! I’ll line us up with the runway.');
}
// Steering takes the stick. With the autopilot on that is only for as long as the pilot
// steers, and it does not interrupt a landing the autopilot has begun.
function takeControl() {
  if (autopilot && airportLeg >= 0) return;
  handsAt = elapsed; setGuided(false, true);
  if (airportLeg >= 0 && phase === 'flying') { airportLeg = -1; updateMission(); }
}
function clearInput() {
  keys.clear(); input = { x: 0, y: 0 }; pointer = null; $('joystick').style.display = 'none';
}
function openMenu(help = false) {
  if (phase === 'loading' || phase === 'error' || $('celebration').open || $('airportBoard').open || $('landingChoice').open) return;
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
  if ($('airportBoard').open) $('airportBoard').close();
  mode='picnic';trip=null;currentAirport='sunny';landingAirport='sunny';landingStyle='auto';updatePassenger();
  if ($('menu').open) $('menu').close(); if ($('celebration').open) $('celebration').close();
  clearInput(); state = initialFlight(); collected = 0; freeFlight = false; airportLeg = -1; phase = 'flying'; paused = false;
  autopilot = false; setGuided(false); newSky(); updateMission(); setCamera(true); hintUntil = elapsed + 10;
  toast('Let’s take Bear a picnic! 🧺', 4); updateSound();
}

function setupControls() {
  $('sound').addEventListener('click', toggleSound); $('boardSound').addEventListener('click', toggleSound);
  for (const event of ['pointerup', 'keydown']) window.addEventListener(event, wakeSound);
  $('pause').addEventListener('click', () => openMenu()); $('help').addEventListener('click', () => openMenu(true));
  $('resume').addEventListener('click', resume); $('restart').addEventListener('click', restartAirline); $('again').addEventListener('click', ()=>mode==='picnic'?restart():airportBoard());
  $('picnicFlight').addEventListener('click',restart);
  // A tap or key press is the pilot's own doing, which is what the passenger's wishes reward.
  const mine = (kind, act) => () => { if (act()) grantWish(kind); };
  const own = { trick: mine('trick', doTrick), zoom: mine('zoom', doZoom), toy: mine('toy', doToy) };
  for (const id of ['trick', 'zoom', 'toy']) $(id).addEventListener('click', own[id]);
  $('planeToys').addEventListener('click', e => { const b = e.target.closest('[data-toy]'); if (b) choosePlane('toy', b.dataset.toy); });
  $('planeModels').addEventListener('click', e => { const b = e.target.closest('[data-plane]'); if (b) choosePlane('plane', b.dataset.plane); });
  $('planePaints').addEventListener('click', e => { const b = e.target.closest('[data-paint]'); if (b) choosePlane('paint', b.dataset.paint); });
  $('planeTrails').addEventListener('click', e => { const b = e.target.closest('[data-trail]'); if (b) choosePlane('trail', b.dataset.trail); });
  $('airportPicnic').addEventListener('click',restart);
  $('openHangar').addEventListener('click',()=>{boardView='hangar';airportBoard();tunes?.tap();});
  $('closeHangar').addEventListener('click',()=>{boardView='pick';airportBoard();tunes?.tap();});
  $('otherPlaces').addEventListener('click',()=>{trip=null;boardView='pick';updatePassenger();airportBoard();tunes?.tap();});
  $('freeFly').addEventListener('click',()=>leaveAirport('free'));$('cityTour').addEventListener('click',()=>leaveAirport('tour'));
  $('loadBag').addEventListener('click',()=>{trip=prepareTrip(trip,'bag');airportBoard();tunes?.thump();});
  $('boardPassenger').addEventListener('click',()=>{trip=prepareTrip(trip,'board');updatePassenger();airportBoard();tunes?.hello(airportById(trip.destination).animal);});
  $('depart').addEventListener('click',()=>leaveAirport());
  $('airportBoard').addEventListener('cancel',e=>e.preventDefault());
  $('handsLand').addEventListener('click',()=>beginLanding('hands'));
  $('autoLand').addEventListener('click',()=>beginLanding('auto'));
  $('cancelLanding').addEventListener('click',()=>{$('landingChoice').close();paused=false;lastTime=performance.now();updateSound();});
  $('landingChoice').addEventListener('cancel',e=>{e.preventDefault();$('cancelLanding').click();});
  document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{chooseSpeed(b.dataset.speed);tunes?.tap();}));
  $('menu').addEventListener('cancel', e => { e.preventDefault(); resume(); });
  $('celebration').addEventListener('cancel', e => e.preventDefault());
  $('land').addEventListener('click', () => {
    if (paused) return;
    if (phase === 'landing' && landingStyle === 'hands') {landingTime=landingTime<=8?landingTime*5/8:landingTime-3;landingStyle='auto';updateMission();return;}
    if (phase !== 'flying') return;
    if (airportLeg >= 0) { setAutopilot(false); takeControl(); toast('You’re the pilot!'); }
    else if(mode==='picnic') visitAirport();else openLandingChoice();
  });
  $('guide').addEventListener('click', () => {
    if (phase !== 'flying' || paused) return;
    setAutopilot(!autopilot); clearInput(); tunes?.tap();
    toast(autopilot ? 'Autopilot on! 🤖 You do the tricks.' : 'You’re the pilot!');
    if (autopilot) say('Autopilot on. I’ll fly, you do the tricks!');
  });
  $('explore').addEventListener('click', () => {
    if (phase !== 'parked') return;
    if(mode!=='picnic'){trip=null;boardView='pick';airportBoard();return;}
    $('celebration').close(); paused = false; phase = 'takeoff'; landingTime = 0;
    landingStart = { ...state }; clearInput(); setGuided(false); updateMission(); toast('Rolling down the runway… 🛫', 4); updateSound();
  });
  canvas.addEventListener('pointerdown', e => {
    if (!(phase === 'flying' || phase === 'landing' && landingStyle === 'hands') || paused || pointer !== null) return;
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
    if (k === 'escape' && !$('menu').open && !$('celebration').open && !$('airportBoard').open && !$('landingChoice').open) { e.preventDefault(); openMenu(); return; }
    if (k === 't') { own.trick(); return; }
    if (k === 'z') { own.zoom(); return; }
    if (k === ' ') { e.preventDefault(); own.toy(); return; }
    if (!controlKeys.includes(k) || paused || !(phase === 'flying' || phase === 'landing' && landingStyle === 'hands')) return;
    e.preventDefault(); keys.add(k); takeControl(); hintUntil = elapsed + 1;
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { clearInput(); if (!paused && phase !== 'loading') openMenu(); away = true; updateSound(); });
  window.addEventListener('focus', () => { away = document.hidden; updateSound(); });
  window.addEventListener('pagehide', savePilot);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); openMenu(); } away = document.hidden; updateSound(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The sky needs a fresh start. Please reload this page.'); });
}
function setCamera(immediate = false, dt = 0) {
  const forward = v.set(Math.sin(state.heading), 0, -Math.cos(state.heading));
  const distance = (innerWidth < 650 && innerHeight > innerWidth ? 13 : 11) * (plane?.userData?.view || 1);
  cameraGoal.set(state.x - forward.x * distance, state.y + 4.6, state.z - forward.z * distance);
  cameraGoal.y = Math.max(cameraGoal.y, worldGroundHeight(cameraGoal.x, cameraGoal.z) + 3);
  lookGoal.set(state.x + forward.x * 13, state.y + 1.5, state.z + forward.z * 13);
  const blend = immediate ? 1 : 1 - Math.exp(-4 * dt);
  currentCamera.lerp(cameraGoal, blend); currentLook.lerp(lookGoal, blend);
  camera.position.copy(currentCamera); camera.lookAt(currentLook);
}
function drawMap() {
  const c=map, airline=mode!=='picnic', tour=mode==='tour', city=airportById('city'), scale=tour?.36:airline?.118:.54;
  // A City Tour shows just the city; other flights show all five places.
  const midX=tour?city.x+(CITY.x0+CITY.x1)/2:airline?WORLD.x:0, midZ=tour?city.z+(CITY.z0+CITY.z1)/2+20:airline?WORLD.z-65:0;
  const toX=x=>80+(x-midX)*scale,toY=z=>80+(z-midZ)*scale;
  c.clearRect(0,0,160,160);
  for(const a of airline?AIRPORTS:[AIRPORTS[0]]) {
    c.fillStyle=a.id==='snowy'?'#e4edf0':a.id==='jungle'?'#6caa70':a.id==='starry'?'#7d76cf':a.city?'#c3bfd0':'#a6c889';c.beginPath();
    if(a.city){const x=toX(a.x+CITY.x0),y=toY(a.z+CITY.z0),w=(CITY.x1-CITY.x0)*scale,h=(CITY.z1-CITY.z0)*scale;c.roundRect?c.roundRect(x,y,w,h,CITY.corner*scale):c.rect(x,y,w,h);}
    else c.ellipse(toX(a.x),toY(a.z),90*scale,72*scale,0,0,Math.PI*2);
    c.fill();
    c.strokeStyle='#fff2ce';c.lineWidth=tour?4:2.5;c.beginPath();c.moveTo(toX(a.x+22),toY(a.z+16));c.lineTo(toX(a.x+22),toY(a.z+60));c.stroke();
    if(airline&&!tour){c.fillStyle='#265552';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(a.icon,toX(a.x+(a.city?25:0)),toY(a.z+(a.city?-100:0))+3);}
  }
  // On a tour, the stars still to catch show the way round.
  if(tour){c.fillStyle='#ffd23f';for(const s of skyItems)if(s.route===CITY_TOUR&&s.kind==='star'&&!s.taken){c.beginPath();c.arc(toX(s.x),toY(s.z),1.6,0,Math.PI*2);c.fill();}}
  const target=getTarget();c.strokeStyle='#fff5c5';c.lineWidth=1.5;c.setLineDash([3,3]);c.beginPath();c.moveTo(toX(state.x),toY(state.z));c.lineTo(toX(target.x),toY(target.z));c.stroke();c.setLineDash([]);
  c.fillStyle='#fff4d1';c.beginPath();c.arc(toX(target.x),toY(target.z),3,0,Math.PI*2);c.fill();
  c.save();c.translate(clamp(toX(state.x),7,153),clamp(toY(state.z),7,153));c.rotate(state.heading);c.fillStyle='#e6583f';c.strokeStyle='#fff9df';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-7);c.lineTo(5,5);c.lineTo(0,2);c.lineTo(-5,5);c.closePath();c.fill();c.stroke();c.restore();
}
function updateMarker() {
  const marker = $('targetMarker');
  if (phase !== 'flying' || (mode === 'picnic' && freeFlight && !guided)) { marker.style.display = 'none'; return; }
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
  marker.firstElementChild.textContent = behind ? (x > innerWidth / 2 ? '→' : '←') : airportLeg >= 0 || mode !== 'picnic' ? '🛬' : collected === 5 && !freeFlight ? '🧺' : '◎';
  $('distance').textContent = `${Math.round(distance)} m`;
}
function updateFlight(dt) {
  const previous = state;
  const keyboard = keys.size > 0;
  const steer = keyboard ? {
    x: Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a')),
    y: Number(keys.has('arrowup') || keys.has('w')) - Number(keys.has('arrowdown') || keys.has('s'))
  } : input;
  flyAutopilot(keyboard || pointer !== null);
  // Hands off the height, the plane eases to the level of the next star (not while chasing the picnic rings).
  let fly = steer;
  if (!guided && airportLeg < 0 && Math.abs(steer.y) < .15 && (mode !== 'picnic' || freeFlight)) {
    const level = starHeight(skyItems, skyRoute(), state);
    if (level !== null) fly = { x: steer.x, y: clamp((level - state.y) * .12, -.6, .6) };
  }
  state = stepFlight(state, fly, dt, guided ? guideTarget() : null, obstacles, {speed:SPEEDS[speedMode]*(elapsed<boostUntil?BOOST_SPEED:1),guideSpeed:airportLeg>=0||mode==='picnic'?(elapsed<boostUntil?15:10):elapsed<boostUntil?19:Math.min(SPEEDS[speedMode],14),boundary:mode === 'picnic' ? 165 : limits().boundary,center:mode === 'picnic' ? null : limits().center,groundHeight:mode === 'picnic' ? groundHeight : worldGroundHeight});
  if (state.returning && !previous.returning) toast(mode === 'tour' ? 'Back to the city! 🏙️' : 'Let’s turn back toward our islands. ☀️');
  const found = collectSky(skyItems, previous, state, skyRoute(), elapsed < boostUntil ? ZOOM_PULL : 1);
  if (found.length) gather(found);
  if (airportLeg >= 0) {
    if (touchesTarget(previous, state, getTarget(), 4.5)) {
      if (airportLeg === 0) { airportLeg = 1; updateMission(); toast('There’s the runway. Coming in! 🛬'); }
      else if (Math.abs(angleDelta(0, state.heading)) < .45) {
        phase = 'landing'; landingTime = 0; touched = false; landingStart = { ...state }; clearInput(); setWish(null); if (autopilot) landingStyle = 'auto'; updateMission();
        toast('A gentle landing… 🛬', 4); updateSound();
      } else { airportLeg = 0; updateMission(); toast('One more turn to line up. ✈'); }
    }
    return;
  }
  if (mode !== 'picnic') {
    if (touchesTarget(previous,state,getTarget(),8)) visitAirport();
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
    const steer=keys.size?{x:Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a')),y:Number(keys.has('arrowup')||keys.has('w'))-Number(keys.has('arrowdown')||keys.has('s'))}:input;
    state = landingStyle === 'hands' ? assistedLanding(landingStart,state,landingTime,dt,steer,airportRunway(landingAirport)) : runwayLanding(landingStart,landingTime,airportRunway(landingAirport));
    if (!touched && landingTime >= (landingStyle === 'hands' ? 8 : 5)) { touched = true; tunes?.touchdown(); fun?.touchdown(); }
    if (state.finished) {
      currentAirport=landingAirport;clearInput();
      phase = 'parked'; paused = true; setGuided(false); burst(plane.position);
      fun?.celebrate();
      // Every landing earns stars, and a passenger brought to the right island gives a thank-you gift.
      const gift = mode !== 'picnic' && trip?.status === 'flying' && trip.destination === currentAirport ? GIFT_STARS : 0;
      bank(LANDING_STARS + gift);
      $('starReward').textContent = `${flightStars} new stars! You have ${pilot.stars} ⭐`;
      $('starBonus').textContent = gift ? `🛬 Landing +${LANDING_STARS} · 🎁 Thank-you gift +${gift}` : `🛬 Landing +${LANDING_STARS}`;
      $('landingMessage').textContent = freeFlight ? 'Bear has his picnic, and you’re back at Sunny Airport. Ready to explore?' : 'Wheels down. Right on the runway. Your adventure is waiting whenever you’re ready.';
      if(mode!=='picnic'){
        const before=trip;trip=arriveTrip(trip,currentAirport);passport=stampArrival(passport,before,trip);savePassport();updatePassenger();
        const a=airportById(currentAirport);$('arrivalKicker').textContent='WELCOME TO '+a.airport.toUpperCase();
        $('arrivalTitle').textContent=trip?.status==='arrived'?`${a.passenger} says thank you!`:'What a lovely landing!';
        $('landingMessage').textContent=trip?.status==='arrived'?`Your passenger loved the trip to ${a.name}. A new memory for your pilot passport!`:`You’re parked at ${a.airport}. Ready for another trip?`;
        $('arrivalPortrait').innerHTML=trip?.status==='arrived'?`<img class="waving-friend" src="../memory-assets/${a.animal}.png" alt="${a.passenger} waving goodbye">`:'🛬';
        $('explore').innerHTML='Choose another flight →';$('again').hidden=true;
      }else{$('arrivalKicker').textContent='WELCOME TO SUNNY AIRPORT';$('arrivalTitle').textContent='What a lovely landing!';$('arrivalPortrait').textContent='🛬';$('explore').innerHTML='Take off again ↗';$('again').hidden=false;}
      updateMission(); $('celebration').showModal(); updateSound(); tunes?.cheer(); say('What a lovely landing! Welcome to '+airportById(currentAirport).airport+'.');
    }
  } else {
    state = runwayTakeoff(landingStart, landingTime, airportRunway(currentAirport));
    // Three, two, one, go! The plane leaves the ground as the count ends.
    const count = landingTime < 2.4 ? String(3 - Math.floor(landingTime / .8)) : landingTime < 3.6 ? 'Go!' : '';
    if (count !== countShown) {
      const el = $('countdown'); countShown = count; el.textContent = count; el.classList.remove('tick'); void el.offsetWidth; if (count) el.classList.add('tick');
      if (count === 'Go!') chime(true); else if (count) tunes?.ding();
    }
    if (state.finished) { phase = 'flying'; airportLeg = -1; updateMission(); updateSound(); chime(); toast(autopilot ? 'Autopilot on! 🤖 You do the tricks.' : 'You’re flying! ✈'); }
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
    plane.rotation.set(state.climb * .19, -state.heading, -state.turn * .48 + (fun?.roll || 0), 'YXZ');
    if (propeller) propeller.rotation.z += dt * (phase==='parked'?0:22+state.speed*2);
    // A jet's flame flickers, grows with speed and stretches when zooming.
    if (flame) { flame.userData.long ??= flame.scale.z; flame.visible = phase !== 'parked'; flame.scale.z = flame.userData.long * (.5 + state.speed * .05 + (elapsed < boostUntil ? 1.3 : 0)) * (1 + Math.sin(elapsed * 31) * .12); }
    water.material.uniforms.time.value = elapsed; city?.update(dt, elapsed);
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
    const night = mode === 'picnic' ? 0 : nightAt(state.x, state.z);
    if (Math.abs(night - nightShown) > .004) {
      nightShown = night; shade ||= new THREE.Color();
      hemi.intensity = 2 - night * 1.1; hemi.color.set('#fff2d2').lerp(shade.set('#93a4ff'), night); hemi.groundColor.set('#568c84').lerp(shade.set('#1d2452'), night);
      sun.intensity = 2.5 - night * 1.95; sun.color.set('#fff3db').lerp(shade.set('#b3c0ff'), night);
      water.material.uniforms.night.value = night; fun?.night(night);
    }
    if (night > .6 && !nightSaid && phase === 'flying') { nightSaid = true; chatter('Look, the stars are coming out! 🌙', 3.5); }
    if (night < .2) nightSaid = false;
    sun.position.set(state.x + 60, 120, state.z + 50); sun.target.position.set(state.x, 0, state.z);
  }
  tunes?.engine(state.speed, state.climb, !paused && inFlight(), elapsed < boostUntil); tunes?.hurry(!paused && elapsed < boostUntil);
  if (fun && !$('menu').open && !$('landingChoice').open) {
    // The playful layer keeps moving behind the airport cards, so arrivals get their fireworks.
    for (const sight of fun.update(dt, !paused && phase === 'flying', !paused && elapsed < boostUntil, elapsed < boostUntil ? ZOOM_PULL : 1)) {
      if (sight === 'boom') tunes?.boom();
      else if (sight === 'gift') { tunes?.chime(); chatter('Thank you! 🎁'); }
      else if (sight === 'splash') { tunes?.splash(); chatter('Splash! 💦'); }
      else if (phase !== 'flying') continue;
      else if (sight === 'whale') { chatter(`Look, a whale! 🐋 +${SIGHT_STARS} ⭐`); tunes?.chime(); bank(SIGHT_STARS); }
      else if (sight === 'shooting') { chatter(`A shooting star! Make a wish! 🌠 +${SHOOTING_STARS} ⭐`, 3); tunes?.chime(true); bank(SHOOTING_STARS); }
      else if (sight === 'dolphins') { chatter(`Dolphins! 🐬 +${SIGHT_STARS} ⭐`); tunes?.chime(); bank(SIGHT_STARS); }
      else { tunes?.poof(); chatter(`Poof! ☁️ +${CLOUD_STARS} ⭐`); bank(CLOUD_STARS); }
    }
  }
  $('rush').classList.toggle('on', !paused && phase === 'flying' && elapsed < boostUntil);
  if (elapsed > bubbleUntil) $('bubble').classList.remove('show');
  if (elapsed > toastUntil) $('toast').classList.remove('show');
  $('steeringHint').style.opacity = elapsed < hintUntil && phase === 'flying' ? 1 : 0;
  updateMarker(); if (now - lastMap > 100) { drawMap();$('speedReadout').textContent=Math.round(state.speed*3.6)+' km/h';lastMap = now; }
  renderer.render(scene, camera);
}
function fail(message) {
  phase = 'error'; paused = true; updateSound();
  for (const id of ['airportBoard', 'landingChoice', 'celebration', 'menu']) $(id).close();
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
    scene = new THREE.Scene(); scene.background = new THREE.Color('#bde5df'); scene.fog = new THREE.Fog('#bde5df', 170, 600);
    camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, .2, 900);
    hemi = new THREE.HemisphereLight('#fff2d2', '#568c84', 2.0); scene.add(hemi);
    sun = new THREE.DirectionalLight('#fff3db', 2.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.camera.far = 240;
    sun.shadow.normalBias = .04; sun.shadow.bias = -.0002; scene.add(sun, sun.target);
    makeOcean(); makeClouds(); makeExtras(); makeTrail();
    const loader = new GLTFLoader();
    const [islandAsset, planeAsset, obstacleData] = await Promise.all([loader.loadAsync('./assets/sunny-island.glb'), Promise.all(PLANE_MODELS.map(p => loader.loadAsync(`./assets/${p.asset}.glb`))), fetch('./assets/obstacles.json').then(r => { if (!r.ok) throw new Error('Island data failed to load'); return r.json(); })]);
    obstacles = allObstacles(obstacleData); skyItems = buildSky(obstacles);
    islandAsset.scene.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    scene.add(islandAsset.scene);
    const otherIslands=await Promise.all(AIRPORTS.slice(1).filter(a=>!a.city).map(async a=>({a,asset:await loader.loadAsync('./assets/'+a.asset+'.glb')})));
    for(const {a,asset} of otherIslands){asset.scene.position.set(a.x,0,a.z);asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(asset.scene);}
    city = createCity({ scene, airport: airportById('city'), reducedMotion });
    plane = new THREE.Group();
    PLANE_MODELS.forEach((p, i) => { planeModels[p.id] = planeAsset[i].scene; planeAsset[i].scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); });
    scene.add(plane);makePassenger();showPlane();makeAirportDetails();
    window.addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    });
    fun = createFun({ scene, camera, plane, items: skyItems, airports: AIRPORTS, runwayOf: airportRunway, groundAt: worldGroundHeight, water, reducedMotion });
    showPlane(); fun.setPaint(pilot.paint); fun.setTrail(pilot.trail); showToy(); showZoom();
    // For checking the game by hand from the browser console.
    window.littlePilot = { get state() { return state; }, get pilot() { return pilot; }, get tunes() { return tunes; }, get items() { return skyItems; } };
    restartAirline(); plane.position.set(state.x,state.y,state.z); $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true'); $('loading').inert = true;
    requestAnimationFrame(animate);
  } catch (error) { console.error('Flight startup failed', error); fail('Please reload to try again. This game needs a browser with WebGL 2.'); }
}
init();
