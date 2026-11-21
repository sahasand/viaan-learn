// Draws Big City, built in code rather than in Blender: the ground with its street plan, a
// downtown of towers inside a ring of houses, parks, the airport, a harbour, a Ferris wheel,
// traffic and a blimp. Where things stand comes from city.js; this file only draws.
import * as THREE from 'three';
import { CITY, CITY_GROUND } from './airline.js?v=9';
import { cityPlan, TOWER, AVENUE, ROADS_NS, ROADS_EW, PARK, WHEEL } from './city.js?v=9';

const BODY = ['#f7b9a6', '#a8d3f4', '#f8e19c', '#b6e2c4', '#d6c1f1', '#f1f3f5'];
const GLASS = ['#6a8fc0', '#4f79b4', '#7a93b8', '#5f97a8', '#7d78c0', '#6aa3d6'];
const HOUSES = ['#ffd9b8', '#ffe9a8', '#cfe8f7', '#d8f0c8', '#f4d0e0', '#ffffff'], HOUSE_ROOFS = ['#e0565f', '#c9703a', '#3f88c5', '#5fae4e', '#8e6fd1', '#e59a1f'];
const CARS = ['#eb5a46', '#ffc93c', '#3f9fe0', '#ffffff', '#58c7a0', '#f2559c', '#ffd400', '#8e6fd1'];
const W = CITY.x1 - CITY.x0, D = CITY.z1 - CITY.z0, AIRPORT = { x0: AVENUE - 16, x1: 64, z0: 2 };   // the apron: no streets cross it
const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...more });
// The city's outline, seen from above, as a shape. `grow` moves the edge out (or in).
function outline(grow = 0) {
  const s = new THREE.Shape(), x0 = CITY.x0 - grow, x1 = CITY.x1 + grow, y0 = -(CITY.z1 + grow), y1 = -(CITY.z0 - grow), r = CITY.corner + grow;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export function createCity({ scene, airport, reducedMotion }) {
  const { towers, houses, parks } = cityPlan(), group = new THREE.Group(), rand = (() => { let n = 2024; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  group.position.set(airport.x, 0, airport.z); scene.add(group);
  const add = (geometry, material, x, y, z, parent = group, shadow = true) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const inAirport = (x, z) => x > AIRPORT.x0 && x < AIRPORT.x1 && z > AIRPORT.z0, dummy = new THREE.Object3D(), paint = new THREE.Color();
  const white = mat('#fbfaf5'), dark = mat('#55606c'), green = mat('#6fbf63'), leaf = mat('#3f9e55'), red = mat('#ef5a45');

  /* ---------- ground: a sandy slab with the street plan painted on top ---------- */
  const slab = add(new THREE.ExtrudeGeometry(outline(3), { depth: CITY_GROUND, bevelEnabled: false, curveSegments: 10 }), mat('#ecdcb4'), 0, 0, 0); slab.rotation.x = -Math.PI / 2;
  const SX = 1024, SZ = Math.round(SX * D / W), kx = SX / W, kz = SZ / D, px = x => (x - CITY.x0) * kx, pz = z => (z - CITY.z0) * kz;
  const plan = canvasOf(SX, SZ, g => {
    const rect = (x0, z0, x1, z1, color, round = 0) => { g.fillStyle = color; g.beginPath(); g.roundRect ? g.roundRect(px(x0), pz(z0), (x1 - x0) * kx, (z1 - z0) * kz, round) : g.rect(px(x0), pz(z0), (x1 - x0) * kx, (z1 - z0) * kz); g.fill(); };
    rect(CITY.x0, CITY.z0, CITY.x1, CITY.z1, '#9ad68a');                                       // grass to the edge
    rect(CITY.x0 + 9, CITY.z0 + 9, CITY.x1 - 9, CITY.z1 - 7, '#e9e4d8', 90);                   // pavement
    rect(CITY.x0 + 9, 66, CITY.x1 - 9, CITY.z1 - 4, '#d9b98a', 20);                            // the harbour boardwalk
    // Streets, then their lane lines.
    for (const r of ROADS_NS) rect(r.at - r.wide / 2, CITY.z0 + 6, r.at + r.wide / 2, r.at === AVENUE ? 4 : 68, '#5b636e');
    for (const r of ROADS_EW) { if (r.at > AIRPORT.z0) { rect(CITY.x0 + 6, r.at - r.wide / 2, AIRPORT.x0, r.at + r.wide / 2, '#5b636e'); rect(AIRPORT.x1, r.at - r.wide / 2, CITY.x1 - 6, r.at + r.wide / 2, '#5b636e'); } else rect(CITY.x0 + 6, r.at - r.wide / 2, CITY.x1 - 6, r.at + r.wide / 2, '#5b636e'); }
    g.fillStyle = '#f4f1e6';
    for (const r of ROADS_NS) for (let z = CITY.z0 + 10; z < (r.at === AVENUE ? 0 : 64); z += 7) g.fillRect(px(r.at) - 1.5, pz(z), 3, 3.4 * kz);
    for (const r of ROADS_EW) for (let x = CITY.x0 + 10; x < CITY.x1 - 10; x += 7) if (!(r.at > AIRPORT.z0 && x > AIRPORT.x0 - 6 && x < AIRPORT.x1 + 2)) g.fillRect(px(x), pz(r.at) - 1.5, 3.4 * kx, 3);
    // Zebra crossings where the wide streets meet.
    for (const a of ROADS_NS.filter(r => r.wide > 8)) for (const b of ROADS_EW.filter(r => r.wide > 8)) for (const side of [-1, 1]) for (let i = -3; i <= 3; i++) { g.fillRect(px(a.at + i * 1.7) - 2.5, pz(b.at + side * (b.wide / 2 + 2.2)) - 5, 5, 10); g.fillRect(px(a.at + side * (a.wide / 2 + 2.2)) - 5, pz(b.at + i * 1.7) - 2.5, 10, 5); }
    // Building lots, open lots as little parks, Central Park with its pond, and the airport's apron.
    for (const b of [...towers, ...houses]) rect(b.x - airport.x - 8, b.z - airport.z - 8, b.x - airport.x + 8, b.z - airport.z + 8, '#f6f2e8', 12);
    for (const p of parks) rect(p.x - airport.x - 9, p.z - airport.z - 9, p.x - airport.x + 9, p.z - airport.z + 9, '#8fce7e', 16);
    rect(PARK.x - PARK.half - 8, PARK.z - PARK.half - 8, PARK.x + PARK.half + 8, PARK.z + PARK.half + 8, '#7fcf70', 26);
    g.strokeStyle = '#e9e4d8'; g.lineWidth = 7; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 21 * kx, 21 * kz, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#7fd0ee'; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 9 * kx, 7 * kz, 0, 0, Math.PI * 2); g.fill();
    rect(AIRPORT.x0, AIRPORT.z0, AIRPORT.x1, 70, '#d9dde2', 20);
  });
  const top = add(new THREE.ShapeGeometry(outline(-1.5), 10), new THREE.MeshStandardMaterial({ map: plan, roughness: .95 }), 0, CITY_GROUND + .02, 0, group, false);
  const uv = top.geometry.attributes.uv, at = top.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (at.getX(i) - CITY.x0) / W, 1 - (-at.getY(i) - CITY.z0) / D);
  top.rotation.x = -Math.PI / 2;
  // The runway, with its centre line and striped ends.
  const strip = canvasOf(64, 512, g => { g.fillStyle = '#4b525c'; g.fillRect(0, 0, 64, 512); g.fillStyle = '#fff'; for (let y = 60; y < 450; y += 44) g.fillRect(29, y, 6, 24); for (const y of [10, 474]) for (let x = 6; x < 60; x += 10) g.fillRect(x, y, 5, 28); });
  const runway = add(new THREE.PlaneGeometry(10, 48), new THREE.MeshStandardMaterial({ map: strip, roughness: .9 }), AVENUE, CITY_GROUND + .06, 38, group, false); runway.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(13, 5.4, 10), white, 40, CITY_GROUND + 2.7, 43); add(new THREE.BoxGeometry(13.6, .7, 10.6), red, 40, CITY_GROUND + 5.7, 43);
  add(new THREE.BoxGeometry(12.2, 2.2, .3), mat('#7fb4dc', { roughness: .3 }), 40, CITY_GROUND + 2.6, 37.9);

  /* ---------- downtown: pastel towers with rows of windows, and something on many roofs ---------- */
  const walls = BODY.map((body, i) => canvasOf(64, 64, g => {
    g.fillStyle = body; g.fillRect(0, 0, 64, 64); g.fillStyle = '#0000001a'; g.fillRect(0, 58, 64, 6);
    for (const x of [8, 37]) { g.fillStyle = GLASS[i]; g.fillRect(x, 14, 19, 34); g.fillStyle = '#ffffff55'; g.fillRect(x, 14, 19, 9); g.fillStyle = '#ffffff30'; g.fillRect(x + 12, 14, 3, 34); }
  })).map(texture => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: texture, roughness: .55, metalness: .08 }); });
  const roofs = BODY.map(c => mat(new THREE.Color(c).multiplyScalar(.82)));
  const helipad = new THREE.MeshStandardMaterial({ roughness: .9, map: canvasOf(128, 128, g => { g.fillStyle = '#6b7480'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd84a'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.fillText('H', 64, 86); }) });
  const blinkers = [];
  towers.forEach((t, n) => {
    const x = t.x - airport.x, z = t.z - airport.z, wide = TOWER * 2, tall = t.top - CITY_GROUND, floors = Math.max(2, Math.round(tall / 4.2));
    const box = new THREE.BoxGeometry(wide, tall, wide), map = box.attributes.uv;
    for (let i = 0; i < map.count; i++) if (i < 8 || i >= 16) map.setXY(i, map.getX(i) * 2, map.getY(i) * floors);   // the four walls; the roof and floor are faces 2 and 3
    const side = walls[t.style], roof = t.style === 3 ? helipad : roofs[t.style];
    add(box, [side, side, roof, roof, side, side], x, CITY_GROUND + tall / 2, z);
    if (t.top > 55) {            // the tallest wear a crown and a spire with a blinking light
      add(new THREE.BoxGeometry(wide * .6, 5, wide * .6), side, x, t.top + 2.5, z); add(new THREE.ConeGeometry(.9, 9, 8), white, x, t.top + 9.5, z);
      blinkers.push(add(new THREE.SphereGeometry(.55, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a3d' }), x, t.top + 14.3, z, group, false));
    } else if (n % 3 === 0) { add(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 10), mat('#c98a4b'), x + 2, t.top + 1.6, z - 2); add(new THREE.ConeGeometry(2, 1.3, 10), dark, x + 2, t.top + 3.5, z - 2, group, false); }   // a water tank
    else if (n % 3 === 1 && t.style !== 3) { add(new THREE.BoxGeometry(wide - 2, .5, wide - 2), green, x, t.top + .25, z, group, false); for (const [dx, dz] of [[-2.6, -2.4], [2.4, 1.8]]) add(new THREE.SphereGeometry(1.3, 8, 6), leaf, x + dx, t.top + 1.4, z + dz, group, false); }   // a roof garden
  });

  /* ---------- the ring of houses: one drawing for all the walls and one for all the roofs ---------- */
  const homes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .8 }), houses.length), homeRoofs = new THREE.InstancedMesh(new THREE.ConeGeometry(.82, 1, 4), new THREE.MeshStandardMaterial({ roughness: .8 }), houses.length);
  houses.forEach((h, i) => {
    const x = h.x - airport.x, z = h.z - airport.z, tall = h.top - CITY_GROUND - 2.4, wide = TOWER * 2 - 1;
    dummy.position.set(x, CITY_GROUND + tall / 2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(wide, tall, wide); dummy.updateMatrix(); homes.setMatrixAt(i, dummy.matrix); homes.setColorAt(i, paint.set(HOUSES[h.style]));
    dummy.position.y = CITY_GROUND + tall + 1.2; dummy.rotation.y = Math.PI / 4; dummy.scale.set(wide, 2.4, wide); dummy.updateMatrix(); homeRoofs.setMatrixAt(i, dummy.matrix); homeRoofs.setColorAt(i, paint.set(HOUSE_ROOFS[(h.style + i) % HOUSE_ROOFS.length]));
  });
  for (const m of [homes, homeRoofs]) { m.castShadow = m.receiveShadow = true; group.add(m); }

  /* ---------- trees: along the wide streets, in every little park and all through Central Park ---------- */
  const spots = [];
  for (const p of parks) { const x = p.x - airport.x, z = p.z - airport.z; if (Math.abs(x - PARK.x) < PARK.half + 4 && Math.abs(z - PARK.z) < PARK.half + 4) continue; for (const [dx, dz] of [[-5, -5], [5, -4.6], [-4.6, 5], [5.2, 5.2]]) spots.push([x + dx, z + dz, 1.3 + rand() * .7]); }
  for (let i = 0; i < 26; i++) { const a = rand() * Math.PI * 2, r = 12 + rand() * 17; spots.push([PARK.x + Math.cos(a) * r, PARK.z + Math.sin(a) * r, 1.2 + rand() * 1]); }
  for (const r of ROADS_NS.filter(r => r.wide > 8)) for (let z = CITY.z0 + 16; z < (r.at === AVENUE ? -4 : 60); z += 12) for (const side of [-1, 1]) spots.push([r.at + side * (r.wide / 2 + 1.6), z, .9]);
  for (const r of ROADS_EW.filter(r => r.wide > 8)) for (let x = CITY.x0 + 16; x < CITY.x1 - 16; x += 12) for (const side of [-1, 1]) spots.push([x, r.at + side * (r.wide / 2 + 1.6), .9]);
  for (let x = CITY.x0 + 30; x < CITY.x1 - 30; x += 13) if (Math.abs(x - AVENUE) > 26) spots.push([x, 71, 1.1]);     // trees along the boardwalk
  const clear = ([x, z]) => !inAirport(x, z) && Math.hypot(x - WHEEL.x, z - WHEEL.z) > 15 && ROADS_NS.every(r => Math.abs(x - r.at) > r.wide / 2 + .8) && ROADS_EW.every(r => Math.abs(z - r.at) > r.wide / 2 + .8);
  const kept = spots.filter(clear), crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 8, 6), leaf, kept.length), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, 1.6, 6), mat('#8a5a34'), kept.length);
  kept.forEach(([x, z, size], i) => {
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, CITY_GROUND + .8 * size, z); dummy.scale.setScalar(size); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = CITY_GROUND + 2.5 * size; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [crowns, trunks]) { m.castShadow = true; group.add(m); }
  add(new THREE.CylinderGeometry(2.6, 2.6, .5, 20), white, PARK.x, CITY_GROUND + .25, PARK.z, group, false);                  // the park's fountain
  const jet = add(new THREE.ConeGeometry(.6, 3, 10), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: .8 }), PARK.x, CITY_GROUND + 1.9, PARK.z, group, false);

  /* ---------- the harbour: a pier, boats, and the Ferris wheel ---------- */
  add(new THREE.BoxGeometry(7, .5, 34), mat('#b98253'), -60, 1.4, CITY.z1 + 18); for (const z of [8, 20, 32]) for (const dx of [-3, 3]) add(new THREE.CylinderGeometry(.3, .3, 3, 6), mat('#8a5a34'), -60 + dx, .2, CITY.z1 + z, group, false);
  const boats = [[-82, 100, '#ef5a45'], [-40, 112, '#3f9fe0'], [96, 104, '#ffc93c'], [150, 118, '#58c7a0']].map(([x, z, color], i) => {
    const boat = new THREE.Group(); boat.position.set(x, .3, z); boat.rotation.y = i * 1.1; group.add(boat);
    add(new THREE.SphereGeometry(1, 12, 6), mat(color), 0, .3, 0, boat).scale.set(1.5, .6, 3.2); add(new THREE.CylinderGeometry(.07, .07, 5, 5), dark, 0, 2.8, 0, boat, false);
    const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, 5.2, 0, 0, 1.1, 2.6], 3)); sail.computeVertexNormals(); add(sail, new THREE.MeshStandardMaterial({ color: '#fff6da', side: THREE.DoubleSide }), 0, 0, 0, boat, false);
    return boat;
  });
  const wheel = new THREE.Group(), hub = CITY_GROUND + 15.5, cabins = [];
  wheel.position.set(WHEEL.x, hub, WHEEL.z); group.add(wheel);
  add(new THREE.TorusGeometry(12, .35, 8, 48), white, 0, 0, 0, wheel); add(new THREE.TorusGeometry(11, .2, 6, 48), red, 0, 0, 0, wheel, false);
  for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(.14, .14, 24, 5), white, 0, 0, 0, wheel, false).rotation.z = i / 8 * Math.PI;
  for (let i = 0; i < 10; i++) cabins.push(add(new THREE.SphereGeometry(1.3, 10, 8), mat(CARS[i % CARS.length]), 0, 0, 0, group));
  for (const side of [-1, 1]) for (const lean of [-1, 1]) add(new THREE.CylinderGeometry(.35, .5, 17.5, 6), white, WHEEL.x + lean * 3.6, CITY_GROUND + 7.8, WHEEL.z + side * 1.6).rotation.z = lean * .42;

  /* ---------- traffic: cars on every street and a few buses on the wide ones ---------- */
  const drivers = [];
  for (const r of ROADS_EW) for (const lane of [-1, 1]) for (let i = 0; i < (r.wide > 8 ? 4 : 2); i++) drivers.push({ along: 'x', fixed: r.at + lane * r.wide * .24, way: lane, at: CITY.x0 + rand() * W, speed: 7 + rand() * 6, bus: r.wide > 8 && i === 0 });
  for (const r of ROADS_NS) for (const lane of [-1, 1]) for (let i = 0; i < (r.wide > 8 ? 5 : 3); i++) drivers.push({ along: 'z', fixed: r.at + lane * r.wide * .24, way: -lane, at: CITY.z0 + rand() * D, speed: 7 + rand() * 6, bus: r.wide > 8 && i === 0, avenue: r.at === AVENUE });
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .45 }), drivers.length), cabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#cfe6f7', roughness: .25 }), drivers.length);
  drivers.forEach((d, i) => cars.setColorAt(i, paint.set(d.bus ? '#ffb000' : CARS[i % CARS.length]))); cars.castShadow = true; cars.frustumCulled = cabs.frustumCulled = false; group.add(cars, cabs);
  function drive(dt) {
    drivers.forEach((d, i) => {
      const x0 = CITY.x0 + 8, x1 = CITY.x1 - 8, z0 = CITY.z0 + 8, z1 = d.avenue ? 0 : 66;
      d.at += d.way * d.speed * dt;
      if (d.along === 'x') { if (d.at > x1) d.at = x0; else if (d.at < x0) d.at = x1; } else if (d.at > z1) d.at = z0; else if (d.at < z0) d.at = z1;
      const x = d.along === 'x' ? d.at : d.fixed, z = d.along === 'x' ? d.fixed : d.at, on = !(d.along === 'x' && d.fixed > AIRPORT.z0 && x > AIRPORT.x0 - 3 && x < AIRPORT.x1 + 3), long = d.bus ? 6 : 3, show = on ? 1 : 0;
      dummy.rotation.set(0, d.along === 'x' ? 0 : Math.PI / 2, 0); dummy.position.set(x, CITY_GROUND + (d.bus ? 1.15 : .7), z); dummy.scale.set(long * show, (d.bus ? 2 : 1.1) * show, 1.6 * show); dummy.updateMatrix(); cars.setMatrixAt(i, dummy.matrix);
      dummy.position.y = CITY_GROUND + (d.bus ? 1.55 : 1.35); dummy.scale.set(long * (d.bus ? .9 : .5) * show, (d.bus ? .8 : .6) * show, 1.45 * show); dummy.updateMatrix(); cabs.setMatrixAt(i, dummy.matrix);
    });
    dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); cars.instanceMatrix.needsUpdate = cabs.instanceMatrix.needsUpdate = true;
  }

  /* ---------- a blimp, circling high above downtown ---------- */
  const blimp = new THREE.Group(); group.add(blimp);
  const banner = canvasOf(512, 256, g => { g.fillStyle = '#ffd24a'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ef5a45'; g.fillRect(0, 96, 512, 64); g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; for (const x of [128, 384]) g.fillText('HELLO VIAAN', x, 144); });
  banner.wrapS = THREE.RepeatWrapping;
  add(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ map: banner, roughness: .5 }), 0, 0, 0, blimp, false).scale.set(4, 4, 11);
  add(new THREE.BoxGeometry(1.6, 1.2, 4), white, 0, -4.2, .5, blimp, false);
  for (const [w, h] of [[.3, 5.5], [5.5, .3]]) add(new THREE.BoxGeometry(w, h, 2.6), red, 0, 0, -9.6, blimp, false);

  drive(0);
  return {
    // Called every frame while the game is not paused.
    update(dt, clock) {
      if (reducedMotion) dt = 0;
      const turn = clock * .22; wheel.rotation.z = turn;
      cabins.forEach((cabin, i) => { const a = turn + i / cabins.length * Math.PI * 2; cabin.position.set(WHEEL.x + Math.cos(a) * 12, hub + Math.sin(a) * 12 - 1.5, WHEEL.z); });
      drive(dt);
      const a = clock * .05; blimp.position.set(-10 + Math.cos(a) * 80, 90 + Math.sin(clock * .5) * 1.2, -150 + Math.sin(a) * 90); blimp.rotation.y = -a;
      boats.forEach((boat, i) => { boat.position.y = .3 + Math.sin(clock + i) * .12; boat.rotation.z = Math.sin(clock * .7 + i) * .04; });
      jet.scale.y = 1 + Math.sin(clock * 5) * .18;
      blinkers.forEach((light, i) => light.visible = Math.sin(clock * 3 + i) > -.3);
    }
  };
}
