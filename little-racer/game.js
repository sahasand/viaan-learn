import * as THREE from 'three';
import { GLTFLoader } from '../sky-playground/vendor/GLTFLoader.js';
import { createSound } from './audio.js';
import { clamp, angleDelta, LAPS, HALF_ROAD, EDGE, BOOST_SECONDS, DRIFT_SMALL, DRIFT_BIG, NITRO_COST, LOOP, STORAGE_KEY, PAINTS, TRAILS, CARS, BOSSES, RIVALS, TRACKS, getTrack, trackPose, trackFrame, loopLane, normalizePrefs, buy, award, nextUnlock, carUnlocked, createRace, stepRace, playerOf, lapOf, standings, placeOf } from './race.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const THEMES = {
  beach: { icon: '🏖️', top: '#2f9fe6', horizon: '#cfeef4', sun: [.45, .78, .35], road: '#5a626d', kerb: ['#eb6548', '#fff9e9'], verge: '#ecd9a4', hemi: '#c8b27a', dust: '#e6cf96', rock: '#d9b98a', amp: 8,
    land: [[-2, '#dcc487'], [.8, '#f0dba0'], [5, '#c9da8f'], [11, '#8cc474']] },
  snow: { icon: '🏔️', top: '#5b9de0', horizon: '#e8f2f9', sun: [-.5, .5, .45], road: '#566070', kerb: ['#2f7fe3', '#ffffff'], verge: '#eef4f9', hemi: '#b9cbd9', dust: '#ffffff', rock: '#bcd6ea', amp: 30,
    land: [[0, '#f4f8fb'], [12, '#e6eff7'], [26, '#cfdfee'], [40, '#b9cfe4']] },
  jungle: { icon: '🌴', top: '#3fa7c4', horizon: '#f4e6b8', sun: [.6, .42, -.5], road: '#575b63', kerb: ['#f7bf12', '#fff9e9'], verge: '#7dbb62', hemi: '#5c8a4c', dust: '#9ccf7a', rock: '#6d9a5c', amp: 15,
    land: [[0, '#66ad5d'], [7, '#56a257'], [15, '#43934f'], [24, '#357f47']] }
};
const SWATCH = { gold: 'linear-gradient(135deg,#fff3b0,#ffc21a 45%,#c98a00)', rainbow: 'conic-gradient(#ff5f5f,#ffd24a,#58d68d,#4aa8ff,#b06bff,#ff5f5f)', galaxy: 'radial-gradient(circle at 30% 30%,#8f6bff,#2f1f7a 60%,#150c3d)' };
const TRAIL_ICON = { none: '✕', bubbles: '🫧', ribbon: '🌈', fire: '🔥' };
const ORDINALS = ['1st', '2nd', '3rd', '4th'];
const FANS = ['bear', 'cat', 'dog', 'duck', 'elephant', 'giraffe', 'lion', 'owl', 'turtle'];
const PARTY = ['#eb6548', '#ffc44e', '#58c7b0', '#f2559c', '#5b8def', '#ffffff'];
const sound = createSound();
let renderer, scene, camera, hemisphere, sun, sky, pmrem, envScene, envGround, envTarget, world, builtTrack = '', race, heightAt = () => 0;
let phase = 'loading', paused = false, lastTime = 0, clock = 0, lowQuality = false, slowFor = 0, rewardText = '';
let toastUntil = 0, countdownUntil = 0, finishAt = 0, nextFirework = 0, nextSmoke = 0, lastCoinSound = 0, lastHud = 0, orderKey = '', frameKey = '';
let cameraHeading = 0, cameraLat = 0, cameraRoll = 0, cameraKick = 0;
let mapBase, mapView, weather, dotTexture, coinMesh, coinSpots = [], volcano = null;
let savedPrefs; try { savedPrefs = localStorage.getItem(STORAGE_KEY); } catch {}
let prefs = normalizePrefs(savedPrefs);
const starMeshes = [], lamps = [], crowd = [], floaters = [], fireRings = [], shiny = [], faces = {};
const held = { left: new Set(), right: new Set(), gas: new Set(), brake: new Set(), nitro: new Set() };
// Every vehicle model, where its flames and driver sit, and how big its wheels are.
const SPECS = {
  supercar: { flame: [.27, .34, 3.1], head: [1.72, .3, 1.75], blob: [1.35, 2.7], wheel: .36 },
  truck: { flame: [.5, 1.2, 2.95], head: [3.3, -.05, 2.5], blob: [1.9, 3.2], wheel: .66 },
  formula: { flame: [.12, .5, 2.8], head: [1.5, .1, 1.4], blob: [1.3, 2.9], wheel: .35 }
};
const CAR_ICON = { supercar: 'supercar', truck: 'truck', formula: 'formula' };
const templates = {}, everyView = [], playerViews = {}, bossViews = {}, rivalViews = [];
let views = [], bossMode = false, idleFor = 0, hinted = false;
const basis = new THREE.Matrix4(), vf = new THREE.Vector3(), vu = new THREE.Vector3(), vr = new THREE.Vector3();
const dummy = new THREE.Object3D(), tint = new THREE.Color(), va = new THREE.Vector3(), vb = new THREE.Vector3(), mapContext = $('map').getContext('2d');
const rand = (() => { let n = 2027; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...options });
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const paint = () => PAINTS.find(p => p.id === prefs.paint);
const swatch = p => SWATCH[p.id] || p.color;
const owns = item => !item.cost || prefs.owned.includes(item.id);
const racing = () => phase === 'countdown' || phase === 'racing';

function setPhase(next) { phase = next; document.body.dataset.phase = next; frameKey = ''; updateSound(); }
function savePrefs() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {} }
function toast(text, seconds = 2) { $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = clock + seconds; }
function fail(message) { $('loading').classList.remove('done'); $('loading').classList.add('error'); $('loadText').textContent = message; }
function updateSound() { sound.awake(!paused); if (!racing()) sound.squeal(false); }
async function toggleSound() {
  try {
    const on = await sound.toggle();
    $('sound').setAttribute('aria-pressed', on); $('sound').setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    updateSound();
    if (on) { sound.horn(); if (phase === 'garage') sound.say('Pick a colour, pick a track, then start the race!'); }
  } catch { toast('Sound is unavailable. You can still race!'); }
}

