import * as THREE from 'three';
import { GLTFLoader } from '../sky-playground/vendor/GLTFLoader.js';
import { clamp, angleDelta, LAPS, HALF_ROAD, BOOST_SECONDS, STORAGE_KEY, PAINTS, RIVALS, TRACKS, getTrack, trackPose, distanceToTrack, normalizePrefs, createRace, stepRace, playerOf, lapOf, standings, placeOf } from './race.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const THEMES = {
  beach: { icon: '🏖️', sky: '#a5dff0', ground: '#f0dba0', patch: '#e6cd8b', road: '#59626e', kerb: ['#eb6548', '#fff9e9'], hemi: '#b7a36c' },
  snow: { icon: '🏔️', sky: '#d3e8f6', ground: '#f3f7fa', patch: '#e2ecf3', road: '#566070', kerb: ['#2f7fe3', '#ffffff'], hemi: '#a9bccb' },
  jungle: { icon: '🌴', sky: '#bfe8cf', ground: '#63a95c', patch: '#559a50', road: '#575b63', kerb: ['#f7bf12', '#fff9e9'], hemi: '#4c7f4a' }
};
const ORDINALS = ['1st', '2nd', '3rd', '4th'];
let renderer, scene, camera, hemisphere, world, builtTrack = '', carTemplate, race;
let phase = 'loading', paused = false, soundOn = false, lastTime = 0, clock = 0;
let toastUntil = 0, countdownUntil = 0, finishAt = 0, lastHud = 0, orderKey = '', cameraHeading = 0, frameKey = '';
let audio, engineGain, engineA, engineB, mapBase, mapView;
let savedPrefs; try { savedPrefs = localStorage.getItem(STORAGE_KEY); } catch {}
let prefs = normalizePrefs(savedPrefs);
const cars = [], starMeshes = [], held = { left: new Set(), right: new Set() };
const dummy = new THREE.Object3D(), mapContext = $('map').getContext('2d');
const rand = (() => { let n = 2027; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...options });
const paintColor = () => PAINTS.find(p => p.id === prefs.paint).color;
const racing = () => phase === 'countdown' || phase === 'racing';

function setPhase(next) { phase = next; document.body.dataset.phase = next; frameKey = ''; updateSound(); }
function savePrefs() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {} }
function toast(text, seconds = 2) { $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = clock + seconds; }
function fail(message) { $('loading').classList.remove('done'); $('loading').classList.add('error'); $('loadText').textContent = message; }

/* ---------- sound: a quiet synthesized engine, horn and chimes ---------- */
function say(text) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .9; utterance.pitch = 1.1; utterance.volume = .85;
  speechSynthesis.speak(utterance);
}
function tone(frequency, delay = 0, seconds = .3, type = 'sine', volume = .09) {
  if (!soundOn || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
  oscillator.type = type; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .015);
  gain.gain.exponentialRampToValueAtTime(.001, t + seconds);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(t); oscillator.stop(t + seconds + .05);
}
const chime = (notes, gap = .09) => notes.forEach((f, i) => tone(f, i * gap, .35));
function horn() { tone(392, 0, .42, 'square', .035); tone(494, 0, .42, 'square', .035); }
function updateSound() {
  if (!engineGain || !audio) return;
  const on = soundOn && !paused && (phase === 'racing' || phase === 'countdown' || phase === 'finished');
  engineGain.gain.setTargetAtTime(on ? .035 : 0, audio.currentTime, .12);
}
async function toggleSound() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520;
      engineGain = audio.createGain(); engineGain.gain.value = 0;
      engineA = audio.createOscillator(); engineA.type = 'sawtooth'; engineA.frequency.value = 55;
      engineB = audio.createOscillator(); engineB.type = 'square'; engineB.frequency.value = 82;
      engineA.connect(filter); engineB.connect(filter); filter.connect(engineGain).connect(audio.destination);
      engineA.start(); engineB.start();
    }
    await audio.resume(); soundOn = !soundOn;
    $('sound').setAttribute('aria-pressed', soundOn);
    $('sound').setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    updateSound();
    if (soundOn) { horn(); if (phase === 'garage') say('Pick a colour, pick a track, then start the race!'); }
    else if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch { toast('Sound is unavailable. You can still race!'); }
}

