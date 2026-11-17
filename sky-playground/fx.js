// The playful layer of Little Pilot: things to collect, sparkles, sea friends,
// runway fans, plane paint and trails. Rules live in sky.js; this file only draws.
import * as THREE from 'three';
import { PLANE_PAINTS, inSky, reachOf } from './sky.js?v=7';

const PARTY = ['#eb6548', '#ffc44e', '#58c7b0', '#f2559c', '#5b8def', '#ffffff'];
const BALLOONS = ['#f2559c', '#ffc44e', '#5b8def', '#58c7b0', '#eb6548', '#8a55e0'];
const FANS = ['bear', 'cat', 'dog', 'duck', 'elephant', 'giraffe', 'lion', 'owl', 'turtle'];
const PMAX = 520, HOP = .28;      // seconds a caught star takes to fly to the plane

export function createFun({ scene, camera, plane, items, airports, runwayOf, groundAt = () => 0, water, reducedMotion }) {
  const dummy = new THREE.Object3D(), tint = new THREE.Color(), rand = Math.random;
  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...options });
  let clock = 0, roll = 0, rollLeft = 0, rollSide = 1, route = '', trail = 'clouds', paint = 'red', partyUntil = 0, nextSpout = 3, nextFirework = 0, partyAt = null;
  const seen = new Set(), hops = new Map(), rockets = [], noticed = [];
  let pull = 1;

  /* ---------- a bright sky ---------- */
  const horizon = new THREE.Color('#d3f1f6');
  const sky = new THREE.Mesh(new THREE.SphereGeometry(840, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f97ea') }, horizon: { value: horizon }, sunGlow: { value: 1 }, sunDir: { value: new THREE.Vector3(.4, .78, .32).normalize() } },
    vertexShader: 'varying vec3 dir; void main(){ dir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir; uniform float sunGlow; varying vec3 dir;
      void main(){ vec3 d = normalize(dir); float h = clamp(d.y, 0., 1.);
        vec3 c = mix(horizon, top, pow(h, .55)); float s = max(dot(d, sunDir), 0.);
        c += vec3(1., .95, .78) * (pow(s, 380.) * 1.4 + pow(s, 9.) * .22) * sunGlow;
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`
  }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  scene.background = horizon; scene.fog.color.copy(horizon);
  if (water?.material?.uniforms?.fogColor) water.material.uniforms.fogColor.value.copy(horizon);

  /* ---------- night over Starlight Island ---------- */
  // Everything here fades in with `dark`, from 0 (day) to 1 (night): see nightAt in airline.js.
  const DAY = { top: new THREE.Color('#2f97ea'), horizon: new THREE.Color('#d3f1f6') }, NIGHT = { top: new THREE.Color('#070b33'), horizon: new THREE.Color('#34388c') };
  const starry = airports.find(a => a.id === 'starry') || { x: 0, z: 0 }, glow = { transparent: true, opacity: 0, depthWrite: false, fog: false };
  let dark = 0, nextShooting = 5, shooter = null;
  // A soft round dot, for stars and lanterns.
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), fill = g.createRadialGradient(32, 32, 0, 32, 32, 32); fill.addColorStop(0, '#fff'); fill.addColorStop(.35, '#ffffffcc'); fill.addColorStop(1, '#fff0'); g.fillStyle = fill; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const starField = (() => {
    const count = 620, at = new Float32Array(count * 3), hue = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, up = .04 + rand() * .96, flat = Math.sqrt(1 - up * up), bright = .55 + rand() * .45, warm = rand();
      at.set([Math.cos(a) * flat * 800, up * 800, Math.sin(a) * flat * 800], i * 3); hue.set([bright, bright * (warm < .2 ? .86 : 1), bright * (warm > .8 ? .8 : 1)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(at, 3)); g.setAttribute('color', new THREE.BufferAttribute(hue, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ ...glow, map: dot, size: 7, sizeAttenuation: false, vertexColors: true }));
  })();
  // A friendly full moon with a sleepy face, hanging in the north.
  const moon = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), halo = g.createRadialGradient(128, 128, 60, 128, 128, 128);
    halo.addColorStop(0, '#fff6c9aa'); halo.addColorStop(1, '#fff6c900'); g.fillStyle = halo; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff3c2'; g.beginPath(); g.arc(128, 128, 74, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f1dd9c'; for (const [x, y, r] of [[92, 96, 13], [160, 84, 8], [172, 150, 15], [100, 168, 7]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#8a6b3a'; g.lineWidth = 5; g.lineCap = 'round';
    for (const x of [104, 152]) { g.beginPath(); g.arc(x, 122, 10, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
    g.beginPath(); g.arc(128, 138, 20, .2 * Math.PI, .8 * Math.PI); g.stroke();
    g.fillStyle = '#f7a8a066'; for (const x of [88, 168]) { g.beginPath(); g.arc(x, 146, 10, 0, Math.PI * 2); g.fill(); }
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ ...glow, map: texture })); sprite.scale.setScalar(210); return sprite;
  })();
  const MOON_AT = new THREE.Vector3(-.2, .25, -.92).normalize().multiplyScalar(760);
  // Northern lights: three slow curtains behind the island.
  const aurora = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { time: { value: 0 }, dark: { value: 0 } },
    vertexShader: 'uniform float time; varying vec2 at; void main(){ at = uv; vec3 p = position; p.z += sin(p.x * .035 + time * .35) * 16. + sin(p.x * .09 - time * .2) * 6.; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }',
    fragmentShader: `uniform float time, dark; varying vec2 at;
      void main(){ float rays = .55 + .45 * sin(at.x * 70. + time * .9 + sin(at.x * 11. - time * .4) * 3.);
        float fade = smoothstep(0., .18, at.y) * (1. - smoothstep(.45, 1., at.y)) * smoothstep(0., .08, at.x) * smoothstep(1., .92, at.x);
        gl_FragColor = vec4(mix(vec3(.25, 1., .62), vec3(.62, .35, 1.), at.y) * rays, fade * dark * .5); }`
  });
  const curtains = [[-70, 62, -150, .25, 250], [70, 78, -190, -.2, 280], [0, 96, -235, 0, 330]].map(([x, y, z, turn, wide]) => {
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(wide, 70, 60, 1), aurora); curtain.position.set(starry.x + x, y, starry.z + z); curtain.rotation.y = turn; curtain.frustumCulled = false; scene.add(curtain); return curtain;
  });
  // Paper lanterns drifting up around the island.
  const LANTERNS = 54, lanternAt = new Float32Array(LANTERNS * 3);
  for (let i = 0; i < LANTERNS; i++) { const a = rand() * Math.PI * 2, r = 22 + rand() * 105; lanternAt.set([starry.x + Math.cos(a) * r, 7 + rand() * 50, starry.z + Math.sin(a) * r * .85], i * 3); }
  const lanterns = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(lanternAt, 3)), new THREE.PointsMaterial({ ...glow, map: dot, color: '#ffb057', size: 3.4, blending: THREE.AdditiveBlending }));
  for (const thing of [starField, moon, lanterns]) { thing.frustumCulled = false; thing.visible = false; scene.add(thing); }
  curtains.forEach(c => c.visible = false);
  function setNight(n) {
    dark = n; const lit = n > .01;
    sky.material.uniforms.top.value.copy(DAY.top).lerp(NIGHT.top, n); horizon.copy(DAY.horizon).lerp(NIGHT.horizon, n); sky.material.uniforms.sunGlow.value = 1 - n;
    scene.fog.color.copy(horizon); if (water?.material?.uniforms?.fogColor) water.material.uniforms.fogColor.value.copy(horizon);
    for (const thing of [starField, moon, lanterns]) { thing.visible = lit; thing.material.opacity = n; }
    curtains.forEach(c => c.visible = lit); aurora.uniforms.dark.value = n;
  }
  // Called every frame: the sky things follow the camera, lanterns rise, and now and then a star falls.
  function updateNight(dt, flying, where, fx, fz) {
    if (dark <= .01) return null;
    starField.position.copy(camera.position); moon.position.copy(camera.position).add(MOON_AT); aurora.uniforms.time.value = clock;
    if (!reducedMotion) {
      for (let i = 0; i < LANTERNS; i++) { const y = lanternAt[i * 3 + 1] + dt * (.5 + (i % 5) * .12); lanternAt[i * 3 + 1] = y > 60 ? 6 : y; lanternAt[i * 3] += Math.sin(clock * .4 + i) * dt * .3; }
      lanterns.geometry.attributes.position.needsUpdate = true;
    }
    let seen = null;
    if (shooter) {
      shooter.life -= dt; shooter.at.addScaledVector(shooter.go, dt);
      for (let i = 0; i < 3; i++) spawn(shooter.at.x - shooter.go.x * i * .006, shooter.at.y - shooter.go.y * i * .006, shooter.at.z - shooter.go.z * i * .006, 0, 0, 0, .55 - i * .1, .55, i ? '#fff3b0' : '#ffffff');
      if (shooter.life <= 0) shooter = null;
    } else if (flying && dark > .7 && !reducedMotion && clock > nextShooting) {
      nextShooting = clock + 9 + rand() * 7;
      const side = rand() < .5 ? -1 : 1, rx = -fz, rz = fx;   // rx, rz point to the plane's right
      shooter = { life: 1.5, at: new THREE.Vector3(where.x + fx * 95 + rx * side * 55, where.y + 46, where.z + fz * 95 + rz * side * 55), go: new THREE.Vector3(-rx * side * 62, -22, -rz * side * 62) };
      seen = 'shooting';
    }
    return seen;
  }

  /* ---------- particles ---------- */
  const pPos = new Float32Array(PMAX * 3), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pTime = new Float32Array(PMAX), pSize = new Float32Array(PMAX), pFall = new Float32Array(PMAX), pPuff = new Uint8Array(PMAX);
  const pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial(), PMAX);
  let pNext = 0;
  pMesh.frustumCulled = false; dummy.scale.setScalar(0); dummy.updateMatrix();
  for (let i = 0; i < PMAX; i++) { pMesh.setMatrixAt(i, dummy.matrix); pMesh.setColorAt(i, tint.set('#ffffff')); }
  scene.add(pMesh);
  function spawn(x, y, z, vx, vy, vz, size, seconds, color, fall = 0, puff = 0) {
    if (reducedMotion) return;
    const i = pNext; pNext = (pNext + 1) % PMAX;
    pPos.set([x, y, z], i * 3); pVel.set([vx, vy, vz], i * 3);
    pLife[i] = pTime[i] = seconds; pSize[i] = size; pFall[i] = fall; pPuff[i] = puff;
    pMesh.setColorAt(i, tint.set(color)); pMesh.instanceColor.needsUpdate = true;
  }
  function burst(x, y, z, count, speed, size, seconds, colors, fall = 6) {
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, up = rand() * 2 - .7, s = speed * (.5 + rand() * .7);
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

  /* ---------- stars, balloons and rainbow hoops ---------- */
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .55 : 1.2, a = i / 10 * Math.PI * 2 + Math.PI / 2; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const starShape = new THREE.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 2 }); starShape.center();
  const stars = items.filter(i => i.kind === 'star'), balloons = items.filter(i => i.kind === 'balloon'), hoops = items.filter(i => i.kind === 'hoop');
  const starMesh = new THREE.InstancedMesh(starShape, mat('#ffd23f', { emissive: '#e89a10', emissiveIntensity: .7, roughness: .35 }), stars.length);
  const balloonMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), mat('#ffffff', { roughness: .35 }), balloons.length);
  const stringMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.03, .03, 1, 5), mat('#fff9e9'), balloons.length);
  for (const mesh of [starMesh, balloonMesh, stringMesh]) { mesh.frustumCulled = false; scene.add(mesh); }
  balloons.forEach((b, i) => { b.color = BALLOONS[i % BALLOONS.length]; balloonMesh.setColorAt(i, tint.set(b.color)); });
  const stripes = document.createElement('canvas'); stripes.width = 8; stripes.height = 64;
  const g = stripes.getContext('2d'); ['#ff5f5f', '#ffb347', '#ffe066', '#6bd66b', '#5bb8ff', '#b07bff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 64 / 6, 8, 64 / 6 + 1); });
  const rainbow = new THREE.CanvasTexture(stripes); rainbow.colorSpace = THREE.SRGBColorSpace; rainbow.wrapT = THREE.RepeatWrapping;
  const hoopShape = new THREE.TorusGeometry(6.2, .75, 12, 48), hoopMaterial = new THREE.MeshStandardMaterial({ map: rainbow, roughness: .4, emissive: '#ffffff', emissiveMap: rainbow, emissiveIntensity: .35 });
  const hoopMeshes = hoops.map(hoop => { const mesh = new THREE.Mesh(hoopShape, hoopMaterial); mesh.position.set(hoop.x, hoop.y, hoop.z); mesh.rotation.y = -hoop.heading; scene.add(mesh); return mesh; });
  function drawItems() {
    const spin = reducedMotion ? .5 : clock * 2.2;
    stars.forEach((star, i) => {
      const hop = hops.get(star), pulse = reducedMotion ? 0 : Math.sin(clock * 5 + i) * .12;
      let size = (star.big ? 2.7 : star.route ? 1.3 : 1.1) + pulse * (star.big ? 2 : 1);
      dummy.position.set(star.x, star.y + (reducedMotion ? 0 : Math.sin(clock * 2 + i) * .25), star.z);
      if (hop !== undefined) {
        // A caught star flies to the plane, spinning and shrinking as it goes.
        const t = 1 - hop / HOP; dummy.position.lerp(plane.position, t * t); size *= 1 - t * .75;
      } else if (star.taken || !inSky(star, route)) size = 0;
      else {
        // A star about to be caught leans toward the plane, so the pull can be seen.
        const far = dummy.position.distanceTo(plane.position), reach = reachOf(star, pull);
        if (far < reach * 2.2) dummy.position.lerp(plane.position, Math.min(.3, (1 - far / (reach * 2.2)) * .6));
      }
      dummy.rotation.set(0, hop === undefined ? spin + i : clock * 18, 0); dummy.scale.setScalar(size); dummy.updateMatrix();
      starMesh.setMatrixAt(i, dummy.matrix);
    });
    balloons.forEach((b, i) => {
      const bob = reducedMotion ? 0 : Math.sin(clock * 1.3 + i) * .5, show = b.taken || !inSky(b, route) ? 0 : 1;
      dummy.rotation.set(0, 0, 0); dummy.position.set(b.x, b.y + bob, b.z); dummy.scale.set(2.3 * show, 2.8 * show, 2.3 * show); dummy.updateMatrix(); balloonMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, b.y + bob - 4.6, b.z); dummy.scale.set(show, 3.8 * show, show); dummy.updateMatrix(); stringMesh.setMatrixAt(i, dummy.matrix);
    });
    hoops.forEach((hoop, i) => { hoopMeshes[i].visible = !hoop.taken && inSky(hoop, route); if (!reducedMotion) hoopMeshes[i].rotation.z = clock * .6; });
    starMesh.instanceMatrix.needsUpdate = balloonMesh.instanceMatrix.needsUpdate = stringMesh.instanceMatrix.needsUpdate = true;
    if (balloonMesh.instanceColor) balloonMesh.instanceColor.needsUpdate = true;
  }

  /* ---------- sea friends ---------- */
  const sphere = new THREE.SphereGeometry(1, 16, 10), cone = new THREE.ConeGeometry(1, 1, 10);
  const part = (geometry, material, parent, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const whale = new THREE.Group(), whaleBlue = mat('#4f8fd6'), cream = mat('#fff9e9'), ink = mat('#143f42');
  part(sphere, whaleBlue, whale, 0, 0, 0, 5, 3.4, 9); part(sphere, cream, whale, 0, -1.3, -1, 4.2, 2.2, 7);
  const fluke = part(cone, whaleBlue, whale, 0, 1, 10.5, 4.5, 3.6, 1.2); fluke.rotation.x = -1.2;
  for (const side of [-1, 1]) { part(sphere, ink, whale, side * 3.6, 1.2, -5.5, .45, .45, .45); part(sphere, whaleBlue, whale, side * 5, -1.2, -1, 2.4, .5, 1.4); }
  whale.position.set(-112, -.6, -52); whale.rotation.y = .9; scene.add(whale);
  const dolphins = [0, 1, 2].map(i => {
    const d = new THREE.Group(), grey = mat('#7fa9c9');
    part(sphere, grey, d, 0, 0, 0, .9, .9, 3); part(cone, grey, d, 0, 1, .2, .5, 1.3, .8); const tail = part(cone, grey, d, 0, 0, 3.2, 1.6, 1.4, .3); tail.rotation.x = Math.PI / 2;
    part(cone, grey, d, 0, 0, -3.3, .5, 1.5, .5).rotation.x = -Math.PI / 2;
    d.userData = { offset: i * .9 }; scene.add(d); return d;
  });
  function updateSea(dt, where) {
    whale.position.y = -.9 + (reducedMotion ? 0 : Math.sin(clock * .7) * .5); fluke.rotation.z = reducedMotion ? 0 : Math.sin(clock * 1.4) * .25;
    if (clock > nextSpout) { nextSpout = clock + 4.5; for (let i = 0; i < 22; i++) spawn(whale.position.x - 3.5, 2.8, whale.position.z - 4.4, (rand() - .5) * 3, 9 + rand() * 6, (rand() - .5) * 3, .5 + rand() * .4, 1.5, i % 2 ? '#e9f8ff' : '#ffffff', 14); }
    dolphins.forEach(d => {
      const a = clock * .5 + d.userData.offset, jump = Math.sin(clock * 1.6 + d.userData.offset * 2.4);
      d.position.set(118 + Math.sin(a) * 26, reducedMotion ? .4 : -1.2 + Math.max(jump, -.3) * 4.2, -62 + Math.cos(a) * 20);
      d.rotation.set(reducedMotion ? 0 : -Math.cos(clock * 1.6 + d.userData.offset * 2.4) * .7, a + Math.PI / 2, 0, 'YXZ');
    });
    const sights = [];
    if (!seen.has('whale') && Math.hypot(where.x - whale.position.x, where.z - whale.position.z) < 70) { seen.add('whale'); sights.push('whale'); }
    if (!seen.has('dolphins') && Math.hypot(where.x - 118, where.z + 62) < 70) { seen.add('dolphins'); sights.push('dolphins'); }
    return sights;
  }

  /* ---------- puffy clouds to fly through ---------- */
  const puffs = [], cloudWhite = mat('#ffffff', { roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const group = new THREE.Group(), a = i * 2.4, r = 70 + (i * 53) % 230;
    for (let j = 0; j < 5; j++) part(sphere, cloudWhite, group, (j - 2) * 2.6, j % 2 ? 1.3 : 0, (j % 3 - 1) * 1.2, 3 + (j * 7 % 3) * .5, 2.2, 2.6);
    group.position.set(Math.cos(a) * r, 27 + (i * 5) % 13, -70 + Math.sin(a) * r * .75); group.userData = { ready: 0 };
    scene.add(group); puffs.push(group);
  }

  /* ---------- fans beside every runway ---------- */
  const fans = [], loader = new THREE.TextureLoader(), faces = {};
  const face = id => faces[id] || (faces[id] = new THREE.SpriteMaterial({ map: Object.assign(loader.load(`../memory-assets/${id}.png`), { colorSpace: THREE.SRGBColorSpace }), transparent: true, alphaTest: .05 }));
  airports.forEach((airport, n) => {
    const runway = runwayOf(airport.id);
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
      const sprite = new THREE.Sprite(face(FANS[(i * 2 + n * 3 + (side > 0 ? 1 : 0)) % FANS.length]));
      sprite.scale.set(3.2, 3.2, 1); sprite.position.set(runway.x + side * 8.5, runway.surface + 1.6, airport.z + 20 + i * 6);
      sprite.userData = { base: runway.surface + 1.6, beat: rand() * 6, x: runway.x, z: airport.z + 38 }; scene.add(sprite); fans.push(sprite);
    }
  });

  /* ---------- toys: fireworks and presents on parachutes ---------- */
  const box = new THREE.BoxGeometry(1, 1, 1), canopy = new THREE.SphereGeometry(1.5, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const presents = [0, 1, 2, 3].map(i => {
    const group = new THREE.Group(), colour = PARTY[i % 5];
    part(box, mat(colour), group, 0, 0, 0, 1.2, 1.2, 1.2); part(box, mat('#ffffff'), group, 0, 0, 0, 1.26, 1.26, .3); part(box, mat('#ffffff'), group, 0, 0, 0, .3, 1.26, 1.26);
    part(canopy, mat(BALLOONS[i], { side: THREE.DoubleSide }), group, 0, 2.2, 0, 1, 1, 1);
    for (const side of [-1, 1]) part(box, cream, group, side * .7, 1.5, 0, .05, 1.7, .05).rotation.z = side * .55;
    group.visible = false; group.userData = { colour, fall: 0 }; scene.add(group); return group;
  });
  let nextPresent = 0;
  function updateToys(dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      if ((r.wait -= dt) > 0) continue;
      r.fuse -= dt; r.vy -= 5 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      spawn(r.x, r.y, r.z, (rand() - .5) * 2, -2, (rand() - .5) * 2, .2, .35, '#ffe9a8');
      if (r.fuse > 0) continue;
      burst(r.x, r.y, r.z, 60, 13, .42, 1.6, [r.colour, r.colour, '#ffffff'], 6); noticed.push('boom'); rockets.splice(i, 1);
    }
    for (const gift of presents) {
      if (!gift.visible) continue;
      const u = gift.userData; u.fall = Math.min(11, u.fall + 14 * dt);
      gift.position.x += u.vx * dt; gift.position.z += u.vz * dt; gift.position.y -= u.fall * dt;
      gift.rotation.z = reducedMotion ? 0 : Math.sin(clock * 3 + u.vx) * .16;
      const floor = groundAt(gift.position.x, gift.position.z);
      if (gift.position.y > floor + .6) continue;
      gift.visible = false; noticed.push(floor > .3 ? 'gift' : 'splash');
      if (floor > .3) burst(gift.position.x, floor + 1, gift.position.z, 34, 8, .3, 1.2, [u.colour, '#ffd84a', '#ffffff'], 7);
      else for (let i = 0; i < 20; i++) spawn(gift.position.x, .3, gift.position.z, (rand() - .5) * 5, 5 + rand() * 5, (rand() - .5) * 5, .35 + rand() * .3, .9, i % 2 ? '#e9f8ff' : '#ffffff', 14);
    }
  }

  /* ---------- the plane's paint ---------- */
  // The painted parts of whichever plane is chosen, and how far behind its middle the trail starts.
  const coats = new Set(); let tail = 2.2;
  function gatherCoats() { coats.clear(); plane.traverse(o => { if (o.isMesh && o.material.name === 'Coral enamel') coats.add(o.material); }); }
  gatherCoats();
  function setPaint(id) {
    const choice = PLANE_PAINTS.find(p => p.id === id) || PLANE_PAINTS[0]; paint = choice.id;
    for (const coat of coats) { coat.color.set(choice.color); coat.metalness = paint === 'gold' ? .55 : 0; coat.roughness = paint === 'gold' ? .28 : .32; }
  }

  return {
    get roll() { return roll; },
    setPaint, burst, night: setNight,
    // Call after the plane's model is swapped for another.
    setPlane(behind = 2.2) { tail = behind; gatherCoats(); setPaint(paint); },
    setTrail(id) { trail = id; },
    // Which star trail is in the sky: see inSky in sky.js.
    setRoute(id) { route = id; seen.clear(); hops.clear(); },
    trick() {
      if (rollLeft > 0) return false;
      rollLeft = 1; rollSide = rand() < .5 ? -1 : 1;
      burst(plane.position.x, plane.position.y, plane.position.z, 20, 7, .22, .8, PARTY, 3);
      return true;
    },
    collected(thing) {
      if (thing.kind === 'star') {
        if (!reducedMotion) hops.set(thing, HOP);
        if (thing.big) burst(thing.x, thing.y, thing.z, 46, 11, .34, 1.1, [...PARTY, '#ffd84a'], 5);
        else burst(thing.x, thing.y, thing.z, 8, 5, .2, .5, ['#ffd84a', '#fff6c9'], 4);
      }
      else if (thing.kind === 'balloon') burst(thing.x, thing.y, thing.z, 26, 9, .3, .9, [thing.color || '#f2559c', '#ffffff'], 9);
      else for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; spawn(thing.x + Math.cos(a) * 6 * Math.cos(thing.heading), thing.y + Math.sin(a) * 6, thing.z + Math.cos(a) * 6 * Math.sin(thing.heading), Math.cos(a) * 4, Math.sin(a) * 4, 0, .34, .9, PARTY[i % 5], 0); }
    },
    // The toy button: a honk, confetti, three fireworks ahead of the plane, or a present on a parachute.
    // Everything is thrown ahead of the plane, faster than it flies, so it stays in view.
    toy(id, speed = 13) {
      const where = plane.position, heading = -plane.rotation.y, fx = Math.sin(heading), fz = -Math.cos(heading), out = speed + 16;
      if (id === 'confetti') burst(where.x + fx * 3, where.y + 1, where.z + fz * 3, 70, 10, .28, 1.7, PARTY, 7);
      else if (id === 'fireworks') for (let i = 0; i < 3; i++) {
        const side = (i - 1) * 7;
        rockets.push({ x: where.x + fx * 3, y: where.y + 1, z: where.z + fz * 3, vx: fx * out - fz * side, vy: 9 + i * 2, vz: fz * out + fx * side, wait: i * .22, fuse: .75, colour: PARTY[Math.floor(rand() * 5)] });
      } else if (id === 'presents') {
        const gift = presents[nextPresent]; nextPresent = (nextPresent + 1) % presents.length;
        // Presents pop out to one side then the other, up and over, so the plane never hides them.
        const side = nextPresent % 2 ? 7 : -7;
        gift.position.set(where.x - fz * side * .4, where.y, where.z + fx * side * .4); gift.userData.vx = fx * out - fz * side; gift.userData.vz = fz * out + fx * side; gift.userData.fall = -6; gift.rotation.set(0, heading, 0); gift.scale.setScalar(1.5); gift.visible = true;
      } else for (let i = 0; i < 9; i++) spawn(where.x + fx * 2.5, where.y + .4, where.z + fz * 2.5, fx * (speed + 9) + (rand() - .5) * 5, (rand() - .3) * 4, fz * (speed + 9) + (rand() - .5) * 5, .2 + rand() * .14, .5, i % 2 ? '#ffd84a' : '#ffffff');
    },
    // A long run of stars rains gold around the plane.
    shower() { for (let i = 0; i < 44; i++) spawn(plane.position.x + (rand() - .5) * 12, plane.position.y + 3 + rand() * 5, plane.position.z + (rand() - .5) * 12, (rand() - .5) * 3, -2 - rand() * 3, (rand() - .5) * 3, .16 + rand() * .16, 1.1 + rand() * .5, rand() < .7 ? '#ffd84a' : '#fff6c9', 5); },
    // Wheels on the runway: two puffs of dust.
    touchdown() { for (let i = 0; i < 16; i++) spawn(plane.position.x + (i % 2 ? 1 : -1) * 1.1, plane.position.y - .9, plane.position.z, (rand() - .5) * 3, .6 + rand() * 1.4, 1 + rand() * 3, .4 + rand() * .3, .8, '#fff7e3', 0, 1); },
    celebrate(seconds = 6) { partyUntil = clock + seconds; nextFirework = 0; partyAt = plane.position.clone(); burst(partyAt.x, partyAt.y + 2, partyAt.z, 70, 9, .3, 2, PARTY, 6); },
    // Called every frame, also while parked, so the world keeps moving behind the menus.
    update(dt, flying, boosting, reach = 1) {
      clock += dt; pull = reach;
      sky.position.copy(camera.position);
      if (rollLeft > 0) { rollLeft = Math.max(0, rollLeft - dt / .9); const t = 1 - rollLeft; roll = reducedMotion ? 0 : rollSide * Math.PI * 2 * (t * t * (3 - 2 * t)); } else roll = 0;
      if (paint === 'rainbow') for (const coat of coats) coat.color.setHSL((clock * .15) % 1, .85, .55);
      const where = plane.position, heading = -plane.rotation.y, fx = Math.sin(heading), fz = -Math.cos(heading);
      if (flying) {
        const bx = where.x - fx * tail, bz = where.z - fz * tail, wide = () => (rand() - .5) * .8;
        if (trail === 'clouds' && rand() < 22 * dt) spawn(bx + wide(), where.y - .2, bz + wide(), -fx * 1.5, .3, -fz * 1.5, .17 + rand() * .12, 1, '#ffffff', 0, 1);
        if (trail === 'bubbles' && rand() < 20 * dt) spawn(bx + wide(), where.y, bz + wide(), -fx + wide(), 1 + rand(), -fz + wide(), .2 + rand() * .22, 1.4, rand() < .5 ? '#bfe9ff' : '#ffffff', -.5, 1);
        if (trail === 'ribbon' && rand() < 55 * dt) spawn(bx, where.y, bz, -fx * 1.2, 0, -fz * 1.2, .26, 1, PARTY[Math.floor(clock * 8) % 5]);
        if (trail === 'hearts' && rand() < 18 * dt) spawn(bx + wide(), where.y + wide(), bz + wide(), -fx + wide(), .8 + rand(), -fz + wide(), .26 + rand() * .14, 1.3, rand() < .6 ? '#ff5f8f' : '#ffc2d6', -.3, 1);
        if (boosting && rand() < 60 * dt) spawn(bx + wide(), where.y + wide(), bz + wide(), -fx * 6, wide(), -fz * 6, .16, .5, PARTY[Math.floor(rand() * 5)]);
      }
      for (const [star, left] of hops) {
        if (left - dt > 0) { hops.set(star, left - dt); continue; }
        hops.delete(star); burst(where.x, where.y, where.z, star.big ? 14 : 5, 4, .16, .4, ['#ffd84a', '#fff6c9'], 2);
      }
      // Big stars twinkle so they can be spotted from far away.
      for (const star of stars) if (star.big && !star.taken && inSky(star, route) && rand() < 9 * dt && Math.abs(star.x - where.x) + Math.abs(star.z - where.z) < 260) {
        const a = rand() * Math.PI * 2, r = 3.4 + rand() * 1.6;
        spawn(star.x + Math.cos(a) * r, star.y + (rand() - .5) * 6, star.z + Math.sin(a) * r, 0, .6, 0, .22 + rand() * .16, .7, rand() < .5 ? '#fff6c9' : '#ffd84a');
      }
      updateToys(dt);
      const sights = [...updateSea(dt, where), ...noticed.splice(0)], falling = updateNight(dt, flying, where, fx, fz);
      if (falling) sights.push(falling);
      for (const cloud of puffs) {
        if (flying && clock > cloud.userData.ready && where.distanceTo(cloud.position) < 6.5) {
          cloud.userData.ready = clock + 6; sights.push('cloud');
          for (let i = 0; i < 18; i++) spawn(where.x + (rand() - .5) * 5, where.y + (rand() - .5) * 3, where.z + (rand() - .5) * 5, (rand() - .5) * 6, rand() * 3, (rand() - .5) * 6, .7 + rand() * .5, 1.1, '#ffffff', 0, 1);
        }
      }
      for (const fan of fans) {
        const near = Math.hypot(where.x - fan.userData.x, where.z - fan.userData.z) < 60 || clock < partyUntil;
        fan.position.y = fan.userData.base + (reducedMotion ? 0 : Math.abs(Math.sin(clock * (near ? 8 : 2.5) + fan.userData.beat)) * (near ? .8 : .2));
      }
      if (clock < partyUntil && partyAt && clock > nextFirework) {
        nextFirework = clock + .4;
        const a = rand() * Math.PI * 2;
        burst(partyAt.x + Math.cos(a) * 14, partyAt.y + 8 + rand() * 9, partyAt.z + Math.sin(a) * 14, 26, 9, .45, 1.4, [PARTY[Math.floor(rand() * 5)], '#ffffff'], 5);
      }
      const fov = boosting && !reducedMotion ? 66 : 56;
      if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix(); }
      drawItems(); updateParticles(dt);
      return sights;
    }
  };
}