/* ---------- particles: dust, sparkles, smoke and confetti ---------- */
const PMAX = 520, pPos = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pTime = new Float32Array(PMAX), pSize = new Float32Array(PMAX), pFall = new Float32Array(PMAX), pPuff = new Uint8Array(PMAX);
let pMesh, pNext = 0;
function makeParticles() {
  pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial(), PMAX);
  pMesh.frustumCulled = false; dummy.scale.setScalar(0); dummy.updateMatrix();
  for (let i = 0; i < PMAX; i++) { pMesh.setMatrixAt(i, dummy.matrix); pMesh.setColorAt(i, tint.set('#ffffff')); }
  scene.add(pMesh);
}
function spawn(x, y, z, vx, vy, vz, size, seconds, color, fall = 0, puff = 0) {
  if (reducedMotion) return;
  const i = pNext; pNext = (pNext + 1) % PMAX;
  pPos.set([x, y, z], i * 3); pVel.set([vx, vy, vz], i * 3);
  pLife[i] = pTime[i] = seconds; pSize[i] = size; pFall[i] = fall; pPuff[i] = puff;
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
    dummy.position.set(pPos[i * 3], pPos[i * 3 + 1], pPos[i * 3 + 2]); dummy.scale.setScalar(size); dummy.updateMatrix();
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
// A strip of road-following quads; yLeft/yRight are heights above the road surface.
function ribbon(track, left, right, yLeft, yRight, segmentLength, colorAt, material) {
  const positions = [], colors = [], uvs = [], index = [];
  const segments = Math.round(track.length / segmentLength);
  for (let i = 0; i < segments; i++) {
    const shade = colorAt(i); if (!shade) continue;
    const base = positions.length / 3, d0 = i * track.length / segments, d1 = (i + 1) * track.length / segments;
    tint.set(shade);
    for (const [d, lat, u, v] of [[d0, left, 0, i], [d0, right, 1, i], [d1, left, 0, i + 1], [d1, right, 1, i + 1]]) {
      const p = trackPose(track, d, lat); positions.push(p.x, p.y + (u ? yRight : yLeft), p.z); colors.push(tint.r, tint.g, tint.b); uvs.push(u, v * segmentLength / 8);
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
  scene.remove(world); starMeshes.length = lamps.length = crowd.length = floaters.length = fireRings.length = 0; weather = coinMesh = volcano = null;
}
function buildTerrain(track, trackId, theme, cx, cz, reach) {
  const half = reach + 420, cells = 170, size = half * 2 / cells;
  // Distance to the road, plus the road's own height blended from every nearby stretch.
  const field = (x, z) => {
    let best = 1e12, weight = 0, level = 0;
    for (let i = 0; i < track.n; i += 2) {
      const dx = track.xs[i] - x, dz = track.zs[i] - z, q = dx * dx + dz * dz, w = 1 / ((q + 9) * (q + 9));
      if (q < best) best = q;
      weight += w; level += w * track.ys[i];
    }
    return [Math.sqrt(best), level / weight];
  };
  // The ground sits just below the road's wide verge, then rolls into hills; the beach slopes into the sea.
  heightAt = (x, z) => {
    const [d, road] = field(x, z), n = .5 + .5 * Math.sin(x * .021 + 1.3) * Math.cos(z * .017 - .6), n2 = .5 + .5 * Math.sin(x * .063 + z * .051);
    let h = road - .9 * (1 - smooth(17.5, 26, d)) + smooth(26, 130, d) * theme.amp * (.3 + .7 * n) + smooth(22, 42, d) * (.4 + 1.3 * n2);
    if (trackId === 'beach') h -= smooth(reach + 25, reach + 120, Math.hypot(x - cx, z - cz)) * 34;
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
  under.rotation.x = -Math.PI / 2; under.position.set(cx, trackId === 'beach' ? -1.1 : -8, cz); world.add(under);
}
function buildTunnel(track, theme) {
  const from = track.tunnel.s, to = from + track.tunnel.length, rings = Math.round((to - from) / 2), arc = 14, squash = .78;
  const sweep = (radius, material) => {
    const positions = [], index = [];
    for (let r = 0; r <= rings; r++) for (let a = 0; a <= arc; a++) {
      const angle = Math.PI * a / arc, p = trackPose(track, from + (to - from) * r / rings, Math.cos(angle) * radius);
      positions.push(p.x, p.y + Math.sin(angle) * radius * squash, p.z);
    }
    for (let r = 0; r < rings; r++) for (let a = 0; a < arc; a++) { const i = r * (arc + 1) + a; index.push(i, i + 1, i + arc + 1, i + 1, i + arc + 2, i + arc + 1); }
    return custom(positions, index, material);
  };
  const inner = sweep(10.2, mat('#8d98a6', { side: THREE.DoubleSide, roughness: 1, emissive: '#3b4450' })), outer = sweep(13, mat(theme.rock, { side: THREE.DoubleSide, flatShading: true, roughness: 1 }));
  outer.castShadow = true; world.add(inner, outer);
  for (const d of [from, to]) {
    const positions = [], index = [];
    for (let a = 0; a <= arc; a++) for (const radius of [10.2, 13]) {
      const angle = Math.PI * a / arc, p = trackPose(track, d, Math.cos(angle) * radius); positions.push(p.x, p.y + Math.sin(angle) * radius * squash, p.z);
    }
    for (let a = 0; a < arc; a++) { const i = a * 2; index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    world.add(custom(positions, index, mat(theme.kerb[0], { side: THREE.DoubleSide, roughness: .7 })));
  }
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe9a8' }), bulb = new THREE.SphereGeometry(.34, 10, 8);
  for (let d = from + 3; d < to; d += 6) for (const lat of [-5, 5]) {
    const p = trackPose(track, d, lat), lamp = new THREE.Mesh(bulb, glow); lamp.position.set(p.x, p.y + 6.6, p.z); world.add(lamp);
  }
}
function buildRamps(track) {
  const top = new THREE.MeshStandardMaterial({ map: rampTexture(), roughness: .6 }), side = mat('#28424a', { side: THREE.DoubleSide });
  for (const s of track.ramps) {
    const mega = s === track.mega, long = mega ? 9 : 5, h = mega ? 1.3 : .58;
    const a = trackPose(track, s - long, -HALF_ROAD), b = trackPose(track, s - long, HALF_ROAD), c = trackPose(track, s, -HALF_ROAD), d = trackPose(track, s, HALF_ROAD);
    const deck = custom([a.x, a.y + .05, a.z, b.x, b.y + .05, b.z, c.x, c.y + h, c.z, d.x, d.y + h, d.z], [0, 1, 2, 1, 3, 2], top, [0, 0, 1, 0, 0, 1, 1, 1]);
    const walls = custom([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y + h, c.z, d.x, d.y + h, d.z, c.x, c.y, c.z, d.x, d.y, d.z], [2, 3, 4, 3, 5, 4, 0, 2, 4, 1, 5, 3], side);
    deck.receiveShadow = true; deck.castShadow = walls.castShadow = true; world.add(deck, walls);
  }
}
// The loop is a rainbow ribbon swept through the same frames the cars follow.
function buildLoop(track) {
  const positions = [], colors = [], index = [], rails = [], railIndex = [], segments = 84;
  for (let i = 0; i <= segments; i++) {
    const t = clamp(i / segments, .0005, .9995), d = track.loop.s + LOOP.ground * t, lane = loopLane(t);
    const a = trackFrame(track, d, lane - LOOP.half), b = trackFrame(track, d, lane + LOOP.half);
    tint.setHSL((t * 3) % 1, 1, .5);
    for (const f of [a, b]) { positions.push(f.x - f.ux * .03, f.y - f.uy * .03, f.z - f.uz * .03); colors.push(tint.r, tint.g, tint.b); rails.push(f.x, f.y, f.z, f.x + f.ux * .7, f.y + f.uy * .7, f.z + f.uz * .7); }
    if (i < segments) { const k = i * 2; index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); for (const o of [0, 2]) { const r = i * 4 + o; railIndex.push(r, r + 1, r + 4, r + 1, r + 5, r + 4); } }
  }
  const deck = custom(positions, index, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .55 }));
  deck.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const rail = custom(rails, railIndex, mat('#fff9e9', { side: THREE.DoubleSide }));
  deck.castShadow = rail.castShadow = true; world.add(deck, rail);
}
const inFeature = (track, d, margin) => {
  const s = ((d % track.length) + track.length) % track.length;
  return (s > track.tunnel.s - margin && s < track.tunnel.s + track.tunnel.length + margin) || track.ramps.some(r => s > r - margin && s < r + margin + (r === track.mega ? 62 : 0))
    || (s > track.loop.s - LOOP.lead - margin && s < track.loop.s + LOOP.ground + margin);
};
// Each place has one landmark in its biggest clearing and one on the horizon.
function buildLandmarks(track, trackId, s, shapes, m, cx, cz, reach) {
  const { sphere, cone, tube, rock, box, flag } = shapes;
  let spot = { x: cx, z: cz, d: 0 };
  for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
    const x = cx + (i / 25 - .5) * reach * 1.7, z = cz + (j / 25 - .5) * reach * 1.7;
    let d = 1e9; for (let t = 0; t < track.n; t += 4) d = Math.min(d, Math.hypot(track.xs[t] - x, track.zs[t] - z));
    if (d > spot.d) spot = { x, z, d };
  }
  const k = clamp(spot.d / 44, .55, 1.5), x = spot.x, z = spot.z, y = heightAt(x, z) - 1.5;
  const castle = (wall, roof) => {
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      s.put('lmTower', tube, wall, x + i * 9 * k, y + 7 * k, z + j * 9 * k, 2.7 * k, 14 * k, 2.7 * k);
      s.put('lmRoof', cone, roof, x + i * 9 * k, y + 16.5 * k, z + j * 9 * k, 3.5 * k, 5.5 * k, 3.5 * k);
    }
    for (const [i, j] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) s.put('lmWall', box, wall, x + i * 9 * k, y + 4 * k, z + j * 9 * k, i ? 1.6 * k : 18 * k, 8 * k, i ? 18 * k : 1.6 * k);
    s.put('lmWall', box, wall, x, y + 6 * k, z, 11 * k, 12 * k, 11 * k);
    s.put('lmTower', tube, wall, x, y + 12 * k, z, 3.2 * k, 24 * k, 3.2 * k);
    s.put('lmRoof', cone, roof, x, y + 27.5 * k, z, 4.2 * k, 7 * k, 4.2 * k);
    s.put('lmPole', tube, m.cream, x, y + 33 * k, z, .16 * k, 5 * k, .16 * k);
    s.put('lmFlag', flag, mat('#f2559c', { side: THREE.DoubleSide }), x + 1.6 * k, y + 35.3 * k, z, 3.2 * k, 2.2 * k, 1, 0, Math.PI / 2);
  };
  if (trackId === 'beach') {
    castle(mat('#e9cf8f', { roughness: 1 }), m.coral);
    // A striped lighthouse stands on a rock out at sea.
    const a = 2.2, lx = cx + Math.cos(a) * (reach + 105), lz = cz + Math.sin(a) * (reach + 105);
    s.put('lmRock', rock, m.rock, lx, -1, lz, 15, 6, 13, .7);
    for (let band = 0; band < 6; band++) s.put('lmBand' + band % 2, tube, band % 2 ? m.cream : m.coral, lx, 5 + band * 4.6, lz, 3.4 - band * .22, 4.6, 3.4 - band * .22);
    s.put('lmBand1', tube, m.cream, lx, 32.8, lz, 3.3, .7, 3.3);
    s.put('glow', sphere, new THREE.MeshBasicMaterial({ color: '#fff3a8' }), lx, 35, lz, 2);
    s.put('lmRoof', cone, m.coral, lx, 38.5, lz, 3, 3.4, 3);
  } else if (trackId === 'snow') {
    castle(mat('#cfe9fb', { roughness: .25, metalness: .1 }), mat('#6fa8e6', { roughness: .4 }));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + .5, ix = x + Math.cos(a) * 30 * k, iz = z + Math.sin(a) * 30 * k, iy = heightAt(ix, iz);
      s.put('snowball', sphere, m.snow, ix, iy, iz, 4.2, 3.3, 4.2); s.put('hat', box, m.hat, ix + Math.cos(a) * 3.9, iy + .9, iz + Math.sin(a) * 3.9, 1.5, 1.9, 1.5, -a);
    }
  } else {
    // A stepped temple with a golden top, and a smoking volcano far away.
    const stone = mat('#b9ab8c', { roughness: 1, flatShading: true });
    for (let tier = 0; tier < 5; tier++) s.put('lmStep', box, stone, x, y + 2 + tier * 3.6 * k, z, (30 - tier * 5.5) * k, 3.6 * k + (tier ? 0 : 4), (30 - tier * 5.5) * k);
    s.put('lmGold', box, mat('#ffc44e', { roughness: .3, metalness: .6 }), x, y + 20.5 * k, z, 5 * k, 3.4 * k, 5 * k);
    s.put('lmStair', box, m.cream, x, y + 9 * k, z + 9.5 * k, 5 * k, 18 * k, 13 * k);
    for (const side of [-1, 1]) s.put('glow', sphere, new THREE.MeshBasicMaterial({ color: '#ff8a2e' }), x + side * 5 * k, y + 20 * k, z + 12 * k, .9 * k);
    const a = 4.1, vx = cx + Math.cos(a) * (reach + 250), vz = cz + Math.sin(a) * (reach + 250);
    s.put('far9', cone, mat('#5d4b44', { roughness: 1, flatShading: true }), vx, 55, vz, 105, 125, 105, .4);
    s.put('glowLava', sphere, new THREE.MeshBasicMaterial({ color: '#ff6a1f', fog: false }), vx, 112, vz, 20, 8, 20);
    volcano = { x: vx, y: 118, z: vz };
  }
}
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

  // Road, kerbs, a wide level verge that slopes down to the ground, and the chequered start line.
  world.add(ribbon(track, -HALF_ROAD, HALF_ROAD, .03, .03, 2, () => '#ffffff', new THREE.MeshStandardMaterial({ map: asphaltTexture(theme.road), roughness: .82 })));
  for (const side of [-1, 1]) {
    const edge = (a, b, ya, yb, length, color) => world.add(side < 0 ? ribbon(track, -b, -a, yb, ya, length, color) : ribbon(track, a, b, ya, yb, length, color));
    edge(HALF_ROAD, HALF_ROAD + 1, .04, .04, 3, i => theme.kerb[i % 2]);
    edge(HALF_ROAD + 1, 14, 0, 0, 3, () => theme.verge);
    edge(14, 18.5, 0, -1.3, 3, () => theme.verge);
  }
  for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: (row + col) % 2 ? '#fffdf5' : '#1b2a2e' }));
    const p = trackPose(track, -1.4 + row * 1.4 + .7, -6.3 + col * 1.4);
    tile.rotation.set(-Math.PI / 2, -p.heading, 0, 'YXZ'); tile.position.set(p.x, p.y + .06, p.z); world.add(tile);
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
  buildTunnel(track, theme); buildRamps(track); buildLoop(track);

  // Boost stars and coins float above the road; air coins follow the arc of a jump.
  const starShape = starGeometry(), sample = createRace(trackId);
  for (const star of sample.stars) {
    const mesh = new THREE.Mesh(starShape, mat('#ffcf3f', { emissive: '#e29a12', emissiveIntensity: .6, roughness: .35 }));
    const p = trackPose(track, star.s, star.lat); mesh.position.set(p.x, p.y + 1.5, p.z); mesh.userData = { spin: rand() * 6, base: p.y + 1.5 }; mesh.castShadow = true;
    world.add(mesh); starMeshes.push(mesh);
  }
  const coinShape = new THREE.CylinderGeometry(.6, .6, .14, 18); coinShape.rotateX(Math.PI / 2);
  coinMesh = new THREE.InstancedMesh(coinShape, mat('#ffcf3f', { emissive: '#c98a00', emissiveIntensity: .45, metalness: .5, roughness: .3 }), sample.coins.length);
  coinMesh.frustumCulled = false; coinMesh.castShadow = true; world.add(coinMesh);
  coinSpots = sample.coins.map(coin => {
    if (coin.loop) { const f = trackFrame(track, coin.s, coin.lat); return { x: f.x + f.ux * 1.05, y: f.y + f.uy * 1.05, z: f.z + f.uz * 1.05 }; }
    const p = trackPose(track, coin.s, coin.lat), ramp = coin.air ? track.ramps.find(r => coin.s > r && coin.s < r + 62) : 0, mega = ramp === track.mega, t = coin.air ? (coin.s - ramp) / (mega ? 50 : 25) : 0;
    return { x: p.x, y: p.y + (coin.air ? 1.5 + (mega ? 30 : 9.6) * t * (1 - t) : 1.05), z: p.z };
  });

  const shapes = { sphere: new THREE.SphereGeometry(1, 12, 8), cone: new THREE.ConeGeometry(1, 1, 9), tube: new THREE.CylinderGeometry(1, 1, 1, 10), rock: new THREE.DodecahedronGeometry(1), box: new THREE.BoxGeometry(1, 1, 1), flag: new THREE.BufferGeometry() };
  const { sphere, cone, tube, rock, box, flag } = shapes;
  flag.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, -1, 0], 3)); flag.computeVertexNormals();
  const m = { trunk: mat('#a9794a'), palm: mat('#4fae5d'), leaf: mat('#2f8f4f'), deep: mat('#237a45'), pine: mat('#2c7a5a'), snow: mat('#ffffff', { roughness: .6 }),
    rock: mat(trackId === 'snow' ? '#aab8c6' : '#b9ab8e', { flatShading: true }), coral: mat('#eb6548'), gold: mat('#ffc44e'), pink: mat('#f58fb4'), hat: mat('#28424a'), cream: mat('#fff9e9'), cloud: mat('#ffffff', { roughness: 1 }) };
  const s = scatterer();

  // The mega jump flies over a line of buses and through two rings of fire.
  for (const lane of [-3.5, 3.5]) for (let k = 0; k < 3; k++) {
    const p = trackPose(track, track.mega + 14 + k * 11.6, lane), n = (k + (lane > 0 ? 1 : 0)) % 3;
    s.put('bus' + n, box, mat([PARTY[0], PARTY[1], PARTY[4]][n]), p.x, p.y + 1.75, p.z, 2.7, 2.9, 10.6, -p.heading);
    s.put('busGlass', box, m.hat, p.x, p.y + 2.35, p.z, 2.76, .85, 9.4, -p.heading); s.put('busWheels', box, m.hat, p.x, p.y + .35, p.z, 2.8, .7, 7.6, -p.heading);
  }
  for (const t of [.3, .68]) {
    const p = trackPose(track, track.mega + 50 * t, 0), ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, .5, 10, 40), new THREE.MeshBasicMaterial({ color: '#ff8a1e' }));
    ring.position.set(p.x, p.y + 1.3 * (1 - t) + 30 * t * (1 - t) + .9, p.z); ring.rotation.y = -p.heading; world.add(ring);
    fireRings.push({ x: ring.position.x, y: ring.position.y, z: ring.position.z, rx: Math.cos(p.heading), rz: Math.sin(p.heading) });
  }
  // Red and white barriers line the outside of every corner.
  for (let d = 0; d < track.length; d += 2.5) {
    const k = trackPose(track, d, 0).k; if (Math.abs(k) < .0105 || inFeature(track, d, 6)) continue;
    const p = trackPose(track, d, -Math.sign(k) * (EDGE + 1.4)), odd = Math.round(d / 2.5) % 2;
    s.put(odd ? 'wallA' : 'wallB', box, odd ? m.coral : m.cream, p.x, p.y + .5, p.z, .8, 1, 2.3, -p.heading);
  }
  // Animal fans cheer from the start line and from little groups around the lap.
  const fan = (d, lat, raised) => {
    if (inFeature(track, d, 8)) return;
    const p = trackPose(track, d, lat), sprite = new THREE.Sprite(face(FANS[Math.floor(rand() * FANS.length)]));
    sprite.scale.set(2.1, 2.1, 1); sprite.position.set(p.x, p.y + raised + 1.05, p.z); sprite.userData = { base: p.y + raised + 1.05, beat: rand() * 6, d: ((d % track.length) + track.length) % track.length, back: raised > 0 };
    if (raised) s.put('stand' + (Math.round(d) % 2), box, Math.round(d) % 2 ? m.coral : m.gold, p.x, p.y + raised / 2, p.z, 2.4, raised, 3.3, -p.heading);
    world.add(sprite); crowd.push(sprite);
  };
  for (let d = -27; d < 46; d += 3.3) for (const side of [-1, 1]) { fan(d, side * (HALF_ROAD + 3.3), 0); if (side < 0 || d < 6) fan(d + 1.6, side * (HALF_ROAD + 5.6), 1.2); }
  for (let g = 1; g < 7; g++) { const d = track.length * g / 7 + 20, side = g % 2 ? 1 : -1; for (let i = 0; i < 3; i++) fan(d + i * 2.4, side * (HALF_ROAD + 3.4), 0); }
  // Bunting hangs over the road in three places.
  for (const part of [.2, .47, .7]) {
    let d = track.length * part; while (inFeature(track, d, 30)) d += 25;
    const centre = trackPose(track, d, 0);
    for (const side of [-1, 1]) { const p = trackPose(track, d, side * (HALF_ROAD + 2.3)); s.put('pole', tube, m.cream, p.x, p.y + 3.6, p.z, .12, 7.2, .12); }
    for (let i = 0; i < 17; i++) {
      const t = (i + .5) / 17, p = trackPose(track, d, (t * 2 - 1) * (HALF_ROAD + 2.3));
      s.put('flag' + i % 5, flag, mat(PARTY[i % 5], { side: THREE.DoubleSide }), p.x, p.y + 7 - Math.sin(t * Math.PI) * 1.3, p.z, 1, 1.15, 1, -centre.heading);
    }
  }
  // Trees, rocks and friends are scattered beyond the verge and never placed on the road.
  const palm = (x, y, z, size, leafMaterial, key) => {
    s.put('trunk', tube, m.trunk, x, y + 2.8 * size, z, .26 * size, 5.6 * size, .26 * size);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + x; s.put(key, sphere, leafMaterial, x + Math.cos(a) * 1.6 * size, y + 5.5 * size, z + Math.sin(a) * 1.6 * size, 2.1 * size, .2 * size, .65 * size, -a, -.38); }
  };
  for (let i = 0; i < 340; i++) {
    const d = rand() * track.length, side = rand() < .5 ? -1 : 1, p = trackPose(track, d, side * (20 + rand() * rand() * 85));
    const kind = rand(), size = .8 + rand() * .7, turn = rand() * 6, y = heightAt(p.x, p.z) - .15;
    let near = 1e9; for (let j = 0; j < track.n; j += 3) near = Math.min(near, Math.hypot(track.xs[j] - p.x, track.zs[j] - p.z));
    if (near < 19.5) continue;
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
  buildLandmarks(track, trackId, s, shapes, m, cx, cz, reach);
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2, r = 60 + rand() * 420, x = cx + Math.cos(a) * r, y = 85 + rand() * 50, z = cz + Math.sin(a) * r;
    for (let j = 0; j < 4; j++) s.put('cloud', sphere, m.cloud, x + (j - 1.5) * 8, y + (j % 2 ? 3 : 0), z, 9 + rand() * 5, 5 + rand() * 3, 7 + rand() * 4);
  }
  // Far hills give the horizon a shape for each place.
  const far = mat(trackId === 'snow' ? '#e7eff6' : trackId === 'beach' ? '#86c79a' : '#3f8a52', { roughness: 1, flatShading: trackId === 'snow' }), far2 = mat(trackId === 'snow' ? '#c9dbe9' : trackId === 'beach' ? '#6fb98a' : '#357a49', { roughness: 1, flatShading: trackId === 'snow' });
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + rand() * .3, r = reach + 300 + rand() * 110, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, w = 60 + rand() * 60;
    if (trackId === 'snow') s.put('far' + i % 2, cone, i % 2 ? far : far2, x, 60 + w * .35, z, w, 130 + w * .7, w, a);
    else s.put('far' + i % 2, sphere, i % 2 ? far : far2, x, -2, z, w * 1.3, 30 + w * .4, w * 1.3);
  }
  s.build(world, ['cloud', 'far', 'flag', 'flower', 'nose', 'glow', 'lmFlag', 'busGlass']);

  // Hot-air balloons drift overhead; sailboats bob off the beach.
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group(), a = i * 1.3 + rand(), r = 40 + rand() * (reach * .9), colors = [PARTY[i % 5], PARTY[(i + 1) % 5]];
    const envelope = new THREE.Mesh(sphere, mat(colors[0], { roughness: .6 })); envelope.scale.set(5, 6.2, 5);
    const band = new THREE.Mesh(sphere, mat(colors[1], { roughness: .6 })); band.scale.set(5.12, 1.7, 5.12);
    const basket = new THREE.Mesh(box, m.trunk); basket.scale.set(1.5, 1.2, 1.5); basket.position.y = -8;
    group.add(envelope, band, basket); group.position.set(cx + Math.cos(a) * r, 48 + rand() * 30, cz + Math.sin(a) * r);
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
    mesh.position.y = mesh.userData.base + (reducedMotion ? 0 : Math.sin(clock * 3 + mesh.userData.spin) * .15);
  });
  if (coinMesh) {
    race.coins.forEach((coin, i) => {
      const spot = coinSpots[i]; dummy.position.set(spot.x, spot.y, spot.z); dummy.rotation.set(0, reducedMotion ? .6 : clock * 3 + i * .5, 0); dummy.scale.setScalar(coin.taken ? 0 : 1); dummy.updateMatrix();
      coinMesh.setMatrixAt(i, dummy.matrix);
    });
    coinMesh.instanceMatrix.needsUpdate = true;
  }
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
  for (const ring of fireRings) for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2;
    spawn(ring.x + ring.rx * Math.cos(a) * 4.4, ring.y + Math.sin(a) * 4.4, ring.z + ring.rz * Math.cos(a) * 4.4, (rand() - .5), 1.5 + rand() * 2, (rand() - .5), .35 + rand() * .3, .5, rand() < .5 ? '#ffd23f' : '#ff5a1e');
  }
  if (volcano && clock > nextSmoke) { nextSmoke = clock + .35; spawn(volcano.x + (rand() - .5) * 14, volcano.y, volcano.z + (rand() - .5) * 14, 2 + rand() * 2, 7 + rand() * 3, rand() * 2, 9, 7, rand() < .5 ? '#8d8580' : '#b3aaa3', 0, 1); }
  if (phase === 'finished' && clock > nextFirework) {
    nextFirework = clock + .45;
    const pose = trackPose(race.track, player.d + 14, 0), a = rand() * Math.PI * 2;
    burst(pose.x + Math.cos(a) * 16, pose.y + 9 + rand() * 9, pose.z + Math.sin(a) * 16, 26, 9, .5, 1.4, [PARTY[Math.floor(rand() * 5)], '#ffffff'], 5);
  }
}