/* ---------- track and scenery ---------- */
function ribbon(track, left, right, y, segmentLength, colorAt) {
  const positions = [], colors = [], index = [], color = new THREE.Color();
  const segments = Math.round(track.length / segmentLength);
  for (let i = 0; i < segments; i++) {
    const tint = colorAt(i); if (!tint) continue;
    const base = positions.length / 3, d0 = i * track.length / segments, d1 = (i + 1) * track.length / segments;
    color.set(tint);
    for (const [d, lat] of [[d0, left], [d0, right], [d1, left], [d1, right]]) {
      const p = trackPose(track, d, lat); positions.push(p.x, y, p.z); colors.push(color.r, color.g, color.b);
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
}
function scatterer() {
  const lists = new Map();
  return {
    put(key, geometry, material, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rz = 0) {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, rz); dummy.updateMatrix();
      if (!lists.has(key)) lists.set(key, { geometry, material, matrices: [] });
      lists.get(key).matrices.push(dummy.matrix.clone());
    },
    build(parent) {
      for (const { geometry, material, matrices } of lists.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        parent.add(mesh);
      }
    }
  };
}
function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff9e9'; g.fillRect(0, 0, 1024, 128);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) { g.fillStyle = '#143f42'; g.fillRect(x * 32, y * 32, 32, 32); g.fillRect(768 + x * 32, y * 32, 32, 32); }
  g.fillStyle = '#eb6548'; g.font = '900 86px "Avenir Next", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LITTLE RACER', 512, 70);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? .48 : 1.05, a = i / 10 * Math.PI * 2 + Math.PI / 2;
    shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .28, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 });
  geometry.center(); return geometry;
}
function disposeWorld() {
  if (!world) return;
  world.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  scene.remove(world); starMeshes.length = 0;
}
function buildWorld(trackId) {
  if (builtTrack === trackId) return;
  disposeWorld(); builtTrack = trackId;
  const track = getTrack(trackId), theme = THEMES[trackId];
  world = new THREE.Group(); scene.add(world);
  scene.background = new THREE.Color(theme.sky); scene.fog = new THREE.Fog(theme.sky, 130, 560);
  hemisphere.groundColor.set(theme.hemi);
  let cx = 0, cz = 0, reach = 0;
  for (let i = 0; i < track.n; i++) { cx += track.xs[i] / track.n; cz += track.zs[i] / track.n; }
  for (let i = 0; i < track.n; i++) reach = Math.max(reach, Math.hypot(track.xs[i] - cx, track.zs[i] - cz));
  const flat = (geometry, material, x, y, z) => { const m = new THREE.Mesh(geometry, material); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); world.add(m); return m; };
  if (trackId === 'beach') {
    flat(new THREE.CircleGeometry(reach + 75, 72), mat(theme.ground, { roughness: 1 }), cx, 0, cz);
    flat(new THREE.CircleGeometry(reach + 95, 72), new THREE.MeshBasicMaterial({ color: '#8fe0dc' }), cx, -.12, cz);
    flat(new THREE.CircleGeometry(1500, 48), new THREE.MeshBasicMaterial({ color: '#3fb9cb' }), cx, -.25, cz);
  } else flat(new THREE.CircleGeometry(1500, 48), mat(theme.ground, { roughness: 1 }), cx, 0, cz);

  // Road, kerbs, centre dashes and the chequered start line.
  const road = ribbon(track, -HALF_ROAD, HALF_ROAD, .03, 2, () => theme.road); world.add(road);
  for (const side of [-1, 1]) {
    const a = side * HALF_ROAD, b = side * (HALF_ROAD + 1);
    world.add(ribbon(track, Math.min(a, b), Math.max(a, b), .04, 3, i => theme.kerb[i % 2]));
  }
  world.add(ribbon(track, -.16, .16, .05, 4, i => i % 2 ? '#fff9e9' : null));
  for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: (row + col) % 2 ? '#fffdf5' : '#1b2a2e' }));
    const p = trackPose(track, -1.4 + row * 1.4 + .7, -6.3 + col * 1.4);
    tile.rotation.set(-Math.PI / 2, -p.heading, 0, 'YXZ');
    tile.position.set(p.x, .06, p.z); world.add(tile);
  }
  const gate = trackPose(track, 0, 0), span = HALF_ROAD + 1.8, post = mat('#fff9e9');
  for (const side of [-1, 1]) {
    const p = trackPose(track, 0, side * span), pillar = new THREE.Mesh(new THREE.CylinderGeometry(.35, .42, 7.4, 12), post);
    pillar.position.set(p.x, 3.7, p.z); world.add(pillar);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + .8, 1.7, .5), new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: .7 }));
  banner.position.set(gate.x, 7, gate.z); banner.rotation.y = -gate.heading; world.add(banner);

  // Boost stars float above the road.
  const starShape = starGeometry();
  for (const star of createRace(trackId).stars) {
    const mesh = new THREE.Mesh(starShape, mat('#ffcf3f', { emissive: '#e29a12', emissiveIntensity: .55, roughness: .35 }));
    const p = trackPose(track, star.s, star.lat); mesh.position.set(p.x, 1.5, p.z); mesh.userData.spin = rand() * 6;
    world.add(mesh); starMeshes.push(mesh);
  }

  // Scenery is scattered beside the road and never placed on it.
  const sphere = new THREE.SphereGeometry(1, 12, 8), cone = new THREE.ConeGeometry(1, 1, 9), tube = new THREE.CylinderGeometry(1, 1, 1, 8), rock = new THREE.DodecahedronGeometry(1);
  const disc = new THREE.CircleGeometry(1, 16); disc.rotateX(-Math.PI / 2);
  const m = { trunk: mat('#a9794a'), palm: mat('#4fae5d'), leaf: mat('#2f8f4f'), deep: mat('#237a45'), pine: mat('#2c7a5a'), snow: mat('#ffffff', { roughness: .6 }),
    rock: mat(trackId === 'snow' ? '#aab8c6' : '#b9ab8e'), coral: mat('#eb6548'), gold: mat('#ffc44e'), pink: mat('#f58fb4'), hat: mat('#28424a'), patch: mat(theme.patch, { roughness: 1 }), cloud: mat('#ffffff', { roughness: 1 }) };
  const s = scatterer();
  const palm = (x, z, size, leafMaterial, key) => {
    s.put('trunk', tube, m.trunk, x, 2.8 * size, z, .26 * size, 5.6 * size, .26 * size);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + x; s.put(key, sphere, leafMaterial, x + Math.cos(a) * 1.6 * size, 5.5 * size, z + Math.sin(a) * 1.6 * size, 2.1 * size, .2 * size, .65 * size, -a, -.38); }
  };
  for (let i = 0; i < 230; i++) {
    const side = rand() < .5 ? -1 : 1, p = trackPose(track, rand() * track.length, side * (HALF_ROAD + 6 + rand() * rand() * 70));
    const kind = rand(), size = .8 + rand() * .6, turn = rand() * 6;
    if (distanceToTrack(track, p.x, p.z) < HALF_ROAD + 5.5) continue;
    if (trackId === 'beach') {
      if (Math.hypot(p.x - cx, p.z - cz) > reach + 66) continue;
      if (kind < .5) palm(p.x, p.z, size, m.palm, 'palm');
      else if (kind < .68) { s.put('pole', tube, m.snow, p.x, 1.4, p.z, .07, 2.8, .07); s.put(kind < .59 ? 'shadeA' : 'shadeB', cone, kind < .59 ? m.coral : m.gold, p.x, 3, p.z, 2.3, .9, 2.3, turn); }
      else if (kind < .86) s.put('rock', rock, m.rock, p.x, .4 * size, p.z, 1.3 * size, .8 * size, 1.1 * size, turn);
      else s.put(kind < .93 ? 'ballA' : 'ballB', sphere, kind < .93 ? m.coral : m.gold, p.x, .7, p.z, .7);
    } else if (trackId === 'snow') {
      if (kind < .62) {
        s.put('trunk', tube, m.trunk, p.x, .6 * size, p.z, .3 * size, 1.2 * size, .3 * size);
        [[2.3, 3, 2.4], [1.8, 2.6, 4], [1.25, 2.2, 5.4]].forEach(([r, h, y]) => s.put('pine', cone, m.pine, p.x, y * size, p.z, r * size, h * size, r * size, turn));
        s.put('cap', cone, m.snow, p.x, 6.35 * size, p.z, .8 * size, 1.3 * size, .8 * size, turn);
      } else if (kind < .8) {
        [[.95, .8], [.68, 2.05], [.46, 3.0]].forEach(([r, y]) => s.put('snowball', sphere, m.snow, p.x, y, p.z, r));
        s.put('hat', tube, m.hat, p.x, 3.6, p.z, .3, .5, .3); s.put('hat', tube, m.hat, p.x, 3.38, p.z, .5, .07, .5);
        s.put('nose', sphere, m.coral, p.x - Math.cos(p.heading) * .44 * side, 3.0, p.z - Math.sin(p.heading) * .44 * side, .14);
      } else { s.put('rock', rock, m.rock, p.x, .5 * size, p.z, 1.5 * size, 1 * size, 1.3 * size, turn); s.put('snowball', sphere, m.snow, p.x, 1.05 * size, p.z, 1.1 * size, .35 * size, 1 * size); }
    } else {
      if (kind < .5) {
        s.put('trunk', tube, m.trunk, p.x, 2.2 * size, p.z, .42 * size, 4.4 * size, .42 * size);
        s.put('canopy', sphere, m.leaf, p.x, 5.6 * size, p.z, 2.8 * size, 2.3 * size, 2.8 * size);
        s.put('canopy2', sphere, m.deep, p.x + 1.7 * size, 4.7 * size, p.z + .8 * size, 1.9 * size, 1.6 * size, 1.9 * size);
        s.put('canopy', sphere, m.leaf, p.x - 1.5 * size, 4.6 * size, p.z - 1 * size, 1.7 * size, 1.4 * size, 1.7 * size);
      } else if (kind < .75) {
        s.put('canopy2', sphere, m.deep, p.x, .7 * size, p.z, 1.7 * size, 1.05 * size, 1.7 * size);
        for (let f = 0; f < 3; f++) s.put(f % 2 ? 'flowerA' : 'flowerB', sphere, f % 2 ? m.pink : m.gold, p.x + Math.cos(turn + f * 2.1) * .9 * size, 1.5 * size, p.z + Math.sin(turn + f * 2.1) * .9 * size, .24);
      } else palm(p.x, p.z, size * 1.15, m.deep, 'fern');
    }
  }
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (reach + 60), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, size = 3 + rand() * 7;
    if (distanceToTrack(track, x, z) > HALF_ROAD + size + 2) s.put('patch', disc, m.patch, x, .012, z, size, 1, size * (.6 + rand() * .5), a);
  }
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2, r = 60 + rand() * 380, x = cx + Math.cos(a) * r, y = 70 + rand() * 45, z = cz + Math.sin(a) * r;
    for (let j = 0; j < 4; j++) s.put('cloud', sphere, m.cloud, x + (j - 1.5) * 8, y + (j % 2 ? 3 : 0), z, 9 + rand() * 5, 5 + rand() * 3, 7 + rand() * 4);
  }
  // Far hills give the horizon a shape for each place.
  const far = mat(trackId === 'snow' ? '#e7eff6' : trackId === 'beach' ? '#86c79a' : '#3f8a52', { roughness: 1 }), far2 = mat(trackId === 'snow' ? '#c9dbe9' : trackId === 'beach' ? '#6fb98a' : '#357a49', { roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + rand() * .3, r = reach + 250 + rand() * 90, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, w = 60 + rand() * 50;
    if (trackId === 'snow') s.put('far' + i % 2, cone, i % 2 ? far : far2, x, 55 + w * .3, z, w, 110 + w * .6, w, a);
    else s.put('far' + i % 2, sphere, i % 2 ? far : far2, x, 0, z, w * 1.3, 28 + w * .35, w * 1.3);
  }
  s.build(world);
  drawMapBase(track);
}

