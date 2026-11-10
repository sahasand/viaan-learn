import * as THREE from 'three';
import { GLTFLoader } from '../sky-playground/vendor/GLTFLoader.js';
import { clamp, angleDelta, LAPS, HALF_ROAD, EDGE, BOOST_SECONDS, AIR_SECONDS, STORAGE_KEY, PAINTS, RIVALS, TRACKS, getTrack, trackPose, normalizePrefs, createRace, stepRace, playerOf, lapOf, standings, placeOf } from './race.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const THEMES = {
  beach: { icon: '🏖️', top: '#2f9fe6', horizon: '#cfeef4', sun: [.45, .78, .35], road: '#5a626d', kerb: ['#eb6548', '#fff9e9'], hemi: '#c8b27a', dust: '#e6cf96', rock: '#d9b98a', amp: 8,
    land: [[-2, '#dcc487'], [.8, '#f0dba0'], [3, '#b9d789'], [7, '#7fbf6e']] },
  snow: { icon: '🏔️', top: '#5b9de0', horizon: '#e8f2f9', sun: [-.5, .5, .45], road: '#566070', kerb: ['#2f7fe3', '#ffffff'], hemi: '#b9cbd9', dust: '#ffffff', rock: '#bcd6ea', amp: 30,
    land: [[0, '#f4f8fb'], [9, '#e6eff7'], [20, '#cfdfee'], [30, '#b9cfe4']] },
  jungle: { icon: '🌴', top: '#3fa7c4', horizon: '#f4e6b8', sun: [.6, .42, -.5], road: '#575b63', kerb: ['#f7bf12', '#fff9e9'], hemi: '#5c8a4c', dust: '#9ccf7a', rock: '#6d9a5c', amp: 15,
    land: [[0, '#66ad5d'], [4, '#56a257'], [10, '#43934f'], [15, '#357f47']] }
};
const ORDINALS = ['1st', '2nd', '3rd', '4th'];
const FANS = ['bear', 'cat', 'dog', 'duck', 'elephant', 'giraffe', 'lion', 'owl', 'turtle'];
const PARTY = ['#eb6548', '#ffc44e', '#58c7b0', '#f2559c', '#5b8def', '#ffffff'];
let renderer, scene, camera, hemisphere, sun, sky, pmrem, envScene, envGround, envTarget, world, builtTrack = '', carTemplate, race, heightAt = () => 0;
let phase = 'loading', paused = false, soundOn = false, lastTime = 0, clock = 0, lowQuality = false, slowFor = 0;
let toastUntil = 0, countdownUntil = 0, finishAt = 0, nextFirework = 0, lastHud = 0, orderKey = '', cameraHeading = 0, cameraLat = 0, cameraRoll = 0, frameKey = '';
let audio, engineGain, engineA, engineB, mapBase, mapView, weather, dotTexture;
let savedPrefs; try { savedPrefs = localStorage.getItem(STORAGE_KEY); } catch {}
let prefs = normalizePrefs(savedPrefs);
const cars = [], starMeshes = [], lamps = [], crowd = [], floaters = [], shiny = [], faces = {}, held = { left: new Set(), right: new Set() };
const dummy = new THREE.Object3D(), tint = new THREE.Color(), mapContext = $('map').getContext('2d');
const rand = (() => { let n = 2027; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...options });
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
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
function tone(frequency, delay = 0, seconds = .3, type = 'sine', volume = .09, slideTo = 0) {
  if (!soundOn || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, t);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
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

/* ---------- particles: dust, sparkles, smoke and confetti ---------- */
const PMAX = 460, pPos = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pTime = new Float32Array(PMAX), pSize = new Float32Array(PMAX), pFall = new Float32Array(PMAX), pPuff = new Uint8Array(PMAX);
let pMesh, pNext = 0;
function makeParticles() {
  pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial(), PMAX);
  pMesh.frustumCulled = false; dummy.scale.setScalar(0); dummy.updateMatrix();
  for (let i = 0; i < PMAX; i++) { pMesh.setMatrixAt(i, dummy.matrix); pMesh.setColorAt(i, tint.set('#ffffff')); }
  scene.add(pMesh);
}
function spawn(x, y, z, vx, vy, vz, size, seconds, color, fall = 0, puff = 0) {
  if (reducedMotion && puff !== 2) return;
  const i = pNext; pNext = (pNext + 1) % PMAX;
  pPos.set([x, y, z], i * 3); pVel.set([vx, vy, vz], i * 3);
  pLife[i] = pTime[i] = seconds; pSize[i] = size; pFall[i] = fall; pPuff[i] = puff === 1 ? 1 : 0;
  pMesh.setColorAt(i, tint.set(color)); pMesh.instanceColor.needsUpdate = true;
}
function burst(x, y, z, count, speed, size, seconds, colors, fall = 6) {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, up = rand() * 2 - .6, s = speed * (.5 + rand() * .7);
    spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, size * (.6 + rand() * .7), seconds * (.6 + rand() * .6), colors[Math.floor(rand() * colors.length)], fall);
  }
}
function updateParticles(dt) {
  dummy.rotation.set(0, 0, 0);
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; pVel[i * 3 + 1] -= pFall[i] * dt;
    for (let a = 0; a < 3; a++) pPos[i * 3 + a] += pVel[i * 3 + a] * dt;
    const left = Math.max(pLife[i] / pTime[i], 0), size = pLife[i] <= 0 ? 0 : pPuff[i] ? pSize[i] * (1.7 - left) * Math.min(1, left * 2.5) : pSize[i] * Math.min(1, left * 2);
    dummy.position.set(pPos[i * 3], Math.max(pPos[i * 3 + 1], .05), pPos[i * 3 + 2]); dummy.scale.setScalar(size); dummy.updateMatrix();
    pMesh.setMatrixAt(i, dummy.matrix);
  }
  pMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- sky, light and reflections ---------- */