/* ---------- cars ---------- */
function applyPaint(material, id) {
  const p = PAINTS.find(item => item.id === id);
  material.color.set(p.color); material.emissive.set('#000000');
  if (id === 'gold') Object.assign(material, { metalness: .95, roughness: .22, envMapIntensity: 1.15 });
  else if (id === 'galaxy') { Object.assign(material, { metalness: .7, roughness: .25, envMapIntensity: .9, emissiveIntensity: .4 }); material.emissive.set('#3a1fa8'); }
  else Object.assign(material, { metalness: .1, roughness: .34, envMapIntensity: .5 });
}
function makeCar(model, color, portrait) {
  const spec = SPECS[model], group = new THREE.Group(), lift = new THREE.Group(), body = templates[model].clone(true);
  const coat = new THREE.MeshPhysicalMaterial({ color, metalness: .1, roughness: .34, clearcoat: .9, clearcoatRoughness: .08, envMapIntensity: .5 });
  shiny.push(coat); if (envTarget) coat.envMap = envTarget.texture;
  body.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material.name === 'Paint') o.material = coat; } });
  const wheels = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'].map(name => { const w = body.getObjectByName(name); w.rotation.order = 'YXZ'; return w; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#0b2a2c', transparent: true, opacity: .3, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.scale.set(spec.blob[0], spec.blob[1], 1); blob.position.y = .07;
  const flames = [-1, 1].map(side => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.19, 1.6, 8), new THREE.MeshBasicMaterial({ color: '#ffb22e', transparent: true, opacity: .92 }));
    flame.rotation.x = Math.PI / 2; flame.position.set(side * spec.flame[0], spec.flame[1], spec.flame[2]); flame.visible = false; return flame;
  });
  lift.rotation.order = 'YXZ'; lift.add(body, ...flames);
  // Each animal pokes its head out through the roof of its car.
  if (portrait) { const head = new THREE.Sprite(face(portrait)); head.scale.set(spec.head[2], spec.head[2], 1); head.position.set(0, spec.head[0], spec.head[1]); lift.add(head); }
  group.add(lift, blob); group.visible = false; scene.add(group);
  const view = { model, spec, group, lift, wheels, paint: coat, flames, blob, spin: 0 };
  everyView.push(view); return view;
}
// Puts the right vehicles on the grid: Viaan's chosen one, then his friends or the boss.
function seatViews() {
  for (const view of everyView) view.group.visible = false;
  const mine = playerViews[prefs.car] || (playerViews[prefs.car] = makeCar(prefs.car, paint().color, null));
  applyPaint(mine.paint, prefs.paint);
  if (race.boss) {
    const boss = BOSSES[race.trackId];
    views = [mine, bossViews[boss.id] || (bossViews[boss.id] = makeCar('truck', boss.color, boss.id))];
  } else views = [mine, ...rivalViews];
  for (const view of views) view.group.visible = true;
}
function updateCars(dt) {
  const theme = THEMES[race.trackId], track = race.track, length = track.length;
  if (prefs.paint === 'rainbow') views[0].paint.color.setHSL((clock * .12) % 1, .85, .55);
  race.cars.forEach((car, i) => {
    const view = views[i], f = trackFrame(track, car.d, car.lat), drifting = car.drift > .3, looping = f.loop >= 0, flying = car.air > 0;
    const heading = f.heading + Math.atan2(car.slide, Math.max(car.speed, 8)) * .8 + (drifting ? car.driftDir * Math.min(car.drift, 1) * .3 : 0);
    const s = ((car.d % length) + length) % length, fx = Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = Math.sin(heading);
    let rise = 0, pitch = looping ? 0 : Math.atan(f.slope);
    if (flying) { const mega = car.airTime > 1.2, t = 1 - car.air / car.airTime; rise = (mega ? 1.3 : .58) * (1 - t) + (mega ? 30 : 9.6) * t * (1 - t); pitch += (.45 - t) * (mega ? .62 : .42); }
    else if (!looping) for (const ramp of track.ramps) {
      const mega = ramp === track.mega, long = mega ? 9 : 5, top = mega ? 1.3 : .58;
      if (s > ramp - long && s <= ramp + .5 && car.d > 0) { rise = top * clamp((s - ramp + long) / long, 0, 1); pitch += Math.atan(top / long); }
    }
    if (car.boost > 0 && !flying && !looping) pitch += .035;
    view.group.position.set(f.x, f.y, f.z);
    if (looping) {
      // Going round the loop the car follows the ribbon, wheels down on it all the way.
      vf.set(f.fx, f.fy, f.fz); vu.set(f.ux, f.uy, f.uz); vr.crossVectors(vf, vu);
      view.group.quaternion.setFromRotationMatrix(basis.makeBasis(vr, vu, vf.negate()));
    } else view.group.rotation.set(0, -heading, 0);
    view.lift.position.y = rise; view.lift.rotation.set(pitch, 0, reducedMotion || looping ? 0 : car.steer * -.045 - (drifting ? car.driftDir * .05 : 0));
    view.spin -= car.speed * dt / view.spec.wheel;
    view.wheels.forEach((wheel, w) => wheel.rotation.set(view.spin, w < 2 ? -car.steer * .32 : 0, 0));
    view.blob.visible = !sun.castShadow && !looping; view.blob.scale.set(view.spec.blob[0] / (1 + rise * .25), view.spec.blob[1] / (1 + rise * .25), 1);
    for (const flame of view.flames) { flame.visible = car.boost > 0; flame.scale.y = .8 + Math.sin(clock * 40 + i) * .3; }
    if (paused || phase === 'garage' || looping) return;
    // Effects trail from the back wheels.
    const backX = f.x - fx * 2, backZ = f.z - fz * 2, ground = f.y + rise, off = Math.abs(car.lat) > HALF_ROAD && !flying, wheel = () => (rand() < .5 ? -1 : 1) * .95;
    if (off && car.speed > 4 && rand() < 34 * dt) { const w = wheel(); spawn(backX + rx * w, ground + .3, backZ + rz * w, -fx * 2 + (rand() - .5) * 2, 1.2 + rand(), -fz * 2 + (rand() - .5) * 2, .2 + rand() * .14, .55, theme.dust, 0, 1); }
    if (!car.player) return;
    if (car.boost > 0 && rand() < 70 * dt) spawn(backX + rx * (rand() - .5) * 1.2, ground + .4 + rand() * .4, backZ + rz * (rand() - .5) * 1.2, -fx * 5 + (rand() - .5) * 2, rand() * 2, -fz * 5 + (rand() - .5) * 2, .1 + rand() * .1, .45, rand() < .5 ? '#ffd84a' : '#fff6c9');
    if (drifting && rand() < (car.drift >= DRIFT_SMALL ? 70 : 24) * dt) {
      const w = wheel(), level = car.drift >= DRIFT_BIG ? '#ff9a2e' : car.drift >= DRIFT_SMALL ? '#5bc8ff' : '#ffffff';
      if (car.drift >= DRIFT_SMALL) spawn(backX + rx * w, ground + .2, backZ + rz * w, -fx * 3 + (rand() - .5) * 4, 2 + rand() * 3, -fz * 3 + (rand() - .5) * 4, .09 + rand() * .06, .32, level, 9);
      else spawn(backX + rx * w, ground + .25, backZ + rz * w, -fx, .8, -fz, .24, .5, level, 0, 1);
    }
    if (phase === 'racing' && car.speed > 12 && prefs.trail !== 'none') {
      const w = wheel();
      if (prefs.trail === 'bubbles' && rand() < 18 * dt) spawn(backX + rx * w, ground + .5, backZ + rz * w, -fx + (rand() - .5), 1.4 + rand(), -fz + (rand() - .5), .14 + rand() * .16, 1.1, rand() < .5 ? '#bfe9ff' : '#ffffff', -.6, 1);
      if (prefs.trail === 'ribbon' && rand() < 46 * dt) spawn(backX + rx * w, ground + .45, backZ + rz * w, -fx * 1.5, .3, -fz * 1.5, .12, .7, PARTY[Math.floor(clock * 9) % 5]);
      if (prefs.trail === 'fire' && rand() < 46 * dt) spawn(backX + rx * w * .4, ground + .4, backZ + rz * w * .4, -fx * 2 + (rand() - .5), 1.5 + rand() * 1.5, -fz * 2 + (rand() - .5), .15 + rand() * .1, .42, ['#ff7a1a', '#ffd23f', '#ff3b30'][Math.floor(rand() * 3)]);
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
  else if (narrow) camera.setViewOffset(w, h, 0, h * (phase === 'garage' ? .3 : .24), w, h);
  else if (h <= 500) camera.setViewOffset(w, h, (phase === 'garage' ? -1 : 1) * w * .24, 0, w, h);
  else camera.setViewOffset(w, h, (phase === 'garage' ? -1 : 1) * w * .14, 0, w, h);
  camera.updateProjectionMatrix();
}
function updateCamera(dt) {
  applyFrame();
  const player = playerOf(race), track = race.track, pose = trackPose(track, player.d, player.lat), f = trackFrame(track, player.d, player.lat), tall = camera.aspect < .8;
  camera.up.set(0, 1, 0);
  if (racing() && f.loop >= 0) {
    if (reducedMotion) {
      // A calm side view for the trip round the loop.
      const mid = trackPose(track, track.loop.s + LOOP.ground / 2, 0);
      camera.position.set(mid.x + Math.cos(mid.heading) * 40, mid.y + 12, mid.z + Math.sin(mid.heading) * 40); camera.lookAt(mid.x, mid.y + LOOP.radius, mid.z);
    } else {
      // The camera rides round the loop behind the car, upside down at the top.
      // It sits on the ribbon a little way behind, lifted toward the middle of the loop, so it never leaves the inside.
      const b = trackFrame(track, player.d - (tall ? 2.7 : 2.4), player.lat), high = tall ? 2 : 1.6;
      camera.up.set(f.ux, f.uy, f.uz);
      camera.position.set(b.x + b.ux * high, b.y + b.uy * high, b.z + b.uz * high);
      camera.lookAt(f.x + f.fx + f.ux * 1.4, f.y + f.fy + f.uy * 1.4, f.z + f.fz + f.uz * 1.4);
    }
    cameraHeading = trackPose(track, track.loop.s + LOOP.ground + 9, 0).heading; cameraLat = player.lat * .7; cameraRoll = 0;
  } else if (racing()) {
    const far = trackPose(track, player.d + 9, 0), boosting = player.boost > 0 && !reducedMotion;
    cameraHeading += angleDelta(far.heading, cameraHeading) * (1 - Math.exp(-5 * dt));
    // The camera trails the car sideways, so steering visibly swings the car across the picture.
    cameraLat += (player.lat * .7 - cameraLat) * (1 - Math.exp(-3.5 * dt));
    cameraKick *= Math.exp(-7 * dt);
    const base = trackPose(track, player.d, cameraLat), back = (tall ? 12.5 : 10.5) + (boosting ? 1.2 : 0), sx = Math.sin(cameraHeading), cz = Math.cos(cameraHeading);
    const hop = player.air > 0 ? Math.sin((1 - player.air / player.airTime) * Math.PI) * (player.airTime > 1.2 ? 3.4 : .9) : 0, shake = boosting ? .05 : 0;
    const floor = Math.max(trackPose(track, player.d - back, 0).y, pose.y - 1.5);
    va.set(base.x - sx * back + (rand() - .5) * shake, floor + (tall ? 5.6 : 4.5) + hop - cameraKick * .4 + (rand() - .5) * shake, base.z + cz * back);
    vb.set((pose.x + base.x) / 2 + sx * 9, far.y + 1.1 + hop * .8, (pose.z + base.z) / 2 - cz * 9);
    if (phase === 'countdown' && !reducedMotion) {
      // The race opens with a swoop down from above the grid.
      const t = smooth(0, 1, (3 - race.countdown) / 2.4), a = pose.heading + 2.4 - t * 2.4;
      camera.position.set(pose.x - Math.sin(a) * 30, pose.y + 20, pose.z + Math.cos(a) * 30).lerp(va, t);
      vb.lerp(va.set(pose.x, pose.y + 1, pose.z), 1 - t);
    } else camera.position.copy(va);
    camera.lookAt(vb);
    if (!reducedMotion) { cameraRoll += (player.steer * -.028 - cameraRoll) * (1 - Math.exp(-4 * dt)); camera.rotateZ(cameraRoll); }
  } else {
    // The showroom camera sways behind the car on the road side, clear of the crowd.
    const a = pose.heading + 2.3 + (reducedMotion ? 0 : Math.sin(clock * .3) * .55), radius = (camera.aspect < .8 ? 9.5 : 8.8) + (prefs.car === 'truck' ? 2.5 : 0);
    camera.position.set(pose.x + Math.sin(a) * radius, pose.y + (prefs.car === 'truck' ? 3.6 : 2.7), pose.z - Math.cos(a) * radius);
    camera.lookAt(pose.x, pose.y + (prefs.car === 'truck' ? 1.4 : .7), pose.z);
    cameraHeading = pose.heading; cameraLat = player.lat * .7; cameraRoll = 0;
  }
  const fov = (tall ? 74 : 58) + (racing() && player.boost > 0 && !reducedMotion ? 9 : 0);
  if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  // The sun's shadow box follows the player.
  const dir = sun.userData.dir;
  sun.position.set(f.x + dir.x * 150, f.y + dir.y * 150, f.z + dir.z * 150); sun.target.position.set(f.x, f.y, f.z); sun.target.updateMatrixWorld();
  $('rush').classList.toggle('on', racing() && player.boost > 0);
}
/* ---------- heads-up display ---------- */
const avatar = car => car.player ? `<i style="background:${swatch(paint())}" title="Viaan"></i>` : `<img src="../memory-assets/${car.id}.png" alt="${car.name}">`;
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
    mapContext.fillStyle = car.player ? paint().color : (RIVALS.find(r => r.id === car.id) || BOSSES[race.trackId]).color; mapContext.fill();
    mapContext.lineWidth = car.player ? 4 : 2.5; mapContext.strokeStyle = '#143f42'; mapContext.stroke();
  });
}
function updateHud(force = false) {
  const player = playerOf(race), speed = String(Math.round(player.speed * 9));
  if ($('speed').textContent !== speed) $('speed').textContent = speed;
  // The bar under the speed shows boost time left, or a drift charging up.
  const charge = player.boost > 0 ? player.boost / BOOST_SECONDS : Math.min(player.drift / DRIFT_BIG, 1);
  $('boostBar').style.width = (charge * 100).toFixed(0) + '%';
  $('boostBar').style.background = player.boost > 0 ? '' : player.drift >= DRIFT_BIG ? '#ff9a2e' : player.drift >= DRIFT_SMALL ? '#5bc8ff' : '#cfd8cf';
  if (!force && clock - lastHud < .12) return;
  lastHud = clock;
  // The nitro button shows how many bursts are in the tank.
  const bursts = Math.floor(player.nitro / NITRO_COST + 1e-6);
  if ($('nitro').dataset.bursts !== String(bursts)) { $('nitro').dataset.bursts = bursts; $('nitro').classList.toggle('ready', bursts > 0); $('nitroPips').textContent = '●'.repeat(bursts) + '○'.repeat(3 - bursts); }
  const order = standings(race), key = order.map(c => c.id).join() + prefs.paint;
  $('lapText').textContent = `Lap ${lapOf(race, player)} of ${LAPS}`;
  $('placeText').textContent = ORDINALS[placeOf(race) - 1];
  $('coinText').textContent = race.collected;
  if (key !== orderKey) { orderKey = key; $('order').innerHTML = order.map(c => `<li class="${c.player ? 'me' : ''}">${avatar(c)}</li>`).join(''); }
  drawMap();
}