/* ---------- cars ---------- */
function makeCar(color, portrait) {
  const group = new THREE.Group(), body = carTemplate.clone(true);
  let paint;
  body.traverse(o => { if (o.isMesh && o.material.name === 'Paint') { paint = paint || o.material.clone(); o.material = paint; } });
  paint.color.set(color);
  const wheels = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].map(name => { const w = body.getObjectByName(name); w.rotation.order = 'YXZ'; return w; });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#0b2a2c', transparent: true, opacity: .3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.35, 2.7, 1); shadow.position.y = .07;
  const flames = [-1, 1].map(side => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.17, 1.3, 8), new THREE.MeshBasicMaterial({ color: '#ffb22e', transparent: true, opacity: .9 }));
    flame.rotation.x = Math.PI / 2; flame.position.set(side * .27, .34, 2.95); flame.visible = false; return flame;
  });
  group.add(body, shadow, ...flames);
  if (portrait) {
    const texture = new THREE.TextureLoader().load(portrait); texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    face.scale.set(2.1, 2.1, 1); face.position.y = 2.35; group.add(face);
  }
  scene.add(group);
  return { group, wheels, paint, flames, spin: 0 };
}
function updateCars(dt) {
  race.cars.forEach((car, i) => {
    const view = cars[i], pose = trackPose(race.track, car.d, car.lat);
    const yaw = Math.atan2(car.slide, Math.max(car.speed, 8)) * .8;
    view.group.position.set(pose.x, 0, pose.z);
    view.group.rotation.set(0, -(pose.heading + yaw), reducedMotion ? 0 : car.steer * -.03);
    view.spin -= car.speed * dt / .36;
    view.wheels.forEach((wheel, w) => wheel.rotation.set(view.spin, w < 2 ? -car.steer * .32 : 0, 0));
    for (const flame of view.flames) { flame.visible = car.boost > 0; flame.scale.y = .8 + Math.sin(clock * 40 + i) * .25; }
  });
  race.stars.forEach((star, i) => {
    const mesh = starMeshes[i]; if (!mesh) return;
    mesh.visible = !star.taken; mesh.rotation.y = reducedMotion ? 0 : clock * 2 + mesh.userData.spin;
    mesh.position.y = 1.5 + (reducedMotion ? 0 : Math.sin(clock * 3 + mesh.userData.spin) * .15);
  });
}