function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 dir; void main(){ dir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir; varying vec3 dir;
      void main(){ vec3 d = normalize(dir); float h = clamp(d.y, 0., 1.);
        vec3 c = mix(horizon, top, pow(h, .5)); float s = max(dot(d, sunDir), 0.);
        c += vec3(1., .95, .78) * (pow(s, 420.) * 1.4 + pow(s, 10.) * .2);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(820, 24, 14), material); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  pmrem = new THREE.PMREMGenerator(renderer); envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 24, 14), material));
  envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial()); envGround.rotation.x = -Math.PI / 2; envGround.position.y = -4; envScene.add(envGround);
}
function setAtmosphere(theme) {
  const u = sky.material.uniforms, dir = new THREE.Vector3(...theme.sun).normalize();
  u.top.value.set(theme.top); u.horizon.value.set(theme.horizon); u.sunDir.value.copy(dir);
  scene.fog = new THREE.Fog(theme.horizon, 120, 500);
  hemisphere.color.set(theme.horizon); hemisphere.groundColor.set(theme.hemi);
  sun.userData.dir = dir;
  envGround.material.color.set(theme.hemi).multiplyScalar(.5);
  if (envTarget) envTarget.dispose();
  envTarget = pmrem.fromScene(envScene, 0, 1, 200);
  for (const material of shiny) { material.envMap = envTarget.texture; material.needsUpdate = true; }
}

