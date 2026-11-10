// The playful layer of Little Pilot: things to collect, sparkles, sea friends,
// runway fans, plane paint and trails. Rules live in sky.js; this file only draws.
import * as THREE from 'three';
import { PLANE_PAINTS } from './sky.js';

const PARTY = ['#eb6548', '#ffc44e', '#58c7b0', '#f2559c', '#5b8def', '#ffffff'];
const BALLOONS = ['#f2559c', '#ffc44e', '#5b8def', '#58c7b0', '#eb6548', '#8a55e0'];
const FANS = ['bear', 'cat', 'dog', 'duck', 'elephant', 'giraffe', 'lion', 'owl', 'turtle'];
const PMAX = 520;

export function createFun({ scene, camera, plane, items, airports, runwayOf, water, reducedMotion }) {
  const dummy = new THREE.Object3D(), tint = new THREE.Color(), rand = Math.random;
  const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...options });
  let clock = 0, roll = 0, rollLeft = 0, rollSide = 1, route = '', trail = 'clouds', paint = 'red', partyUntil = 0, nextSpout = 3, nextFirework = 0, partyAt = null;
  const seen = new Set();

  /* ---------- a bright sky ---------- */
  const horizon = new THREE.Color('#d3f1f6');
  const sky = new THREE.Mesh(new THREE.SphereGeometry(840, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f97ea') }, horizon: { value: horizon }, sunDir: { value: new THREE.Vector3(.4, .78, .32).normalize() } },
    vertexShader: 'varying vec3 dir; void main(){ dir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, horizon, sunDir; varying vec3 dir;
      void main(){ vec3 d = normalize(dir); float h = clamp(d.y, 0., 1.);
        vec3 c = mix(horizon, top, pow(h, .55)); float s = max(dot(d, sunDir), 0.);
        c += vec3(1., .95, .78) * (pow(s, 380.) * 1.4 + pow(s, 9.) * .22);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`
  }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  scene.background = horizon; scene.fog.color.copy(horizon);
  if (water?.material?.uniforms?.fogColor) water.material.uniforms.fogColor.value.copy(horizon);

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
      const lead = route && star.route === route, size = star.taken ? 0 : lead ? 1.35 + (reducedMotion ? 0 : Math.sin(clock * 5 + i) * .12) : star.route ? .8 : 1;
      dummy.position.set(star.x, star.y + (reducedMotion ? 0 : Math.sin(clock * 2 + i) * .25), star.z); dummy.rotation.set(0, spin + i, 0); dummy.scale.setScalar(size); dummy.updateMatrix();
      starMesh.setMatrixAt(i, dummy.matrix);
    });
    balloons.forEach((b, i) => {
      const bob = reducedMotion ? 0 : Math.sin(clock * 1.3 + i) * .5, show = b.taken ? 0 : 1;
      dummy.rotation.set(0, 0, 0); dummy.position.set(b.x, b.y + bob, b.z); dummy.scale.set(2.3 * show, 2.8 * show, 2.3 * show); dummy.updateMatrix(); balloonMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, b.y + bob - 4.6, b.z); dummy.scale.set(show, 3.8 * show, show); dummy.updateMatrix(); stringMesh.setMatrixAt(i, dummy.matrix);
    });
    hoops.forEach((hoop, i) => { hoopMeshes[i].visible = !hoop.taken; if (!reducedMotion) hoopMeshes[i].rotation.z = clock * .6; });
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

  /* ---------- the plane's paint ---------- */
  const coats = new Set();
  plane.traverse(o => { if (o.isMesh && o.material.name === 'Coral enamel') coats.add(o.material); });
  function setPaint(id) {
    const choice = PLANE_PAINTS.find(p => p.id === id) || PLANE_PAINTS[0]; paint = choice.id;
    for (const coat of coats) { coat.color.set(choice.color); coat.metalness = paint === 'gold' ? .55 : 0; coat.roughness = paint === 'gold' ? .28 : .32; }
  }

  return {
    get roll() { return roll; },
    setPaint, burst,
    setTrail(id) { trail = id; },
    // Stars on the route of the current trip glow bigger so they are easy to follow.
    setRoute(id) { route = id; seen.clear(); },
    trick() {
      if (rollLeft > 0) return false;
      rollLeft = 1; rollSide = rand() < .5 ? -1 : 1;
      burst(plane.position.x, plane.position.y, plane.position.z, 20, 7, .22, .8, PARTY, 3);
      return true;
    },
    collected(thing) {
      if (thing.kind === 'star') burst(thing.x, thing.y, thing.z, 10, 6, .22, .6, ['#ffd84a', '#fff6c9'], 4);
      else if (thing.kind === 'balloon') burst(thing.x, thing.y, thing.z, 26, 9, .3, .9, [thing.color || '#f2559c', '#ffffff'], 9);
      else for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; spawn(thing.x + Math.cos(a) * 6 * Math.cos(thing.heading), thing.y + Math.sin(a) * 6, thing.z + Math.cos(a) * 6 * Math.sin(thing.heading), Math.cos(a) * 4, Math.sin(a) * 4, 0, .34, .9, PARTY[i % 5], 0); }
    },
    celebrate(seconds = 6) { partyUntil = clock + seconds; nextFirework = 0; partyAt = plane.position.clone(); burst(partyAt.x, partyAt.y + 2, partyAt.z, 70, 9, .3, 2, PARTY, 6); },
    // Called every frame, also while parked, so the world keeps moving behind the menus.
    update(dt, flying, boosting) {
      clock += dt;
      sky.position.copy(camera.position);
      if (rollLeft > 0) { rollLeft = Math.max(0, rollLeft - dt / .9); const t = 1 - rollLeft; roll = reducedMotion ? 0 : rollSide * Math.PI * 2 * (t * t * (3 - 2 * t)); } else roll = 0;
      if (paint === 'rainbow') for (const coat of coats) coat.color.setHSL((clock * .15) % 1, .85, .55);
      const where = plane.position, heading = -plane.rotation.y, fx = Math.sin(heading), fz = -Math.cos(heading);
      if (flying) {
        const bx = where.x - fx * 2.2, bz = where.z - fz * 2.2, wide = () => (rand() - .5) * .8;
        if (trail === 'clouds' && rand() < 22 * dt) spawn(bx + wide(), where.y - .2, bz + wide(), -fx * 1.5, .3, -fz * 1.5, .17 + rand() * .12, 1, '#ffffff', 0, 1);
        if (trail === 'bubbles' && rand() < 20 * dt) spawn(bx + wide(), where.y, bz + wide(), -fx + wide(), 1 + rand(), -fz + wide(), .2 + rand() * .22, 1.4, rand() < .5 ? '#bfe9ff' : '#ffffff', -.5, 1);
        if (trail === 'ribbon' && rand() < 55 * dt) spawn(bx, where.y, bz, -fx * 1.2, 0, -fz * 1.2, .26, 1, PARTY[Math.floor(clock * 8) % 5]);
        if (trail === 'hearts' && rand() < 18 * dt) spawn(bx + wide(), where.y + wide(), bz + wide(), -fx + wide(), .8 + rand(), -fz + wide(), .26 + rand() * .14, 1.3, rand() < .6 ? '#ff5f8f' : '#ffc2d6', -.3, 1);
        if (boosting && rand() < 60 * dt) spawn(bx + wide(), where.y + wide(), bz + wide(), -fx * 6, wide(), -fz * 6, .16, .5, PARTY[Math.floor(rand() * 5)]);
      }
      const sights = updateSea(dt, where);
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