/* ---------- camera ---------- */
function applyFrame() {
  // Slide the picture so the car stays clear of the garage and finish cards.
  const w = innerWidth, h = innerHeight, narrow = w <= 650, card = phase === 'garage' || phase === 'finished';
  const key = [w, h, phase].join();
  if (key === frameKey) return;
  frameKey = key;
  camera.aspect = w / h; camera.fov = w / h < .8 ? 74 : 58;
  if (!card) camera.clearViewOffset();
  else if (narrow) camera.setViewOffset(w, h, 0, h * .24, w, h);
  else if (h <= 500) camera.setViewOffset(w, h, (phase === 'garage' ? -1 : 1) * w * .2, 0, w, h);
  else camera.setViewOffset(w, h, (phase === 'garage' ? -1 : 1) * w * .14, 0, w, h);
  camera.updateProjectionMatrix();
}
function updateCamera(dt) {
  applyFrame();
  const player = playerOf(race), pose = trackPose(race.track, player.d, player.lat);
  if (racing()) {
    const ahead = trackPose(race.track, player.d + 9, 0).heading;
    cameraHeading += angleDelta(ahead, cameraHeading) * (1 - Math.exp(-5 * dt));
    const tall = camera.aspect < .8, back = tall ? 12.5 : 10.5, sx = Math.sin(cameraHeading), cz = Math.cos(cameraHeading);
    camera.position.set(pose.x - sx * back, tall ? 5.6 : 4.5, pose.z + cz * back);
    camera.lookAt(pose.x + sx * 9, 1.1, pose.z - cz * 9);
    const fov = (tall ? 74 : 58) + (player.boost > 0 && !reducedMotion ? 6 : 0);
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }
  } else {
    const a = pose.heading + 2.5 + (reducedMotion ? 0 : clock * .22), radius = camera.aspect < .8 ? 9.5 : 8.8;
    camera.position.set(pose.x + Math.sin(a) * radius, 2.7, pose.z - Math.cos(a) * radius);
    camera.lookAt(pose.x, .7, pose.z);
    cameraHeading = pose.heading;
  }
}