/* ---------- track, terrain and scenery ---------- */
function ribbon(track, left, right, y, segmentLength, colorAt, material) {
  const positions = [], colors = [], uvs = [], index = [];
  const segments = Math.round(track.length / segmentLength);
  for (let i = 0; i < segments; i++) {
    const shade = colorAt(i); if (!shade) continue;
    const base = positions.length / 3, d0 = i * track.length / segments, d1 = (i + 1) * track.length / segments;
    tint.set(shade);
    for (const [d, lat, u, v] of [[d0, left, 0, i], [d0, right, 1, i], [d1, left, 0, i + 1], [d1, right, 1, i + 1]]) {
      const p = trackPose(track, d, lat); positions.push(p.x, y, p.z); colors.push(tint.r, tint.g, tint.b); uvs.push(u, v * segmentLength / 8);
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
  mesh.receiveShadow = true; return mesh;
}
function scatterer() {
  const lists = new Map();
  return {
    put(key, geometry, material, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rz = 0) {
      dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, rz); dummy.updateMatrix();
      if (!lists.has(key)) lists.set(key, { geometry, material, matrices: [] });
      lists.get(key).matrices.push(dummy.matrix.clone());
    },
    build(parent, noShadow = []) {
      for (const [key, { geometry, material, matrices }] of lists) {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.castShadow = !noShadow.some(prefix => key.startsWith(prefix)); mesh.receiveShadow = mesh.castShadow;
        parent.add(mesh);
      }
    }
  };
}
function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'));
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
const bannerTexture = () => canvasTexture(1024, 128, g => {
  g.fillStyle = '#fff9e9'; g.fillRect(0, 0, 1024, 128);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) { g.fillStyle = '#143f42'; g.fillRect(x * 32, y * 32, 32, 32); g.fillRect(768 + x * 32, y * 32, 32, 32); }
  g.fillStyle = '#eb6548'; g.font = '900 86px "Avenir Next", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LITTLE RACER', 512, 70);
});
function asphaltTexture(color) {
  const texture = canvasTexture(256, 256, g => {
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = rand() < .5 ? '#ffffff12' : '#00000016'; g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2); }
    g.fillStyle = '#00000012'; g.fillRect(52, 0, 34, 256); g.fillRect(170, 0, 34, 256);
    g.fillStyle = '#fffdf2'; g.fillRect(9, 0, 5, 256); g.fillRect(242, 0, 5, 256); g.fillRect(125, 0, 6, 128);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); return texture;
}
const rampTexture = () => canvasTexture(512, 128, g => {
  g.fillStyle = '#eb6548'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#fff9e9'; g.lineWidth = 16; g.lineJoin = 'miter';
  for (let i = 0; i < 6; i++) { const x = 44 + i * 85; g.beginPath(); g.moveTo(x - 30, 100); g.lineTo(x, 34); g.lineTo(x + 30, 100); g.stroke(); }
});
function face(id) {
  if (!faces[id]) {
    const texture = new THREE.TextureLoader().load(`../memory-assets/${id}.png`); texture.colorSpace = THREE.SRGBColorSpace; texture.userData.keep = true;
    faces[id] = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .05 }); faces[id].userData.keep = true;
  }
  return faces[id];
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
function custom(positions, index, material, uvs) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
function disposeWorld() {
  if (!world) return;
  world.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !o.material.userData.keep) { if (o.material.map && !o.material.map.userData.keep) o.material.map.dispose(); o.material.dispose(); }
  });
  scene.remove(world); starMeshes.length = lamps.length = crowd.length = floaters.length = 0; weather = null;
}
function buildTerrain(track, trackId, theme, cx, cz, reach) {
  const half = reach + 420, cells = 170, size = half * 2 / cells;
  const distance = (x, z) => {
    let best = 1e12;
    for (let i = 0; i < track.n; i += 2) { const dx = track.xs[i] - x, dz = track.zs[i] - z, q = dx * dx + dz * dz; if (q < best) best = q; }
    return Math.sqrt(best);
  };
  // Flat beside the road, rolling into hills further out; the beach slopes into the sea.
  heightAt = (x, z) => {
    const d = distance(x, z), n = .5 + .5 * Math.sin(x * .021 + 1.3) * Math.cos(z * .017 - .6), n2 = .5 + .5 * Math.sin(x * .063 + z * .051);
    let h = smooth(18, 120, d) * theme.amp * (.3 + .7 * n) + smooth(13.5, 34, d) * (.4 + 1.3 * n2);
    if (trackId === 'beach') h -= smooth(reach + 25, reach + 120, Math.hypot(x - cx, z - cz)) * 30;
    return h;
  };
  const positions = [], colors = [], index = [], stops = theme.land, low = new THREE.Color(), high = new THREE.Color();
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) {
    const x = cx - half + i * size, z = cz - half + j * size, h = heightAt(x, z);
    positions.push(x, h, z);
    let k = 0; while (k < stops.length - 2 && h > stops[k + 1][0]) k++;
    low.set(stops[k][1]).lerp(high.set(stops[k + 1][1]), clamp((h - stops[k][0]) / (stops[k + 1][0] - stops[k][0]), 0, 1));
    low.multiplyScalar(.96 + .08 * Math.sin(i * 12.9898 + j * 78.233) ** 2); colors.push(low.r, low.g, low.b);
  }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const a = j * (cells + 1) + i, b = a + 1, c = a + cells + 1, d = c + 1; index.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const land = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  land.receiveShadow = true; world.add(land);
  const under = new THREE.Mesh(new THREE.CircleGeometry(1600, 48), trackId === 'beach'
    ? new THREE.MeshStandardMaterial({ color: '#2fb3c8', roughness: .25, transparent: true, opacity: .86 }) : mat(stops[1][1], { roughness: 1 }));
  under.rotation.x = -Math.PI / 2; under.position.set(cx, trackId === 'beach' ? -1.1 : -6, cz); world.add(under);
}
function buildTunnel(track, theme) {
  const from = track.tunnel.s, to = from + track.tunnel.length, rings = Math.round((to - from) / 2), arc = 14, squash = .78;
  const sweep = (radius, material) => {
    const positions = [], index = [];
    for (let r = 0; r <= rings; r++) for (let a = 0; a <= arc; a++) {
      const angle = Math.PI * a / arc, p = trackPose(track, from + (to - from) * r / rings, Math.cos(angle) * radius);
      positions.push(p.x, Math.sin(angle) * radius * squash, p.z);
    }
    for (let r = 0; r < rings; r++) for (let a = 0; a < arc; a++) { const i = r * (arc + 1) + a; index.push(i, i + 1, i + arc + 1, i + 1, i + arc + 2, i + arc + 1); }
    return custom(positions, index, material);
  };
  const inner = sweep(10.2, mat('#8d98a6', { side: THREE.DoubleSide, roughness: 1, emissive: '#3b4450' })), outer = sweep(13, mat(theme.rock, { side: THREE.DoubleSide, flatShading: true, roughness: 1 }));
  outer.castShadow = true; world.add(inner, outer);
  for (const d of [from, to]) {
    const positions = [], index = [];
    for (let a = 0; a <= arc; a++) for (const radius of [10.2, 13]) {
      const angle = Math.PI * a / arc, p = trackPose(track, d, Math.cos(angle) * radius); positions.push(p.x, Math.sin(angle) * radius * squash, p.z);
    }
    for (let a = 0; a < arc; a++) { const i = a * 2; index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    world.add(custom(positions, index, mat(theme.kerb[0], { side: THREE.DoubleSide, roughness: .7 })));
  }
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe9a8' }), bulb = new THREE.SphereGeometry(.34, 10, 8);
  for (let d = from + 3; d < to; d += 6) for (const lat of [-5, 5]) {
    const p = trackPose(track, d, lat), lamp = new THREE.Mesh(bulb, glow); lamp.position.set(p.x, 6.6, p.z); world.add(lamp);
  }
}
function buildRamps(track) {
  const top = new THREE.MeshStandardMaterial({ map: rampTexture(), roughness: .6 }), side = mat('#28424a', { side: THREE.DoubleSide });
  for (const s of track.ramps) {
    const a = trackPose(track, s - 5, -HALF_ROAD), b = trackPose(track, s - 5, HALF_ROAD), c = trackPose(track, s, -HALF_ROAD), d = trackPose(track, s, HALF_ROAD), h = .58;
    const deck = custom([a.x, .05, a.z, b.x, .05, b.z, c.x, h, c.z, d.x, h, d.z], [0, 1, 2, 1, 3, 2], top, [0, 0, 1, 0, 0, 1, 1, 1]);
    const walls = custom([a.x, .03, a.z, b.x, .03, b.z, c.x, h, c.z, d.x, h, d.z, c.x, .03, c.z, d.x, .03, d.z], [2, 3, 4, 3, 5, 4, 0, 2, 4, 1, 5, 3], side);
    deck.receiveShadow = true; deck.castShadow = walls.castShadow = true; world.add(deck, walls);
  }
}
const inFeature = (track, d, margin) => {
  const s = ((d % track.length) + track.length) % track.length;
  return (s > track.tunnel.s - margin && s < track.tunnel.s + track.tunnel.length + margin) || track.ramps.some(r => s > r - margin && s < r + margin);
};
function buildWorld(trackId) {
  if (builtTrack === trackId) return;
  disposeWorld(); builtTrack = trackId;
  const track = getTrack(trackId), theme = THEMES[trackId];
  world = new THREE.Group(); scene.add(world);
  setAtmosphere(theme);
  let cx = 0, cz = 0, reach = 0;
  for (let i = 0; i < track.n; i++) { cx += track.xs[i] / track.n; cz += track.zs[i] / track.n; }
  for (let i = 0; i < track.n; i++) reach = Math.max(reach, Math.hypot(track.xs[i] - cx, track.zs[i] - cz));
  buildTerrain(track, trackId, theme, cx, cz, reach);

  // Road, kerbs and the chequered start line.
  world.add(ribbon(track, -HALF_ROAD, HALF_ROAD, .03, 2, () => '#ffffff', new THREE.MeshStandardMaterial({ map: asphaltTexture(theme.road), roughness: .82 })));
  for (const side of [-1, 1]) {
    const a = side * HALF_ROAD, b = side * (HALF_ROAD + 1);
    world.add(ribbon(track, Math.min(a, b), Math.max(a, b), .04, 3, i => theme.kerb[i % 2]));
  }
  for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: (row + col) % 2 ? '#fffdf5' : '#1b2a2e' }));
    const p = trackPose(track, -1.4 + row * 1.4 + .7, -6.3 + col * 1.4);
    tile.rotation.set(-Math.PI / 2, -p.heading, 0, 'YXZ'); tile.position.set(p.x, .06, p.z); world.add(tile);
  }
  // Start gate with banner and three countdown lamps.
  const gate = trackPose(track, 0, 0), span = HALF_ROAD + 1.8, post = mat('#fff9e9');
  for (const side of [-1, 1]) {
    const p = trackPose(track, 0, side * span), pillar = new THREE.Mesh(new THREE.CylinderGeometry(.35, .42, 7.8, 12), post);
    pillar.position.set(p.x, 3.9, p.z); pillar.castShadow = true; world.add(pillar);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + .8, 1.7, .5), new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: .7 }));
  banner.position.set(gate.x, 7.4, gate.z); banner.rotation.y = -gate.heading; banner.castShadow = true; world.add(banner);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.5, .4), mat('#22343a')); housing.position.set(gate.x, 5.75, gate.z); housing.rotation.y = -gate.heading; world.add(housing);
  for (const lat of [-2.4, 0, 2.4]) {
    const p = trackPose(track, 0, lat), lamp = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 12), new THREE.MeshBasicMaterial({ color: '#3a2626' }));
    lamp.position.set(p.x, 5.75, p.z); world.add(lamp); lamps.push(lamp);
  }
  buildTunnel(track, theme); buildRamps(track);

  // Boost stars float above the road.
  const starShape = starGeometry();
  for (const star of createRace(trackId).stars) {
    const mesh = new THREE.Mesh(starShape, mat('#ffcf3f', { emissive: '#e29a12', emissiveIntensity: .6, roughness: .35 }));
    const p = trackPose(track, star.s, star.lat); mesh.position.set(p.x, 1.5, p.z); mesh.userData.spin = rand() * 6; mesh.castShadow = true;
    world.add(mesh); starMeshes.push(mesh);
  }

  const sphere = new THREE.SphereGeometry(1, 12, 8), cone = new THREE.ConeGeometry(1, 1, 9), tube = new THREE.CylinderGeometry(1, 1, 1, 8), rock = new THREE.DodecahedronGeometry(1), box = new THREE.BoxGeometry(1, 1, 1);
  const flag = new THREE.BufferGeometry(); flag.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, -1, 0], 3)); flag.computeVertexNormals();
  const m = { trunk: mat('#a9794a'), palm: mat('#4fae5d'), leaf: mat('#2f8f4f'), deep: mat('#237a45'), pine: mat('#2c7a5a'), snow: mat('#ffffff', { roughness: .6 }),
    rock: mat(trackId === 'snow' ? '#aab8c6' : '#b9ab8e', { flatShading: true }), coral: mat('#eb6548'), gold: mat('#ffc44e'), pink: mat('#f58fb4'), hat: mat('#28424a'), cream: mat('#fff9e9'), cloud: mat('#ffffff', { roughness: 1 }) };
  const s = scatterer();

  // Red and white barriers line the outside of every corner.
  for (let d = 0; d < track.length; d += 2.5) {
    const k = trackPose(track, d, 0).k; if (Math.abs(k) < .0105 || inFeature(track, d, 6)) continue;
    const p = trackPose(track, d, -Math.sign(k) * (EDGE + 1.4)), odd = Math.round(d / 2.5) % 2;
    s.put(odd ? 'wallA' : 'wallB', box, odd ? m.coral : m.cream, p.x, .5, p.z, .8, 1, 2.3, -p.heading);
  }
  // Animal fans cheer from the start line and from little groups around the lap.
  const fan = (d, lat, raised) => {
    if (inFeature(track, d, 8)) return;
    const p = trackPose(track, d, lat), sprite = new THREE.Sprite(face(FANS[Math.floor(rand() * FANS.length)]));
    sprite.scale.set(2.1, 2.1, 1); sprite.position.set(p.x, raised + 1.05, p.z); sprite.userData = { base: raised + 1.05, beat: rand() * 6, d: ((d % track.length) + track.length) % track.length, back: raised > 0 };
    if (raised) s.put('stand' + (Math.round(d) % 2), box, Math.round(d) % 2 ? m.coral : m.gold, p.x, raised / 2, p.z, 2.6, raised, 3.3, -p.heading);
    world.add(sprite); crowd.push(sprite);
  };
  for (let d = -27; d < 46; d += 3.3) for (const side of [-1, 1]) { fan(d, side * (HALF_ROAD + 3.3), 0); if (side < 0 || d < 6) fan(d + 1.6, side * (HALF_ROAD + 6), 1.2); }
  for (let g = 1; g < 7; g++) { const d = track.length * g / 7 + 20, side = g % 2 ? 1 : -1; for (let i = 0; i < 3; i++) fan(d + i * 2.4, side * (HALF_ROAD + 3.4), 0); }
  // Bunting hangs over the road in three places.
  for (const part of [.2, .47, .7]) {
    let d = track.length * part; while (inFeature(track, d, 30)) d += 25;
    const heading = trackPose(track, d, 0).heading;
    for (const side of [-1, 1]) { const p = trackPose(track, d, side * (HALF_ROAD + 2.3)); s.put('pole', tube, m.cream, p.x, 3.6, p.z, .12, 7.2, .12); }
    for (let i = 0; i < 17; i++) {
      const t = (i + .5) / 17, p = trackPose(track, d, (t * 2 - 1) * (HALF_ROAD + 2.3));
      s.put('flag' + i % 5, flag, mat(PARTY[i % 5], { side: THREE.DoubleSide }), p.x, 7 - Math.sin(t * Math.PI) * 1.3, p.z, 1, 1.15, 1, -heading);
    }
  }
  // Trees, rocks and friends are scattered beside the road and never placed on it.
  const palm = (x, y, z, size, leafMaterial, key) => {
    s.put('trunk', tube, m.trunk, x, y + 2.8 * size, z, .26 * size, 5.6 * size, .26 * size);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + x; s.put(key, sphere, leafMaterial, x + Math.cos(a) * 1.6 * size, y + 5.5 * size, z + Math.sin(a) * 1.6 * size, 2.1 * size, .2 * size, .65 * size, -a, -.38); }
  };
  for (let i = 0; i < 300; i++) {
    const d = rand() * track.length, side = rand() < .5 ? -1 : 1, p = trackPose(track, d, side * (HALF_ROAD + 7.5 + rand() * rand() * 85));
    const kind = rand(), size = .8 + rand() * .7, turn = rand() * 6, y = heightAt(p.x, p.z);
    let near = 1e9; for (let j = 0; j < track.n; j += 3) near = Math.min(near, Math.hypot(track.xs[j] - p.x, track.zs[j] - p.z));
    if (near < (inFeature(track, d, 10) ? 17 : HALF_ROAD + 7)) continue;
    if (trackId === 'beach') {
      if (y < .15) continue;
      if (kind < .5) palm(p.x, y, p.z, size, m.palm, 'palm');
      else if (kind < .68) { s.put('stick', tube, m.snow, p.x, y + 1.4, p.z, .07, 2.8, .07); s.put(kind < .59 ? 'shadeA' : 'shadeB', cone, kind < .59 ? m.coral : m.gold, p.x, y + 3, p.z, 2.3, .9, 2.3, turn); }
      else if (kind < .86) s.put('rock', rock, m.rock, p.x, y + .4 * size, p.z, 1.3 * size, .8 * size, 1.1 * size, turn);
      else s.put(kind < .93 ? 'ballA' : 'ballB', sphere, kind < .93 ? m.coral : m.gold, p.x, y + .7, p.z, .7);
    } else if (trackId === 'snow') {
      if (kind < .62) {
        s.put('trunk', tube, m.trunk, p.x, y + .6 * size, p.z, .3 * size, 1.2 * size, .3 * size);
        [[2.3, 3, 2.4], [1.8, 2.6, 4], [1.25, 2.2, 5.4]].forEach(([r, h, up]) => s.put('pine', cone, m.pine, p.x, y + up * size, p.z, r * size, h * size, r * size, turn));
        s.put('cap', cone, m.snow, p.x, y + 6.35 * size, p.z, .8 * size, 1.3 * size, .8 * size, turn);
      } else if (kind < .8) {
        [[.95, .8], [.68, 2.05], [.46, 3.0]].forEach(([r, up]) => s.put('snowball', sphere, m.snow, p.x, y + up, p.z, r));
        s.put('hat', tube, m.hat, p.x, y + 3.6, p.z, .3, .5, .3); s.put('hat', tube, m.hat, p.x, y + 3.38, p.z, .5, .07, .5);
        s.put('nose', sphere, m.coral, p.x - Math.cos(p.heading) * .44 * side, y + 3.0, p.z - Math.sin(p.heading) * .44 * side, .14);
      } else { s.put('rock', rock, m.rock, p.x, y + .5 * size, p.z, 1.5 * size, 1 * size, 1.3 * size, turn); s.put('snowball', sphere, m.snow, p.x, y + 1.05 * size, p.z, 1.1 * size, .35 * size, 1 * size); }
    } else {
      if (kind < .5) {
        s.put('trunk', tube, m.trunk, p.x, y + 2.2 * size, p.z, .42 * size, 4.4 * size, .42 * size);
        s.put('canopy', sphere, m.leaf, p.x, y + 5.6 * size, p.z, 2.8 * size, 2.3 * size, 2.8 * size);
        s.put('canopy2', sphere, m.deep, p.x + 1.7 * size, y + 4.7 * size, p.z + .8 * size, 1.9 * size, 1.6 * size, 1.9 * size);
        s.put('canopy', sphere, m.leaf, p.x - 1.5 * size, y + 4.6 * size, p.z - 1 * size, 1.7 * size, 1.4 * size, 1.7 * size);
      } else if (kind < .75) {
        s.put('canopy2', sphere, m.deep, p.x, y + .7 * size, p.z, 1.7 * size, 1.05 * size, 1.7 * size);
        for (let f = 0; f < 3; f++) s.put(f % 2 ? 'flowerA' : 'flowerB', sphere, f % 2 ? m.pink : m.gold, p.x + Math.cos(turn + f * 2.1) * .9 * size, y + 1.5 * size, p.z + Math.sin(turn + f * 2.1) * .9 * size, .24);
      } else palm(p.x, y, p.z, size * 1.15, m.deep, 'fern');
    }
  }
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2, r = 60 + rand() * 420, x = cx + Math.cos(a) * r, y = 75 + rand() * 50, z = cz + Math.sin(a) * r;
    for (let j = 0; j < 4; j++) s.put('cloud', sphere, m.cloud, x + (j - 1.5) * 8, y + (j % 2 ? 3 : 0), z, 9 + rand() * 5, 5 + rand() * 3, 7 + rand() * 4);
  }
  // Far hills give the horizon a shape for each place.
  const far = mat(trackId === 'snow' ? '#e7eff6' : trackId === 'beach' ? '#86c79a' : '#3f8a52', { roughness: 1, flatShading: trackId === 'snow' }), far2 = mat(trackId === 'snow' ? '#c9dbe9' : trackId === 'beach' ? '#6fb98a' : '#357a49', { roughness: 1, flatShading: trackId === 'snow' });
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + rand() * .3, r = reach + 300 + rand() * 110, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, w = 60 + rand() * 60;
    if (trackId === 'snow') s.put('far' + i % 2, cone, i % 2 ? far : far2, x, 60 + w * .35, z, w, 130 + w * .7, w, a);
    else s.put('far' + i % 2, sphere, i % 2 ? far : far2, x, -2, z, w * 1.3, 30 + w * .4, w * 1.3);
  }
  s.build(world, ['cloud', 'far', 'flag', 'flower', 'nose']);

  // Hot-air balloons drift overhead; sailboats bob off the beach.
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group(), a = i * 1.3 + rand(), r = 40 + rand() * (reach * .9), colors = [PARTY[i % 5], PARTY[(i + 1) % 5]];
    const envelope = new THREE.Mesh(sphere, mat(colors[0], { roughness: .6 })); envelope.scale.set(5, 6.2, 5);
    const band = new THREE.Mesh(sphere, mat(colors[1], { roughness: .6 })); band.scale.set(5.12, 1.7, 5.12);
    const basket = new THREE.Mesh(box, m.trunk); basket.scale.set(1.5, 1.2, 1.5); basket.position.y = -8;
    group.add(envelope, band, basket); group.position.set(cx + Math.cos(a) * r, 34 + rand() * 30, cz + Math.sin(a) * r);
    group.userData = { base: group.position.y, beat: rand() * 6, rise: 1.5 }; world.add(group); floaters.push(group);
  }
  if (trackId === 'beach') for (let i = 0; i < 7; i++) {
    const group = new THREE.Group(), a = i / 7 * Math.PI * 2 + .4, r = reach + 150 + rand() * 70;
    const hull = new THREE.Mesh(sphere, i % 2 ? m.coral : m.cream); hull.scale.set(2, 1, 5);
    const mast = new THREE.Mesh(tube, m.trunk); mast.scale.set(.14, 9, .14); mast.position.y = 4.5;
    const sail = new THREE.Mesh(flag, mat('#fffdf5', { side: THREE.DoubleSide })); sail.scale.set(5, -7.5, 1); sail.position.set(0, 1.4, 1.2); sail.rotation.y = Math.PI / 2;
    group.add(hull, mast, sail); group.position.set(cx + Math.cos(a) * r, -1, cz + Math.sin(a) * r); group.rotation.y = a * 3;
    group.userData = { base: -1, beat: rand() * 6, rise: .25 }; world.add(group); floaters.push(group);
  }
  // Snowflakes fall on the mountain; golden pollen drifts through the jungle.
  if (trackId !== 'beach' && !reducedMotion) {
    const count = trackId === 'snow' ? 800 : 320, positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) positions[i] = (rand() - .5) * (i % 3 === 1 ? 44 : 90);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    weather = new THREE.Points(geometry, new THREE.PointsMaterial({ map: dotTexture, color: trackId === 'snow' ? '#ffffff' : '#ffe28a', size: trackId === 'snow' ? .5 : .32, transparent: true, alphaTest: .2, depthWrite: false, fog: false }));
    weather.material.userData.keep = true; weather.frustumCulled = false; weather.userData.fall = trackId === 'snow' ? 6 : -.7; world.add(weather);
  }
  drawMapBase(track);
}
function updateWorld(dt) {
  const player = playerOf(race), length = race.track.length, s = ((player.d % length) + length) % length;
  // Start lamps: red, red, red, then green for go.
  const lit = phase === 'countdown' ? 4 - Math.ceil(race.countdown) : 0, green = phase === 'racing' && race.time < 1.6;
  lamps.forEach((lamp, i) => lamp.material.color.set(green ? '#3df07a' : i < lit ? '#ff3b30' : '#3a2626'));
  for (const fan of crowd) {
    const near = Math.abs(((fan.userData.d - s + length * 1.5) % length) - length / 2) < 45;
    fan.visible = !(lowQuality && fan.userData.back);
    fan.position.y = fan.userData.base + (reducedMotion ? 0 : Math.abs(Math.sin(clock * (near ? 9 : 3) + fan.userData.beat)) * (near ? .55 : .15));
  }
  for (const thing of floaters) if (!reducedMotion) thing.position.y = thing.userData.base + Math.sin(clock * .6 + thing.userData.beat) * thing.userData.rise;
  race.stars.forEach((star, i) => {
    const mesh = starMeshes[i]; if (!mesh) return;
    mesh.visible = !star.taken; mesh.rotation.y = reducedMotion ? 0 : clock * 2 + mesh.userData.spin;
    mesh.position.y = 1.5 + (reducedMotion ? 0 : Math.sin(clock * 3 + mesh.userData.spin) * .15);
  });
  if (weather) {
    const p = weather.geometry.attributes.position, fall = weather.userData.fall;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + Math.sin(clock + i) * .6 * dt, y = p.getY(i) - fall * (.7 + (i % 5) * .12) * dt, z = p.getZ(i);
      if (y < camera.position.y - 14) y += 44; else if (y > camera.position.y + 30) y -= 44;
      if (x < camera.position.x - 45) x += 90; else if (x > camera.position.x + 45) x -= 90;
      if (z < camera.position.z - 45) z += 90; else if (z > camera.position.z + 45) z -= 90;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }
  if (phase === 'finished' && !reducedMotion && clock > nextFirework) {
    nextFirework = clock + .45;
    const pose = trackPose(race.track, player.d + 14, 0), a = rand() * Math.PI * 2;
    burst(pose.x + Math.cos(a) * 16, 9 + rand() * 9, pose.z + Math.sin(a) * 16, 26, 9, .5, 1.4, [PARTY[Math.floor(rand() * 5)], '#ffffff'], 5);
  }
}

