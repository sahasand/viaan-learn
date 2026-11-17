// Draws Big City, built in code rather than in Blender: the ground and its streets, the
// towers, parks, the terminal, a Ferris wheel, cars and a blimp. Where things stand comes
// from city.js; this file only draws.
import * as THREE from 'three';
import { CITY_GROUND } from './airline.js?v=7';
import { cityPlan, TOWER, AVENUE, CROSS, PARK, COLUMNS, ROWS, WHEEL } from './city.js?v=7';

const EDGE = { x: 96 * .9275, z: 78 * .9275 };      // where the flat ground ends and the beach begins
const BODY = ['#f7b9a6', '#a8d3f4', '#f8e19c', '#b6e2c4', '#d6c1f1', '#f1f3f5'];
const GLASS = ['#6a8fc0', '#4f79b4', '#7a93b8', '#5f97a8', '#7d78c0', '#6aa3d6'];
const CARS = ['#eb5a46', '#ffc93c', '#3f9fe0', '#ffffff', '#58c7a0', '#f2559c', '#ffd400'];
const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...more });

export function createCity({ scene, airport, reducedMotion }) {
  const { towers, parks } = cityPlan(), group = new THREE.Group(), rand = (() => { let n = 2024; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  group.position.set(airport.x, 0, airport.z); scene.add(group);
  const add = (geometry, material, x, y, z, parent = group) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const streetsX = COLUMNS.slice(0, -1).map((x, i) => (x + COLUMNS[i + 1]) / 2), streetsZ = ROWS.slice(0, -1).map((z, i) => (z + ROWS[i + 1]) / 2);

  /* ---------- ground: a sandy slab with the street plan painted on top ---------- */
  add(new THREE.CylinderGeometry(.9275, 1.04, CITY_GROUND, 72, 1), mat('#ecdcb4'), 0, CITY_GROUND / 2, 0).scale.set(96, 1, 78);
  const S = 1024, px = x => (x / EDGE.x * .5 + .5) * S, pz = z => (z / EDGE.z * .5 + .5) * S, kx = S / (EDGE.x * 2), kz = S / (EDGE.z * 2);
  const plan = canvasOf(S, S, g => {
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, S, S);
    const road = (x, z, w, h) => { g.fillStyle = '#5b636e'; g.fillRect(px(x - w / 2), pz(z - h / 2), w * kx, h * kz); };
    for (const x of streetsX) road(x, 0, x === AVENUE ? 0 : 8, 160);
    for (const z of streetsZ) road(0, z, 190, 8);
    road(AVENUE, 0, 15, 160);
    // Lane lines, and zebra crossings where streets meet the avenue.
    g.fillStyle = '#f4f1e6';
    for (const x of streetsX) if (x !== AVENUE) for (let z = -76; z < 76; z += 6) g.fillRect(px(x) - 1.5, pz(z), 3, 3 * kz);
    for (const z of streetsZ) for (let x = -92; x < 92; x += 6) if (Math.abs(x + 1.5 - AVENUE) > 9) g.fillRect(px(x), pz(z) - 1.5, 3 * kx, 3);
    for (let z = -76; z < 12; z += 7) g.fillRect(px(AVENUE) - 2, pz(z), 4, 3.6 * kz);
    for (const z of streetsZ) for (const side of [-1, 1]) for (let i = -3; i <= 3; i++) g.fillRect(px(AVENUE + i * 1.9) - 3, pz(z + side * 5.6) - 5, 6, 10);
    // Every block gets a pale pavement; open blocks are grass.
    for (const x of COLUMNS) for (const z of ROWS) {
      const open = parks.some(p => Math.abs(p.x - airport.x - x) < 1 && Math.abs(p.z - airport.z - z) < 1), apron = x > AVENUE && z > 20;
      g.fillStyle = apron ? '#d9dde2' : open ? '#8fce7e' : '#f6f2e8'; g.beginPath(); g.roundRect ? g.roundRect(px(x - 8), pz(z - 8), 16 * kx, 16 * kz, 14) : g.rect(px(x - 8), pz(z - 8), 16 * kx, 16 * kz); g.fill();
    }
    g.fillStyle = '#7fd0ee'; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 3.6 * kx, 3.6 * kz, 0, 0, Math.PI * 2); g.fill();
    // A grassy edge all the way round, between the streets and the beach.
    g.strokeStyle = '#9ad68a'; g.lineWidth = 46; g.beginPath(); g.ellipse(S / 2, S / 2, S / 2 - 8, S / 2 - 8, 0, 0, Math.PI * 2); g.stroke();
  });
  const top = add(new THREE.CircleGeometry(1, 72), new THREE.MeshStandardMaterial({ map: plan, roughness: .95 }), 0, CITY_GROUND + .02, 0);
  top.rotation.x = -Math.PI / 2; top.scale.set(EDGE.x, EDGE.z, 1); top.castShadow = false;
  // The runway, with its centre line and striped ends.
  const strip = canvasOf(64, 512, g => { g.fillStyle = '#4b525c'; g.fillRect(0, 0, 64, 512); g.fillStyle = '#fff'; for (let y = 60; y < 450; y += 44) g.fillRect(29, y, 6, 24); for (const y of [10, 474]) for (let x = 6; x < 60; x += 10) g.fillRect(x, y, 5, 28); });
  const runway = add(new THREE.PlaneGeometry(10, 48), new THREE.MeshStandardMaterial({ map: strip, roughness: .9 }), AVENUE, CITY_GROUND + .06, 38); runway.rotation.x = -Math.PI / 2; runway.castShadow = false;

  /* ---------- towers: pastel walls, rows of windows, and something different on every roof ---------- */
  const walls = BODY.map((body, i) => canvasOf(64, 64, g => {
    g.fillStyle = body; g.fillRect(0, 0, 64, 64); g.fillStyle = '#0000001a'; g.fillRect(0, 58, 64, 6);
    for (const x of [8, 37]) { g.fillStyle = GLASS[i]; g.fillRect(x, 14, 19, 34); g.fillStyle = '#ffffff55'; g.fillRect(x, 14, 19, 9); g.fillStyle = '#ffffff30'; g.fillRect(x + 12, 14, 3, 34); }
  })).map(texture => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: texture, roughness: .55, metalness: .08 }); });
  const roofs = BODY.map(c => mat(new THREE.Color(c).multiplyScalar(.82))), dark = mat('#55606c'), green = mat('#6fbf63'), leaf = mat('#3f9e55'), white = mat('#fbfaf5'), red = mat('#ef5a45');
  const helipad = new THREE.MeshStandardMaterial({ roughness: .9, map: canvasOf(128, 128, g => { g.fillStyle = '#6b7480'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd84a'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.fillText('H', 64, 86); }) });
  const blinkers = [];
  for (const t of towers) {
    const x = t.x - airport.x, z = t.z - airport.z, wide = TOWER * 2, tall = t.top - CITY_GROUND, floors = Math.max(2, Math.round(tall / 4.2));
    const box = new THREE.BoxGeometry(wide, tall, wide), uv = box.attributes.uv;
    for (let i = 0; i < uv.count; i++) if (i < 8 || i >= 16) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * floors);   // the four walls; the roof and floor are faces 2 and 3
    const side = walls[t.style], roof = t.style === 3 ? helipad : roofs[t.style];
    add(box, [side, side, roof, roof, side, side], x, CITY_GROUND + tall / 2, z);
    add(new THREE.BoxGeometry(wide + .7, .6, wide + .7), roofs[t.style], x, t.top + .1, z);                        // a rim round the roof
    if (t.top > 55) {            // the tallest wear a crown and a spire with a blinking light
      add(new THREE.BoxGeometry(wide * .6, 5, wide * .6), side, x, t.top + 2.5, z); add(new THREE.ConeGeometry(.9, 9, 8), white, x, t.top + 9.5, z);
      blinkers.push(add(new THREE.SphereGeometry(.55, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a3d' }), x, t.top + 14.3, z));
    } else if (t.style === 0) { add(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 10), mat('#c98a4b'), x + 2, t.top + 2.2, z - 2); add(new THREE.ConeGeometry(2, 1.3, 10), dark, x + 2, t.top + 4.1, z - 2); }   // a water tank
    else if (t.style === 2 || t.style === 4) { add(new THREE.BoxGeometry(wide - 2, .5, wide - 2), green, x, t.top + .5, z); for (const [dx, dz] of [[-2.6, -2.4], [2.4, 1.8], [-1.6, 2.8]]) add(new THREE.SphereGeometry(1.3, 8, 6), leaf, x + dx, t.top + 1.9, z + dz); }   // a roof garden
    else if (t.style !== 3) for (const [dx, dz] of [[-2, 2], [2.2, -1.6]]) add(new THREE.BoxGeometry(2.2, 1.3, 1.8), dark, x + dx, t.top + 1, z + dz);   // air conditioners
  }

  /* ---------- parks, avenue trees and the terminal ---------- */
  const spots = [];
  for (const p of parks) { const x = p.x - airport.x, z = p.z - airport.z; if (x > AVENUE && z > 20) continue; for (const [dx, dz] of [[-5, -5], [5, -4.6], [-4.6, 5], [5.2, 5.2], [0, -6.2], [-6.2, 0.4]]) spots.push([x + dx, z + dz, 1.5 + rand() * .7]); }
  for (let z = -72; z <= 8; z += 8) for (const side of [-1, 1]) if (streetsZ.every(s => Math.abs(s - z) > 4.5)) spots.push([AVENUE + side * 8.6, z, 1]);
  for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + rand() * .08; spots.push([Math.cos(a) * (EDGE.x - 3.2), Math.sin(a) * (EDGE.z - 3.2), .9 + rand() * .8]); }
  const kept = spots.filter(([x, z]) => !(Math.abs(x - AVENUE) < 7 && z > 8) && Math.hypot(x - 40, z - 43) > 11 && Math.hypot(x - WHEEL.x, z - WHEEL.z) > 9), dummy = new THREE.Object3D();
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 9, 7), leaf, kept.length), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, 1.6, 6), mat('#8a5a34'), kept.length);
  kept.forEach(([x, z, size], i) => {
    dummy.position.set(x, CITY_GROUND + .8 * size, z); dummy.scale.setScalar(size); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = CITY_GROUND + 2.5 * size; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [crowns, trunks]) { m.castShadow = true; group.add(m); }
  add(new THREE.CylinderGeometry(3.6, 3.6, .5, 24), white, PARK.x, CITY_GROUND + .25, PARK.z);                  // the park fountain
  const jet = add(new THREE.ConeGeometry(.7, 3.2, 10), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: .8 }), PARK.x, CITY_GROUND + 2, PARK.z);
  add(new THREE.BoxGeometry(13, 5.4, 10), white, 40, CITY_GROUND + 2.7, 43); add(new THREE.BoxGeometry(13.6, .7, 10.6), red, 40, CITY_GROUND + 5.7, 43);
  add(new THREE.BoxGeometry(12.2, 2.2, .3), mat('#7fb4dc', { roughness: .3 }), 40, CITY_GROUND + 2.6, 37.9);

  /* ---------- a Ferris wheel by the shore ---------- */
  const wheel = new THREE.Group(), hub = CITY_GROUND + 15.5, cabins = [];
  wheel.position.set(WHEEL.x, hub, WHEEL.z); group.add(wheel);
  add(new THREE.TorusGeometry(12, .35, 8, 48), white, 0, 0, 0, wheel); add(new THREE.TorusGeometry(11, .2, 6, 48), red, 0, 0, 0, wheel);
  for (let i = 0; i < 8; i++) { const spoke = add(new THREE.CylinderGeometry(.14, .14, 24, 5), white, 0, 0, 0, wheel); spoke.rotation.z = i / 8 * Math.PI; }
  for (let i = 0; i < 10; i++) cabins.push(add(new THREE.SphereGeometry(1.3, 10, 8), mat(CARS[i % CARS.length]), 0, 0, 0, group));
  for (const side of [-1, 1]) for (const lean of [-1, 1]) { const leg = add(new THREE.CylinderGeometry(.35, .5, 17.5, 6), white, WHEEL.x + lean * 3.6, CITY_GROUND + 7.8, WHEEL.z + side * 1.6); leg.rotation.z = lean * .42; }

  /* ---------- cars ---------- */
  const drivers = [];
  for (const z of streetsZ) for (const lane of [-1, 1]) for (let i = 0; i < 2; i++) drivers.push({ along: 'x', fixed: z + lane * 1.9, way: lane, at: rand() * 170 - 85, speed: 7 + rand() * 5, span: 85 });
  for (const x of streetsX) if (x !== AVENUE) for (const lane of [-1, 1]) drivers.push({ along: 'z', fixed: x + lane * 1.9, way: -lane, at: rand() * 130 - 65, speed: 7 + rand() * 5, span: 66 });
  for (const lane of [-1, 1]) for (let i = 0; i < 3; i++) drivers.push({ along: 'z', fixed: AVENUE + lane * 4.2, way: -lane, at: -70 + i * 26 + rand() * 8, speed: 8 + rand() * 4, span: 0 });
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 1.2, 1.4), new THREE.MeshStandardMaterial({ roughness: .5 }), drivers.length), paint = new THREE.Color();
  drivers.forEach((d, i) => cars.setColorAt(i, paint.set(CARS[i % CARS.length]))); cars.castShadow = true; group.add(cars);
  function drive(dt) {
    drivers.forEach((d, i) => {
      // Avenue cars keep to the part north of the runway; the rest loop from shore to shore.
      d.at += d.way * d.speed * dt;
      if (d.span) { if (d.at > d.span) d.at = -d.span; else if (d.at < -d.span) d.at = d.span; } else if (d.at > 6) d.at = -74; else if (d.at < -74) d.at = 6;
      const x = d.along === 'x' ? d.at : d.fixed, z = d.along === 'x' ? d.fixed : d.at, on = Math.hypot(x / EDGE.x, z / EDGE.z) < .93;
      dummy.position.set(x, CITY_GROUND + .7, z); dummy.rotation.set(0, d.along === 'x' ? 0 : Math.PI / 2, 0); dummy.scale.setScalar(on ? 1 : 0); dummy.updateMatrix(); cars.setMatrixAt(i, dummy.matrix);
    });
    dummy.rotation.set(0, 0, 0); cars.instanceMatrix.needsUpdate = true;
  }

  /* ---------- a blimp, high above the towers ---------- */
  const blimp = new THREE.Group(); group.add(blimp);
  const banner = canvasOf(512, 256, g => { g.fillStyle = '#ffd24a'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ef5a45'; g.fillRect(0, 96, 512, 64); g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; for (const x of [128, 384]) g.fillText('HELLO VIAAN', x, 144); });
  banner.wrapS = THREE.RepeatWrapping;
  add(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ map: banner, roughness: .5 }), 0, 0, 0, blimp).scale.set(4, 4, 11);
  add(new THREE.BoxGeometry(1.6, 1.2, 4), white, 0, -4.2, .5, blimp);
  for (const [w, h] of [[.3, 5.5], [5.5, .3]]) add(new THREE.BoxGeometry(w, h, 2.6), red, 0, 0, -9.6, blimp);

  drive(0);
  return {
    // Called every frame while the game is not paused.
    update(dt, clock) {
      if (reducedMotion) dt = 0;
      const turn = clock * .22; wheel.rotation.z = turn;
      cabins.forEach((cabin, i) => { const a = turn + i / cabins.length * Math.PI * 2; cabin.position.set(WHEEL.x + Math.cos(a) * 12, hub + Math.sin(a) * 12 - 1.5, WHEEL.z); });
      drive(dt);
      const a = clock * .06; blimp.position.set(-8 + Math.cos(a) * 64, 60 + Math.sin(clock * .5) * 1.2, -18 + Math.sin(a) * 50); blimp.rotation.y = -a;
      jet.scale.y = 1 + Math.sin(clock * 5) * .18;
      blinkers.forEach((light, i) => light.visible = Math.sin(clock * 3 + i) > -.3);
    }
  };
}