/* ---------- heads-up display ---------- */
const avatar = car => car.player ? `<i style="background:${paintColor()}" title="Viaan"></i>` : `<img src="../memory-assets/${car.id}.png" alt="${car.name}">`;
function drawMapBase(track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.xs[i]); maxX = Math.max(maxX, track.xs[i]); minZ = Math.min(minZ, track.zs[i]); maxZ = Math.max(maxZ, track.zs[i]); }
  const scale = 160 / Math.max(maxX - minX, maxZ - minZ);
  mapView = { scale, x: 100 - (minX + maxX) / 2 * scale, z: 100 - (minZ + maxZ) / 2 * scale };
  mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 200;
  const g = mapBase.getContext('2d');
  g.lineJoin = g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i <= track.n; i += 4) { const j = i % track.n; g[i ? 'lineTo' : 'moveTo'](track.xs[j] * scale + mapView.x, track.zs[j] * scale + mapView.z); }
  g.closePath(); g.strokeStyle = '#143f42'; g.lineWidth = 13; g.stroke(); g.strokeStyle = '#fff9e9'; g.lineWidth = 8; g.stroke();
}
function drawMap() {
  if (!mapBase) return;
  mapContext.clearRect(0, 0, 200, 200); mapContext.drawImage(mapBase, 0, 0);
  [...race.cars].reverse().forEach(car => {
    const p = trackPose(race.track, car.d, car.lat), x = p.x * mapView.scale + mapView.x, z = p.z * mapView.scale + mapView.z;
    mapContext.beginPath(); mapContext.arc(x, z, car.player ? 10 : 7, 0, Math.PI * 2);
    mapContext.fillStyle = car.player ? paintColor() : RIVALS.find(r => r.id === car.id).color; mapContext.fill();
    mapContext.lineWidth = car.player ? 4 : 2.5; mapContext.strokeStyle = '#143f42'; mapContext.stroke();
  });
}
function updateHud(force = false) {
  const player = playerOf(race), speed = String(Math.round(player.speed * 9));
  if ($('speed').textContent !== speed) $('speed').textContent = speed;
  $('boostBar').style.width = (player.boost / BOOST_SECONDS * 100).toFixed(0) + '%';
  if (!force && clock - lastHud < .12) return;
  lastHud = clock;
  const order = standings(race), key = order.map(c => c.id).join() + prefs.paint;
  $('lapText').textContent = `Lap ${lapOf(race, player)} of ${LAPS}`;
  $('placeText').textContent = ORDINALS[placeOf(race) - 1];
  if (key !== orderKey) { orderKey = key; $('order').innerHTML = order.map(c => `<li class="${c.player ? 'me' : ''}">${avatar(c)}</li>`).join(''); }
  drawMap();
}