/* ---------- cars ---------- */
function makeCar(color, portrait) {
  const group = new THREE.Group(), lift = new THREE.Group(), body = carTemplate.clone(true);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .1, roughness: .34, clearcoat: .9, clearcoatRoughness: .08, envMapIntensity: .5 });
  shiny.push(paint);
  body.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material.name === 'Paint') o.material = paint; } });
  const wheels = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].map(name => { const w = body.getObjectByName(name); w.rotation.order = 'YXZ'; return w; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#0b2a2c', transparent: true, opacity: .3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.scale.set(1.35, 2.7, 1); blob.position.y = .07;
  const flames = [-1, 1].map(side => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.19, 1.6, 8), new THREE.MeshBasicMaterial({ color: '#ffb22e', transparent: true, opacity: .92 }));
    flame.rotation.x = Math.PI / 2; flame.position.set(side * .27, .34, 3.1); flame.visible = false; return flame;
  });
  lift.rotation.order = 'YXZ'; lift.add(body, ...flames);
  if (portrait) { const head = new THREE.Sprite(face(portrait)); head.scale.set(2.1, 2.1, 1); head.position.y = 2.35; lift.add(head); }
  group.add(lift, blob); scene.add(group);
  return { group, lift, wheels, paint, flames, blob, spin: 0, wasOff: false };
}
function updateCars(dt) {
  const theme = THEMES[race.trackId], length = race.track.length;
  race.cars.forEach((car, i) => {
    const view = cars[i], pose = trackPose(race.track, car.d, car.lat), heading = pose.heading + Math.atan2(car.slide, Math.max(car.speed, 8)) * .8;
    const s = ((car.d % length) + length) % length, fx = Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = Math.sin(heading);
    let rise = 0, pitch = 0;
    if (car.air > 0) { const t = 1 - car.air / AIR_SECONDS; rise = .58 * (1 - t) + 9.6 * t * (1 - t); pitch = (.45 - t) * .42; }
    else for (const ramp of race.track.ramps) if (s > ramp - 5 && s <= ramp + .5 && car.d > 0) { rise = .58 * clamp((s - ramp + 5) / 5, 0, 1); pitch = .115; }
    view.group.position.set(pose.x, 0, pose.z); view.group.rotation.y = -heading;
    view.lift.position.y = rise; view.lift.rotation.set(pitch, 0, reducedMotion ? 0 : car.steer * -.045);
    view.spin -= car.speed * dt / .36;
    view.wheels.forEach((wheel, w) => wheel.rotation.set(view.spin, w < 2 ? -car.steer * .32 : 0, 0));
    view.blob.visible = !sun.castShadow; view.blob.scale.set(1.35 / (1 + rise * .25), 2.7 / (1 + rise * .25), 1);
    for (const flame of view.flames) { flame.visible = car.boost > 0; flame.scale.y = .8 + Math.sin(clock * 40 + i) * .3; }
    if (paused || phase === 'garage') return;
    // Effects trail from the back wheels.
    const backX = pose.x - fx * 2, backZ = pose.z - fz * 2, off = Math.abs(car.lat) > HALF_ROAD && !(car.air > 0);
    if (off && car.speed > 4 && rand() < 34 * dt) { const side = rand() < .5 ? -1 : 1; spawn(backX + rx * side * .9, .3, backZ + rz * side * .9, -fx * 2 + (rand() - .5) * 2, 1.2 + rand(), -fz * 2 + (rand() - .5) * 2, .2 + rand() * .14, .55, theme.dust, 0, 1); }
    if (car.player) {
      if (car.boost > 0 && rand() < 70 * dt) spawn(backX + rx * (rand() - .5) * 1.2, .4 + rise + rand() * .4, backZ + rz * (rand() - .5) * 1.2, -fx * 5 + (rand() - .5) * 2, rand() * 2, -fz * 5 + (rand() - .5) * 2, .1 + rand() * .1, .45, rand() < .5 ? '#ffd84a' : '#fff6c9');
      if (!off && !(car.air > 0) && Math.abs(car.steer) > .75 && car.speed > 20 && rand() < 26 * dt) { const side = rand() < .5 ? -1 : 1; spawn(backX + rx * side * .95, .25, backZ + rz * side * .95, -fx, .8, -fz, .26, .5, '#ffffff', 0, 1); }
    }
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
    const ahead = trackPose(race.track, player.d + 9, 0).heading, boosting = player.boost > 0 && !reducedMotion;
    cameraHeading += angleDelta(ahead, cameraHeading) * (1 - Math.exp(-5 * dt));
    // The camera trails the car sideways, so steering visibly swings the car across the picture.
    cameraLat += (player.lat * .7 - cameraLat) * (1 - Math.exp(-3.5 * dt));
    const base = trackPose(race.track, player.d, cameraLat), tall = camera.aspect < .8, back = (tall ? 12.5 : 10.5) + (boosting ? 1.2 : 0), sx = Math.sin(cameraHeading), cz = Math.cos(cameraHeading);
    const hop = player.air > 0 ? Math.sin((1 - player.air / AIR_SECONDS) * Math.PI) * .9 : 0, shake = boosting ? .05 : 0;
    camera.position.set(base.x - sx * back + (rand() - .5) * shake, (tall ? 5.6 : 4.5) + hop + (rand() - .5) * shake, base.z + cz * back);
    camera.lookAt((pose.x + base.x) / 2 + sx * 9, 1.1 + hop * .6, (pose.z + base.z) / 2 - cz * 9);
    if (!reducedMotion) { cameraRoll += (player.steer * -.028 - cameraRoll) * (1 - Math.exp(-4 * dt)); camera.rotateZ(cameraRoll); }
    const fov = (tall ? 74 : 58) + (boosting ? 9 : 0);
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }
  } else {
    const a = pose.heading + 2.5 + (reducedMotion ? 0 : clock * .22), radius = camera.aspect < .8 ? 9.5 : 8.8;
    camera.position.set(pose.x + Math.sin(a) * radius, 2.7, pose.z - Math.cos(a) * radius);
    camera.lookAt(pose.x, .7, pose.z);
    cameraHeading = pose.heading; cameraLat = player.lat * .7; cameraRoll = 0;
  }
  sky.position.copy(camera.position);
  // The sun's shadow box follows the player.
  const dir = sun.userData.dir;
  sun.position.set(pose.x + dir.x * 150, dir.y * 150, pose.z + dir.z * 150); sun.target.position.set(pose.x, 0, pose.z); sun.target.updateMatrixWorld();
  $('rush').classList.toggle('on', racing() && player.boost > 0);
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
  $('countdown').textContent = ''; $('toast').classList.remove('show'); $('rush').classList.remove('on');
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
  const player = playerOf(race), pose = trackPose(race.track, player.d, player.lat);
  if (event === 'count') { showCount(String(Math.ceil(race.countdown))); tone(440, 0, .25); }
  else if (event === 'go') { setPhase('racing'); showCount('GO!'); countdownUntil = clock + .9; tone(880, 0, .6); }
  else if (event === 'star') { toast('Zoom! ⭐', 1.2); chime([784, 1047, 1319], .07); burst(pose.x, 1.4, pose.z, 18, 7, .16, .7, ['#ffd84a', '#fff6c9'], 4); }
  else if (event === 'lap') { toast(`Lap ${lapOf(race, player)}!`); chime([659, 880]); }
  else if (event === 'lastlap') { toast('Last lap! 🏁'); chime([659, 880, 1047]); }
  else if (event === 'jump') { toast('Wheee!', 1); tone(260, 0, .5, 'sine', .08, 880); }
  else if (event === 'land') { tone(90, 0, .22, 'triangle', .14); burst(pose.x, .3, pose.z, 14, 4, .28, .6, [THEMES[race.trackId].dust], 0); }
  else if (event === 'bump') { tone(120, 0, .18, 'triangle', .12); burst(pose.x, .8, pose.z, 8, 5, .2, .4, ['#ffd84a', '#ffffff'], 8); }
  else if (event === 'finish') {
    setPhase('finished'); releaseAll(); chime([523, 659, 784, 1047, 1319], .12); finishAt = clock + 1.6; nextFirework = clock + .3; updateHud(true);
    for (const side of [-1, 1]) { const p = trackPose(race.track, 0, side * (HALF_ROAD + 1)); burst(p.x, 6, p.z, 60, 10, .32, 2.2, PARTY, 7); }
  }
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
  updateCars(dt); updateCamera(dt); updateWorld(dt); updateParticles(dt);
  if (phase !== 'garage') updateHud();
  if (engineA && soundOn) {
    const speed = playerOf(race).speed, pitch = 52 + speed * 4.1;
    engineA.frequency.setTargetAtTime(pitch, audio.currentTime, .06); engineB.frequency.setTargetAtTime(pitch * 1.5, audio.currentTime, .06);
  }
}
function watchSpeed(dt) {
  // A device that cannot keep up drops shadows and sharpness instead of stuttering.
  if (lowQuality || !dt || paused || phase !== 'racing') return;
  slowFor = dt > 1 / 26 ? slowFor + dt : Math.max(0, slowFor - dt * 2);
  if (slowFor > 2.5) { lowQuality = true; sun.castShadow = false; renderer.setPixelRatio(1); }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .05) : 0; lastTime = now;
  if (!paused) update(dt);
  watchSpeed(dt);
  renderer.render(scene, camera);
}
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .5, 1000);
    hemisphere = new THREE.HemisphereLight('#ffffff', '#7a9a8a', 1.7); scene.add(hemisphere);
    sun = new THREE.DirectionalLight('#fff1d6', 2.9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .06;
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 330 });
    scene.add(sun, sun.target);
    dotTexture = canvasTexture(32, 32, g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill(); }); dotTexture.userData.keep = true;
    makeSky(); makeParticles();
    canvas.tabIndex = -1;
    carTemplate = (await new GLTFLoader().loadAsync('./assets/supercar.glb')).scene;
    carTemplate.traverse(o => {
      if (!o.isMesh || shiny.includes(o.material)) return;
      if (o.material.name === 'Glass') Object.assign(o.material, { roughness: .05, metalness: .85, envMapIntensity: 1.1 });
      if (['Glass', 'Silver', 'Charcoal'].includes(o.material.name)) shiny.push(o.material);
    });
    cars.push(makeCar(paintColor(), null), ...RIVALS.map(r => makeCar(r.color, r.id)));
    setupControls(); openGarage();
    $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true'); $('loading').inert = true;
    window.littleRacer = { get race() { return race; }, get phase() { return phase; } };
    requestAnimationFrame(animate);
  } catch (error) { console.error('Race startup failed', error); fail('Please reload to try again. This game needs a browser with WebGL 2.'); }
}
init();