/* ---------- garage, race and finish flow ---------- */
function renderGarage() {
  $('bank').textContent = prefs.coins;
  const won = Object.keys(prefs.cups).length;
  $('cars').innerHTML = CARS.map(c => carUnlocked(prefs, c)
    ? `<button data-car="${c.id}" aria-label="${c.name}" aria-pressed="${c.id === prefs.car}"><img src="assets/${CAR_ICON[c.id]}.png" alt=""><small>${c.name}</small></button>`
    : `<button data-car="${c.id}" class="locked" aria-label="${c.name}, locked. Finish ${c.cups - won} more track${c.cups - won === 1 ? '' : 's'}" aria-pressed="false"><img src="assets/${CAR_ICON[c.id]}.png" alt=""><small>🔒 ${c.cups === 1 ? 'Finish a race' : `${c.cups} cups`}</small></button>`).join('');
  $('swatches').innerHTML = PAINTS.map(p => owns(p)
    ? `<button data-paint="${p.id}" style="background:${swatch(p)}" aria-label="${p.name}" aria-pressed="${p.id === prefs.paint}"></button>`
    : `<button data-paint="${p.id}" class="locked" style="background:${swatch(p)}" aria-label="${p.name}, locked, costs ${p.cost} coins" aria-pressed="false">🔒<br>${p.cost}</button>`).join('');
  $('trails').innerHTML = TRAILS.map(t => `<button data-trail="${t.id}" class="${owns(t) ? '' : 'locked'}" aria-label="${t.name}${owns(t) ? '' : `, locked, costs ${t.cost} coins`}" aria-pressed="${t.id === prefs.trail}"><span aria-hidden="true">${TRAIL_ICON[t.id]}</span><small>${!owns(t) ? '🔒 ' + t.cost : t.id === 'none' ? 'None' : t.name.replace(' trail', '')}</small></button>`).join('');
  const cupMark = id => prefs.cups[id] === 3 ? '<em class="cup gold" aria-hidden="true">👑</em>' : prefs.cups[id] ? `<em class="cup ${prefs.cups[id] === 2 ? 'gold' : ''}" aria-hidden="true">🏆</em>` : '';
  $('tracks').innerHTML = TRACKS.map(t => `<button data-track="${t.id}" aria-label="${t.name}${prefs.cups[t.id] === 3 ? ', boss beaten' : prefs.cups[t.id] === 2 ? ', gold cup won' : prefs.cups[t.id] ? ', cup won' : ''}" aria-pressed="${t.id === prefs.track}"><span aria-hidden="true">${THEMES[t.id].icon}</span><strong>${t.name}${cupMark(t.id)}</strong><small>${t.blurb}</small></button>`).join('');
  // A track's boss appears once its cup has been earned.
  $('bossStart').hidden = !prefs.cups[prefs.track];
  $('bossStart').textContent = `👑 Boss race: ${BOSSES[prefs.track].name}`;
}
function choose(kind, id) {
  if (kind === 'car') {
    const car = CARS.find(c => c.id === id); if (!car) return;
    if (!carUnlocked(prefs, car)) { toast(car.cups === 1 ? `Finish a race to unlock the ${car.name}` : `Finish all ${car.cups} tracks to unlock the ${car.name}`, 2.6); sound.tone(220, 0, .2, 'triangle', .08); return; }
    prefs = normalizePrefs({ ...prefs, car: id }); savePrefs(); seatViews(); orderKey = ''; renderGarage(); sound.horn();
    const chosen = $('cars').querySelector('[aria-pressed="true"]'); if (chosen) chosen.focus({ preventScroll: true });
    return;
  }
  const item = (kind === 'paint' ? PAINTS : TRAILS).find(i => i.id === id); if (!item) return;
  if (!owns(item)) {
    if (prefs.coins < item.cost) { toast(`${item.cost - prefs.coins} more coins for ${item.name}`, 2.4); sound.tone(220, 0, .2, 'triangle', .08); return; }
    prefs = buy(prefs, id); toast(`You unlocked ${item.name}!`, 2.4); sound.chime([659, 784, 1047, 1319], .1);
    const pose = trackPose(race.track, playerOf(race).d, playerOf(race).lat); burst(pose.x, pose.y + 1.5, pose.z, 40, 6, .22, 1.4, PARTY, 5);
  }
  prefs = normalizePrefs({ ...prefs, [kind]: id }); savePrefs();
  applyPaint(views[0].paint, prefs.paint); orderKey = ''; renderGarage();
  const pressed = $(kind === 'paint' ? 'swatches' : 'trails').querySelector('[aria-pressed="true"]'); if (pressed) pressed.focus({ preventScroll: true });
}
function resetRace() {
  race = createRace(prefs.track, { boss: bossMode }); buildWorld(prefs.track); seatViews();
  orderKey = ''; $('trackName').textContent = (race.boss ? `BOSS · ${BOSSES[race.trackId].name}` : race.track.name).toUpperCase();
  $('countdown').textContent = ''; $('toast').classList.remove('show'); $('rush').classList.remove('on');
  cameraHeading = trackPose(race.track, playerOf(race).d, 0).heading; cameraKick = 0; idleFor = 0; hinted = false;
  sound.music(prefs.track); sound.squeal(false); sound.hurry(race.boss);
  releaseAll();
}
function openGarage() {
  if ($('finish').open) $('finish').close();
  bossMode = false; resetRace(); setPhase('garage'); renderGarage();
  if (!$('garage').open) $('garage').show();
  $('start').focus({ preventScroll: true });
}
function showCount(text) {
  const el = $('countdown'); el.textContent = text;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
function startRace(boss = bossMode) {
  if ($('garage').open) $('garage').close();
  if ($('finish').open) $('finish').close();
  bossMode = boss === true && !!prefs.cups[prefs.track];
  resetRace(); setPhase('countdown'); updateHud(true);
  showCount('3'); sound.tone(440, 0, .25); countdownUntil = Infinity;
  canvas.focus({ preventScroll: true });
}
function showFinish() {
  const place = placeOf(race), order = standings(race), boss = BOSSES[race.trackId];
  const titles = race.boss ? [`You beat ${boss.name}!`, `${boss.name} was quick! Try again?`] : ['You won the race!', 'You came second!', 'You came third!', 'You finished the race!'];
  $('finishKicker').textContent = `${race.track.name.toUpperCase()} · ${race.boss ? 'BOSS RACE' : LAPS + ' LAPS'}`;
  $('finishTitle').textContent = titles[place - 1];
  $('finishText').textContent = race.boss && place === 1 ? `Super driving, Viaan. ${race.track.name} has a crown!` : 'Super driving, Viaan. What a great race with your friends.';
  $('reward').textContent = rewardText;
  $('podium').innerHTML = order.map((c, i) => `<li class="${c.player ? 'me' : ''}"><b>${ORDINALS[i]}</b>${avatar(c)}<span>${c.name}</span></li>`).join('');
  $('finish').showModal(); $('again').focus({ preventScroll: true });
  sound.say(titles[place - 1]);
}
function bankRace() {
  const place = placeOf(race), had = prefs.cups[race.trackId] || 0, before = CARS.filter(c => carUnlocked(prefs, c)).length;
  prefs = award(prefs, race.trackId, place, race.collected, race.boss); savePrefs();
  const cup = prefs.cups[race.trackId], next = nextUnlock(prefs), parts = [`+${race.collected} coins`], unlocked = CARS.filter(c => carUnlocked(prefs, c));
  if (cup > had) parts.push(cup === 3 ? `${race.track.name} crown! 👑` : cup === 2 ? `Gold ${race.track.name} cup!` : `${race.track.name} cup!`);
  if (unlocked.length > before) parts.push(`New: ${unlocked.at(-1).name}! 🎉`);
  else if (had === 0) parts.push(`Boss race unlocked 👑`);
  else if (next) parts.push(prefs.coins >= next.cost ? `You can unlock ${next.name}!` : `${next.cost - prefs.coins} more for ${next.name}`);
  rewardText = parts.join(' · ');
}
function handle(event) {
  const player = playerOf(race), pose = trackPose(race.track, player.d, player.lat);
  if (event === 'count') { showCount(String(Math.ceil(race.countdown))); sound.tone(440, 0, .25); }
  else if (event === 'go') { setPhase('racing'); showCount('GO!'); countdownUntil = clock + .9; sound.tone(880, 0, .6); }
  else if (event === 'star') { toast('Zoom! ⭐', 1.2); sound.chime([784, 1047, 1319], .07); sound.whoosh(); burst(pose.x, pose.y + 1.4, pose.z, 18, 7, .16, .7, ['#ffd84a', '#fff6c9'], 4); }
  else if (event === 'coin') {
    if (clock - lastCoinSound > .07) { lastCoinSound = clock; sound.coin(); }
    burst(pose.x, pose.y + 1.2 + (player.air > 0 ? 2 : 0), pose.z, 4, 4, .1, .4, ['#ffd84a'], 6);
    $('coinText').textContent = race.collected;
    const badge = $('coinText').parentElement; badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  }
  else if (event === 'lap') { toast(`Lap ${lapOf(race, player)}!`); sound.chime([659, 880]); }
  else if (event === 'lastlap') { toast('Last lap! 🏁'); sound.chime([659, 880, 1047]); sound.hurry(true); }
  else if (event === 'jump') { toast('Wheee!', 1); sound.tone(260, 0, .5, 'sine', .08, 880); }
  else if (event === 'megajump') { toast('MEGA JUMP! 🚀', 1.8); sound.tone(200, 0, 1.1, 'sine', .09, 1200); sound.whoosh(); }
  else if (event === 'loop') { toast('Loop the loop! 🎢', 2); sound.chime([523, 659, 784, 1047, 784, 1047], .11); }
  else if (event === 'nitro') { toast('NITRO! 🔥', 1); sound.whoosh(); sound.tone(180, 0, .5, 'sawtooth', .05, 720); cameraKick = -.8; }
  else if (event === 'empty') { sound.tone(200, 0, .12, 'triangle', .06); toast('Collect coins and stars for nitro', 1.6); }
  else if (event === 'land') { sound.thud(); cameraKick = player.airTime > 1.2 ? 2 : 1; burst(pose.x, pose.y + .3, pose.z, 14, 4, .28, .6, [THEMES[race.trackId].dust], 0); }
  else if (event === 'drift') sound.tone(660, 0, .12, 'sine', .06, 990);
  else if (event === 'drift2') sound.tone(880, 0, .14, 'sine', .07, 1320);
  else if (event === 'turbo') { toast('Drift boost!', 1.1); sound.whoosh(); }
  else if (event === 'pass') { toast(`You passed ${race.passed}!`, 1.6); sound.chime([784, 988], .08); }
  else if (event === 'bump') { sound.tone(120, 0, .18, 'triangle', .12); burst(pose.x, pose.y + .8, pose.z, 8, 5, .12, .4, ['#ffd84a', '#ffffff'], 8); }
  else if (event === 'finish') {
    bankRace(); setPhase('finished'); releaseAll(); sound.chime([523, 659, 784, 1047, 1319], .12); sound.cheer(); sound.hurry(false);
    finishAt = clock + 1.6; nextFirework = clock + .3; updateHud(true);
    for (const side of [-1, 1]) { const p = trackPose(race.track, 0, side * (HALF_ROAD + 1)); burst(p.x, p.y + 6, p.z, 60, 10, .32, 2.2, PARTY, 7); }
  }
}
function openMenu() {
  if (!racing() || paused) return;
  paused = true; releaseAll(); updateSound(); $('menu').showModal(); $('resume').focus({ preventScroll: true });
}

/* ---------- input ---------- */
const pad = () => ({ steer: (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0), gas: held.gas.size > 0, brake: held.brake.size > 0, nitro: held.nitro.size > 0 });
function hold(side, source, on) {
  if (on) held[side].add(source); else held[side].delete(source);
  $(side).classList.toggle('down', held[side].size > 0);
}
function releaseAll() { for (const side of Object.keys(held)) { held[side].clear(); $(side).classList.remove('down'); } }
function setupControls() {
  for (const side of Object.keys(held)) {
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
  const keySide = key => ({ ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake', n: 'nitro', N: 'nitro', Shift: 'nitro' })[key];
  window.addEventListener('keydown', e => {
    const side = keySide(e.key);
    if (side && racing() && !paused) { e.preventDefault(); hold(side, 'key', true); }
    else if ((e.key === 'h' || e.key === 'H') && !e.repeat) sound.horn();
    else if ((e.key === 'p' || e.key === 'P') && racing()) openMenu();
  });
  window.addEventListener('keyup', e => { const side = keySide(e.key); if (side) hold(side, 'key', false); });
  $('horn').addEventListener('click', () => { sound.horn(); if (!sound.on) toast('Tap ♫ to hear the horn', 1.6); });
  $('sound').addEventListener('click', toggleSound);
  $('pause').addEventListener('click', openMenu);
  $('menu').addEventListener('close', () => { paused = false; lastTime = 0; updateSound(); });
  $('resume').addEventListener('click', () => $('menu').close());
  $('restart').addEventListener('click', () => { $('menu').close(); startRace(bossMode); });
  $('toGarage').addEventListener('click', () => { $('menu').close(); openGarage(); });
  $('start').addEventListener('click', () => startRace(false));
  $('bossStart').addEventListener('click', () => startRace(true));
  $('again').addEventListener('click', () => startRace(bossMode));
  $('cars').addEventListener('click', e => { const button = e.target.closest('[data-car]'); if (button) choose('car', button.dataset.car); });
  $('change').addEventListener('click', openGarage);
  $('finish').addEventListener('cancel', e => e.preventDefault());
  $('swatches').addEventListener('click', e => { const button = e.target.closest('[data-paint]'); if (button) choose('paint', button.dataset.paint); });
  $('trails').addEventListener('click', e => { const button = e.target.closest('[data-trail]'); if (button) choose('trail', button.dataset.trail); });
  $('tracks').addEventListener('click', e => {
    const button = e.target.closest('[data-track]'); if (!button) return;
    prefs = normalizePrefs({ ...prefs, track: button.dataset.track }); savePrefs();
    resetRace(); renderGarage();
    const pressed = $('tracks').querySelector('[aria-pressed="true"]'); if (pressed) pressed.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); openMenu(); } });
  window.addEventListener('blur', () => { releaseAll(); openMenu(); });
  window.addEventListener('pagehide', () => sound.close());
  window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); frameKey = ''; });
}