/* ---------- garage, race and finish flow ---------- */
function renderGarage() {
  $('swatches').innerHTML = PAINTS.map(p => `<button data-paint="${p.id}" style="background:${p.color}" aria-label="${p.name}" aria-pressed="${p.id === prefs.paint}"></button>`).join('');
  $('tracks').innerHTML = TRACKS.map(t => `<button data-track="${t.id}" aria-pressed="${t.id === prefs.track}"><span aria-hidden="true">${THEMES[t.id].icon}</span><strong>${t.name}</strong><small>${t.blurb}</small></button>`).join('');
}
function resetRace() {
  race = createRace(prefs.track); buildWorld(prefs.track);
  orderKey = ''; $('trackName').textContent = race.track.name.toUpperCase();
  $('countdown').textContent = ''; $('toast').classList.remove('show');
  cameraHeading = trackPose(race.track, playerOf(race).d, 0).heading;
  releaseAll();
}
function openGarage() {
  if ($('finish').open) $('finish').close();
  resetRace(); setPhase('garage'); renderGarage();
  if (!$('garage').open) $('garage').show();
  $('start').focus({ preventScroll: true });
}
function showCount(text) {
  const el = $('countdown'); el.textContent = text;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function startRace() {
  if ($('garage').open) $('garage').close();
  if ($('finish').open) $('finish').close();
  resetRace(); setPhase('countdown'); updateHud(true);
  showCount('3'); tone(440, 0, .25); countdownUntil = Infinity;
  canvas.focus({ preventScroll: true });
}
function showFinish() {
  const place = placeOf(race), order = standings(race);
  const titles = ['You won the race!', 'You came second!', 'You came third!', 'You finished the race!'];
  $('finishKicker').textContent = `${race.track.name.toUpperCase()} · ${LAPS} LAPS`;
  $('finishTitle').textContent = titles[place - 1];
  $('finishText').textContent = 'Super driving, Viaan. What a great race with your friends.';
  $('podium').innerHTML = order.map((c, i) => `<li class="${c.player ? 'me' : ''}"><b>${ORDINALS[i]}</b>${avatar(c)}<span>${c.name}</span></li>`).join('');
  $('finish').showModal(); $('again').focus({ preventScroll: true });
  say(titles[place - 1] + ' Super driving!');
}
function handle(event) {
  if (event === 'count') { showCount(String(Math.ceil(race.countdown))); tone(440, 0, .25); }
  else if (event === 'go') { setPhase('racing'); showCount('GO!'); countdownUntil = clock + .9; tone(880, 0, .6); }
  else if (event === 'star') { toast('Zoom! ⭐', 1.2); chime([784, 1047, 1319], .07); }
  else if (event === 'lap') { toast(`Lap ${lapOf(race, playerOf(race))}!`); chime([659, 880]); }
  else if (event === 'lastlap') { toast('Last lap! 🏁'); chime([659, 880, 1047]); }
  else if (event === 'bump') tone(120, 0, .18, 'triangle', .12);
  else if (event === 'finish') { setPhase('finished'); releaseAll(); chime([523, 659, 784, 1047, 1319], .12); finishAt = clock + 1.5; updateHud(true); }
}
function openMenu() {
  if (!racing() || paused) return;
  paused = true; releaseAll(); updateSound(); $('menu').showModal(); $('resume').focus({ preventScroll: true });
}

/* ---------- input ---------- */
const steering = () => (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0);
function hold(side, source, on) {
  if (on) held[side].add(source); else held[side].delete(source);
  $(side).classList.toggle('down', held[side].size > 0);
}
function releaseAll() { for (const side of ['left', 'right']) { held[side].clear(); $(side).classList.remove('down'); } }
function setupControls() {
  for (const side of ['left', 'right']) {
    const button = $(side);
    button.addEventListener('pointerdown', e => { e.preventDefault(); try { button.setPointerCapture(e.pointerId); } catch {} hold(side, 'p' + e.pointerId, true); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, e => hold(side, 'p' + e.pointerId, false));
    button.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hold(side, 'button', true); } });
    button.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hold(side, 'button', false); });
    button.addEventListener('blur', () => hold(side, 'button', false));
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
  // Touching either half of the picture steers too.
  canvas.addEventListener('pointerdown', e => { if (racing()) hold(e.clientX < innerWidth / 2 ? 'left' : 'right', 'c' + e.pointerId, true); });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(name, e => { hold('left', 'c' + e.pointerId, false); hold('right', 'c' + e.pointerId, false); });
  const keySide = key => ({ ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' })[key];
  window.addEventListener('keydown', e => {
    const side = keySide(e.key);
    if (side && racing() && !paused) { e.preventDefault(); hold(side, 'key', true); }
    else if ((e.key === 'h' || e.key === 'H') && !e.repeat) horn();
    else if ((e.key === 'p' || e.key === 'P') && racing()) openMenu();
  });
  window.addEventListener('keyup', e => { const side = keySide(e.key); if (side) hold(side, 'key', false); });
  $('horn').addEventListener('click', () => { horn(); if (!soundOn) toast('Tap ♫ to hear the horn', 1.6); });
  $('sound').addEventListener('click', toggleSound);
  $('pause').addEventListener('click', openMenu);
  $('menu').addEventListener('close', () => { paused = false; lastTime = 0; updateSound(); });
  $('resume').addEventListener('click', () => $('menu').close());
  $('restart').addEventListener('click', () => { $('menu').close(); startRace(); });
  $('toGarage').addEventListener('click', () => { $('menu').close(); openGarage(); });
  $('start').addEventListener('click', startRace);
  $('again').addEventListener('click', startRace);
  $('change').addEventListener('click', openGarage);
  $('finish').addEventListener('cancel', e => e.preventDefault());
  $('swatches').addEventListener('click', e => {
    const button = e.target.closest('[data-paint]'); if (!button) return;
    prefs = normalizePrefs({ ...prefs, paint: button.dataset.paint }); savePrefs();
    cars[0].paint.color.set(paintColor()); orderKey = '';
    for (const b of $('swatches').children) b.setAttribute('aria-pressed', b === button);
  });
  $('tracks').addEventListener('click', e => {
    const button = e.target.closest('[data-track]'); if (!button) return;
    prefs = normalizePrefs({ ...prefs, track: button.dataset.track }); savePrefs();
    for (const b of $('tracks').children) b.setAttribute('aria-pressed', b === button);
    resetRace();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); openMenu(); } });
  window.addEventListener('blur', () => { releaseAll(); openMenu(); });
  window.addEventListener('pagehide', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
  window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); frameKey = ''; });
}

/* ---------- main loop ---------- */
function update(dt) {
  clock += dt;
  if (phase !== 'garage') for (const event of stepRace(race, steering(), dt)) handle(event);
  if (phase === 'finished' && finishAt && clock >= finishAt) { finishAt = 0; showFinish(); }
  if (countdownUntil && clock >= countdownUntil) { countdownUntil = 0; $('countdown').textContent = ''; }
  if (toastUntil && clock >= toastUntil) { toastUntil = 0; $('toast').classList.remove('show'); }
  updateCars(dt); updateCamera(dt);
  if (phase !== 'garage') updateHud();
  if (engineA && soundOn) {
    const speed = playerOf(race).speed, pitch = 52 + speed * 4.1;
    engineA.frequency.setTargetAtTime(pitch, audio.currentTime, .06); engineB.frequency.setTargetAtTime(pitch * 1.5, audio.currentTime, .06);
  }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .05) : 0; lastTime = now;
  if (!paused) update(dt);
  renderer.render(scene, camera);
}
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .5, 900);
    hemisphere = new THREE.HemisphereLight('#fff6e0', '#7a9a8a', 2.1); scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff3db', 2.4); sun.position.set(60, 120, 40); scene.add(sun);
    canvas.tabIndex = -1;
    carTemplate = (await new GLTFLoader().loadAsync('./assets/supercar.glb')).scene;
    cars.push(makeCar(paintColor(), null), ...RIVALS.map(r => makeCar(r.color, `../memory-assets/${r.id}.png`)));
    setupControls(); openGarage();
    $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true'); $('loading').inert = true;
    window.littleRacer = { get race() { return race; }, get phase() { return phase; } };
    requestAnimationFrame(animate);
  } catch (error) { console.error('Race startup failed', error); fail('Please reload to try again. This game needs a browser with WebGL 2.'); }
}
init();