/* ---------- main loop ---------- */
function update(dt) {
  clock += dt;
  if (phase !== 'garage') for (const event of stepRace(race, pad(), dt)) handle(event);
  // A driver who has not found the gas gets one friendly reminder.
  if (phase === 'racing' && !hinted) { idleFor = playerOf(race).speed < 1.5 ? idleFor + dt : 0; if (idleFor > 2.2) { hinted = true; toast('Hold GO to drive! 🟢', 3); $('gas').classList.add('nudge'); } }
  if (hinted && held.gas.size) $('gas').classList.remove('nudge');
  if (phase === 'finished' && finishAt && clock >= finishAt) { finishAt = 0; showFinish(); }
  if (countdownUntil && clock >= countdownUntil) { countdownUntil = 0; $('countdown').textContent = ''; }
  if (toastUntil && clock >= toastUntil) { toastUntil = 0; $('toast').classList.remove('show'); }
  updateCars(dt); updateCamera(dt); updateWorld(dt); updateParticles(dt);
  if (phase !== 'garage') updateHud();
  const player = playerOf(race);
  sound.engine(player.speed, phase !== 'garage'); sound.squeal(phase === 'racing' && player.drift > .3);
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
    const loader = new GLTFLoader();
    for (const [id, asset] of await Promise.all(CARS.map(async c => [c.id, await loader.loadAsync(`./assets/${c.id}.glb`)]))) {
      templates[id] = asset.scene;
      asset.scene.traverse(o => {
        if (!o.isMesh || shiny.includes(o.material)) return;
        if (o.material.name === 'Glass') Object.assign(o.material, { roughness: .05, metalness: .85, envMapIntensity: 1.1 });
        if (['Glass', 'Silver', 'Charcoal'].includes(o.material.name)) shiny.push(o.material);
      });
    }
    rivalViews.push(...RIVALS.map(r => makeCar('supercar', r.color, r.id)));
    setupControls(); openGarage();
    $('loading').classList.add('done'); $('loading').setAttribute('aria-hidden', 'true'); $('loading').inert = true;
    window.littleRacer = { get race() { return race; }, get phase() { return phase; }, get prefs() { return prefs; } };
    requestAnimationFrame(animate);
  } catch (error) { console.error('Race startup failed', error); fail('Please reload to try again. This game needs a browser with WebGL 2.'); }
}
init();
