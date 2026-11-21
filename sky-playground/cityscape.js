// Draws Big City, built in code rather than in Blender: the ground with its street plan, a
// downtown of towers inside a ring of houses and shops, parks, the airport, a harbour, a
// Ferris wheel, traffic and a blimp. Where things stand comes from city.js; this file only draws.
//
// To keep a big city quick to draw, everything that stands still and shares a material is
// merged into one shape (`batch`), and everything repeated is drawn as instances.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { CITY, CITY_GROUND } from './airline.js?v=10';
import { cityPlan, TOWER, AVENUE, ROADS_NS, ROADS_EW, PARK, WHEEL } from './city.js?v=10';

const G = CITY_GROUND, W = CITY.x1 - CITY.x0, D = CITY.z1 - CITY.z0, AIRPORT = { x0: AVENUE - 16, x1: 64, z0: 2 };   // the apron: no streets cross it
const WALLS = ['#d9785a', '#5fa8e0', '#f1e3c6', '#a9dcc6', '#cdb7ee', '#f6f7f9'], ROOFS = ['#a8523c', '#3f6fa8', '#c9b58a', '#6fae93', '#9a80cf', '#b9c0c9'];
const HOUSES = ['#ffd9b8', '#ffe9a8', '#cfe8f7', '#d8f0c8', '#f4d0e0', '#ffffff'], HOUSE_ROOFS = ['#d9534f', '#c9703a', '#3f88c5', '#5fae4e', '#8e6fd1', '#7a5a4a'];
const CARS = ['#eb5a46', '#3f9fe0', '#ffffff', '#58c7a0', '#f2559c', '#8e6fd1', '#ff9f1c', '#2f3a4a', '#ffd400'];
const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const tile = (w, h, draw) => { const t = canvasOf(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...more });
const rounded = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const pane = (g, x, y, w, h, a = '#bfe3f7', b = '#5f97c9') => { const f = g.createLinearGradient(0, y, 0, y + h); f.addColorStop(0, a); f.addColorStop(1, b); g.fillStyle = f; g.fillRect(x, y, w, h); g.fillStyle = '#ffffff55'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * .45, y); g.lineTo(x, y + h * .6); g.fill(); };
// The city's outline, seen from above, as a shape. `grow` moves the edge out (or in).
function outline(grow = 0) {
  const s = new THREE.Shape(), x0 = CITY.x0 - grow, x1 = CITY.x1 + grow, y0 = -(CITY.z1 + grow), y1 = -(CITY.z0 - grow), r = CITY.corner + grow;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
// A box whose four walls repeat a tile `tileW` wide and `tileH` tall, starting from the ground, however big the box is.
function wallBox(w, h, d, tileW = 8, tileH = 8.4, shift = 0) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const face = Math.floor(i / 4); if (face === 2 || face === 3) uv.setXY(i, .01, .01); else uv.setXY(i, uv.getX(i) * (face < 2 ? d : w) / tileW + shift, uv.getY(i) * h / tileH); }
  return g;
}
// Paints every corner of a shape one colour, for shapes drawn with `vertexColors`.
function coloured(geometry, color) { const c = new THREE.Color(color), n = geometry.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); geometry.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geometry; }
const at = (geometry, x, y, z, turnY = 0) => { if (turnY) geometry.rotateY(turnY); geometry.translate(x, y, z); return geometry; };

/* ---------- building fronts: one tile is two bays wide and two floors tall ---------- */
function wallTile(style) {
  return tile(256, 256, g => {
    g.fillStyle = WALLS[style]; g.fillRect(0, 0, 256, 256);
    const cells = [[0, 0], [128, 0], [0, 128], [128, 128]];
    if (style === 0) {            // red brick, white window frames, a flower box here and there
      g.strokeStyle = '#c1654a'; g.lineWidth = 2; for (let y = 0; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); for (let x = (y / 16 % 2) * 16; x < 256; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
      cells.forEach(([x, y], i) => { g.fillStyle = '#fff8ea'; g.fillRect(x + 30, y + 22, 68, 84); pane(g, x + 36, y + 28, 56, 72); g.fillStyle = '#fff8ea'; g.fillRect(x + 62, y + 28, 4, 72); g.fillRect(x + 36, y + 62, 56, 4); g.fillRect(x + 24, y + 104, 80, 8); if (i % 3 === 0) { g.fillStyle = '#4caf50'; g.fillRect(x + 28, y + 96, 72, 9); g.fillStyle = '#ff5d8f'; for (let f = 0; f < 5; f++) { g.beginPath(); g.arc(x + 36 + f * 14, y + 95, 4, 0, 7); g.fill(); } } if (i === 1) { g.fillStyle = '#ffe9a8cc'; g.fillRect(x + 36, y + 28, 26, 34); } });
    } else if (style === 1) {     // a glass tower: blue panes between pale mullions
      for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) { pane(g, x, y, 64, 64, ['#8fd0f5', '#7cc4f0', '#a6dcf8'][(x / 64 + y / 32) % 3], '#3f86c9'); }
      g.fillStyle = '#e8f4fb'; for (let x = 0; x < 256; x += 64) g.fillRect(x - 2, 0, 5, 256); g.fillStyle = '#2f6aa8'; for (let y = 0; y < 256; y += 128) g.fillRect(0, y - 3, 256, 7);
    } else if (style === 2) {     // cream stone with deep square windows and a band at every floor
      g.fillStyle = '#e0cfa8'; for (const y of [0, 128]) g.fillRect(0, y + 112, 256, 16);
      cells.forEach(([x, y], i) => { g.fillStyle = '#c9b58a'; g.fillRect(x + 32, y + 22, 64, 76); pane(g, x + 38, y + 28, 52, 64, i % 2 ? '#bfe3f7' : '#ffe9a8', '#5f86b8'); g.fillStyle = '#fff7e6'; g.fillRect(x + 62, y + 28, 4, 64); g.fillRect(x + 28, y + 96, 72, 7); });
    } else if (style === 3) {     // mint art deco: tall arched windows between pilasters, a gold line at every floor
      g.fillStyle = '#8cc9b0'; for (const x of [0, 114, 128, 242]) g.fillRect(x, 0, 14, 256); g.fillStyle = '#e5c45a'; for (const y of [120, 248]) g.fillRect(0, y, 256, 5);
      cells.forEach(([x, y]) => { g.fillStyle = '#f4fbf7'; rounded(g, x + 42, y + 14, 44, 100, [22, 22, 0, 0]); g.fill(); g.save(); rounded(g, x + 47, y + 19, 34, 91, [17, 17, 0, 0]); g.clip(); pane(g, x + 47, y + 19, 34, 91); g.restore(); g.fillStyle = '#f4fbf7'; g.fillRect(x + 62, y + 19, 4, 91); });
    } else if (style === 4) {     // lilac flats with a balcony on every floor
      cells.forEach(([x, y], i) => { pane(g, x + 20, y + 26, 40, 62); pane(g, x + 70, y + 20, 38, 86, i % 2 ? '#ffe9a8' : '#bfe3f7'); g.fillStyle = '#f7f1ff'; g.fillRect(x + 16, y + 22, 48, 4); g.fillRect(x + 66, y + 16, 46, 4); g.fillStyle = '#9a80cf'; g.fillRect(x + 8, y + 106, 112, 8); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.strokeRect(x + 10, y + 84, 108, 22); for (let r = 0; r < 7; r++) { g.beginPath(); g.moveTo(x + 22 + r * 14, y + 84); g.lineTo(x + 22 + r * 14, y + 106); g.stroke(); } });
    } else {                      // white and modern: long ribbons of window
      for (const y of [0, 128]) { pane(g, 0, y + 34, 256, 52, '#9ad0f0', '#3f6fa8'); g.fillStyle = '#f6f7f9'; for (let x = 0; x < 256; x += 42.7) g.fillRect(x, y + 34, 4, 52); g.fillStyle = '#d5dae0'; g.fillRect(0, y + 118, 256, 6); }
    }
  });
}
// Street level under every tower: four little shops in a row.
const shopTile = () => tile(1024, 256, g => {
  const shops = [['🍞', '#f4a261', 'BAKERY'], ['🧸', '#9b6fd3', 'TOYS'], ['🍦', '#ef6f9f', 'ICE CREAM'], ['📚', '#4f86c6', 'BOOKS']];
  shops.forEach(([icon, color, name], i) => {
    const x = i * 256; g.fillStyle = '#fff6e6'; g.fillRect(x, 0, 256, 256);
    g.fillStyle = color; g.fillRect(x, 0, 256, 60); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, x + 128, 32);
    for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#fff' : color; g.beginPath(); g.moveTo(x + s * 32, 60); g.lineTo(x + s * 32 + 32, 60); g.lineTo(x + s * 32 + 26, 96); g.lineTo(x + s * 32 + 6, 96); g.fill(); }
    pane(g, x + 20, 112, 140, 110); g.strokeStyle = '#fff6e6'; g.lineWidth = 6; g.strokeRect(x + 20, 112, 140, 110); g.font = '76px serif'; g.fillText(icon, x + 90, 172);
    g.fillStyle = color; rounded(g, x + 178, 112, 60, 144, [10, 10, 0, 0]); g.fill(); pane(g, x + 188, 122, 40, 60); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + 226, 196, 5, 0, 7); g.fill();
    g.fillStyle = '#00000018'; g.fillRect(x, 238, 256, 18);
  });
});
// A house front, drawn pale so each house can be tinted its own colour: a door, two windows and a doorstep.
const houseTile = () => canvasOf(256, 256, g => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#00000012'; g.fillRect(0, 228, 256, 28);
  for (const x of [26, 166]) { g.fillStyle = '#fffdf6'; g.fillRect(x - 6, 60, 76, 92); pane(g, x, 66, 64, 80, '#9fd3f5', '#4f86c6'); g.fillStyle = '#fffdf6'; g.fillRect(x + 30, 66, 4, 80); g.fillRect(x, 104, 64, 4); g.fillStyle = '#6aa85a'; g.fillRect(x - 6, 150, 76, 10); }
  g.fillStyle = '#8a5a34'; rounded(g, 104, 96, 48, 132, [24, 24, 0, 0]); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(142, 168, 5, 0, 7); g.fill(); g.fillStyle = '#d9c7a8'; g.fillRect(96, 226, 64, 10);
});
// A corner shop's front: an awning over a big window and a door.
const cornerShopTile = () => canvasOf(256, 256, g => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  for (const x of [34, 150]) { pane(g, x, 26, 72, 58, '#9fd3f5', '#4f86c6'); g.strokeStyle = '#fffdf6'; g.lineWidth = 6; g.strokeRect(x, 26, 72, 58); }
  for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#fff' : '#ef5a45'; g.fillRect(s * 32, 112, 32, 34); } g.fillStyle = '#00000022'; g.fillRect(0, 146, 256, 5);
  pane(g, 22, 160, 130, 78); g.strokeStyle = '#fffdf6'; g.lineWidth = 6; g.strokeRect(22, 160, 130, 78); g.fillStyle = '#8a5a34'; g.fillRect(176, 156, 52, 100); pane(g, 184, 164, 36, 44); g.fillStyle = '#00000012'; g.fillRect(0, 244, 256, 12);
});

export function createCity({ scene, airport, reducedMotion }) {
  const { towers, houses, parks } = cityPlan(), group = new THREE.Group(), rand = (() => { let n = 2024; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  group.position.set(airport.x, 0, airport.z); scene.add(group);
  const add = (geometry, material, x, y, z, parent = group, shadow = true) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const inAirport = (x, z) => x > AIRPORT.x0 && x < AIRPORT.x1 && z > AIRPORT.z0, dummy = new THREE.Object3D(), paint = new THREE.Color();
  const white = mat('#fbfaf5'), dark = mat('#4a5360'), green = mat('#6fbf63'), leaf = mat('#3f9e55'), leaf2 = mat('#63c26b'), red = mat('#ef5a45'), wood = mat('#b98253'), glass = mat('#9fd3f5', { roughness: .2, metalness: .1 }), steel = mat('#c9d1d9', { roughness: .4, metalness: .3 }), gold = mat('#ffc928', { roughness: .4 });
  // Everything that stands still: shapes are collected by material and merged into one drawing each.
  const lists = new Map(), batch = (material, geometry, x = 0, y = 0, z = 0, turn = 0) => { at(geometry, x, y, z, turn); if (!lists.has(material)) lists.set(material, []); lists.get(material).push(geometry); };
  // Many copies of one shape. `place(i)` sets `dummy` for copy i and may return a colour for it.
  const copies = (geometry, material, count, place, shadow = true) => { const m = new THREE.InstancedMesh(geometry, material, count); for (let i = 0; i < count; i++) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); const color = place(i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (color) m.setColorAt(i, paint.set(color)); } m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; group.add(m); return m; };

  /* ---------- ground: a sandy slab with the street plan painted on top ---------- */
  const slab = add(new THREE.ExtrudeGeometry(outline(3), { depth: G, bevelEnabled: false, curveSegments: 10 }), mat('#ecdcb4'), 0, 0, 0); slab.rotation.x = -Math.PI / 2;
  const SX = 1536, SZ = Math.round(SX * D / W), kx = SX / W, kz = SZ / D, px = x => (x - CITY.x0) * kx, pz = z => (z - CITY.z0) * kz;
  const plan = canvasOf(SX, SZ, g => {
    const rect = (x0, z0, x1, z1, color, round = 0) => { g.fillStyle = color; rounded(g, px(x0), pz(z0), (x1 - x0) * kx, (z1 - z0) * kz, round); g.fill(); };
    const ends = r => r.at === AVENUE ? 4 : 68, crosses = (r, x) => r.at > AIRPORT.z0 && x > AIRPORT.x0 - 2 && x < AIRPORT.x1 + 2;
    rect(CITY.x0, CITY.z0, CITY.x1, CITY.z1, '#9ad68a');                                       // grass to the edge
    rect(CITY.x0 + 9, CITY.z0 + 9, CITY.x1 - 9, CITY.z1 - 7, '#e3ddd0', 130);                  // pavement
    g.strokeStyle = '#d6cfc0'; g.lineWidth = 1; for (let x = CITY.x0 + 9; x < CITY.x1 - 9; x += 3) { g.beginPath(); g.moveTo(px(x), pz(CITY.z0 + 9)); g.lineTo(px(x), pz(CITY.z1 - 7)); g.stroke(); } for (let z = CITY.z0 + 9; z < CITY.z1 - 7; z += 3) { g.beginPath(); g.moveTo(px(CITY.x0 + 9), pz(z)); g.lineTo(px(CITY.x1 - 9), pz(z)); g.stroke(); }   // paving slabs
    rect(CITY.x0 + 9, 66, CITY.x1 - 9, CITY.z1 - 4, '#d9b98a', 30); g.strokeStyle = '#c4a476'; g.lineWidth = 2; for (let x = CITY.x0 + 12; x < CITY.x1 - 12; x += 2.4) { g.beginPath(); g.moveTo(px(x), pz(66)); g.lineTo(px(x), pz(CITY.z1 - 4)); g.stroke(); }   // the boardwalk's planks
    // Streets: a kerb, the tarmac, then lines.
    const road = (grow, color) => { for (const r of ROADS_NS) rect(r.at - r.wide / 2 - grow, CITY.z0 + 6, r.at + r.wide / 2 + grow, ends(r), color); for (const r of ROADS_EW) { if (r.at > AIRPORT.z0) { rect(CITY.x0 + 6, r.at - r.wide / 2 - grow, AIRPORT.x0, r.at + r.wide / 2 + grow, color); rect(AIRPORT.x1, r.at - r.wide / 2 - grow, CITY.x1 - 6, r.at + r.wide / 2 + grow, color); } else rect(CITY.x0 + 6, r.at - r.wide / 2 - grow, CITY.x1 - 6, r.at + r.wide / 2 + grow, color); } };
    road(.9, '#b9b2a4'); road(0, '#565e69');
    for (const r of ROADS_NS) { const wide = r.wide > 8; g.fillStyle = wide ? '#ffd23f' : '#f4f1e6'; for (let z = CITY.z0 + 10; z < ends(r) - 4; z += wide ? 3 : 7) g.fillRect(px(r.at) - (wide ? 3.5 : 1.5), pz(z), wide ? 2.5 : 3, (wide ? 3 : 3.4) * kz); if (wide) { for (let z = CITY.z0 + 10; z < ends(r) - 4; z += 3) g.fillRect(px(r.at) + 1, pz(z), 2.5, 3 * kz); g.fillStyle = '#f4f1e6'; for (const side of [-1, 1]) for (let z = CITY.z0 + 10; z < ends(r) - 4; z += 8) g.fillRect(px(r.at + side * r.wide * .26) - 1, pz(z), 2, 4 * kz); } }
    for (const r of ROADS_EW) { const wide = r.wide > 8; for (let x = CITY.x0 + 10; x < CITY.x1 - 10; x += wide ? 3 : 7) { if (crosses(r, x)) continue; g.fillStyle = wide ? '#ffd23f' : '#f4f1e6'; g.fillRect(px(x), pz(r.at) - (wide ? 3.5 : 1.5), (wide ? 3 : 3.4) * kx, wide ? 2.5 : 3); if (wide) g.fillRect(px(x), pz(r.at) + 1, 3 * kx, 2.5); } }
    // Where streets meet: clean tarmac, then zebra crossings on every side.
    for (const a of ROADS_NS) for (const b of ROADS_EW) { if (b.at > ends(a) || crosses(b, a.at)) continue; rect(a.at - a.wide / 2, b.at - b.wide / 2, a.at + a.wide / 2, b.at + b.wide / 2, '#565e69'); g.fillStyle = '#f4f1e6'; const n = Math.floor(a.wide / 1.5), m = Math.floor(b.wide / 1.5);
      for (const side of [-1, 1]) { for (let i = 0; i < n; i++) g.fillRect(px(a.at - a.wide / 2 + .4 + i * 1.5), pz(b.at + side * (b.wide / 2 + 1.7)) - 5, .8 * kx, 10); for (let i = 0; i < m; i++) g.fillRect(px(a.at + side * (a.wide / 2 + 1.7)) - 5, pz(b.at - b.wide / 2 + .4 + i * 1.5), 10, .8 * kz); } }
    // Building lots, little parks, Central Park with its paths and pond, and the airport's apron.
    for (const b of towers) rect(b.x - airport.x - 8.5, b.z - airport.z - 8.5, b.x - airport.x + 8.5, b.z - airport.z + 8.5, '#f3eee2', 14);
    for (const b of houses) { rect(b.x - airport.x - 8.5, b.z - airport.z - 8.5, b.x - airport.x + 8.5, b.z - airport.z + 8.5, '#a6dd92', 14); rect(b.x - airport.x - 1.2, b.z - airport.z, b.x - airport.x + 1.2, b.z - airport.z + 8.5, '#e3ddd0'); }
    for (const p of parks) { const x = p.x - airport.x, z = p.z - airport.z; rect(x - 9, z - 9, x + 9, z + 9, '#8fce7e', 18); g.fillStyle = '#e9e1cf'; g.beginPath(); g.arc(px(x), pz(z), 2.6 * kx, 0, 7); g.fill(); for (let f = 0; f < 8; f++) { g.fillStyle = ['#ff5d8f', '#ffd23f', '#ffffff', '#ff8a3d'][f % 4]; g.beginPath(); g.arc(px(x + Math.cos(f) * 5.6), pz(z + Math.sin(f) * 5.6), 4, 0, 7); g.fill(); } }
    rect(PARK.x - PARK.half - 8, PARK.z - PARK.half - 8, PARK.x + PARK.half + 8, PARK.z + PARK.half + 8, '#7fcf70', 40);
    g.strokeStyle = '#e9e1cf'; g.lineWidth = 9; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 21 * kx, 21 * kz, 0, 0, 7); g.stroke(); for (const a of [0, 1.57, 3.14, 4.71]) { g.beginPath(); g.moveTo(px(PARK.x + Math.cos(a) * 10), pz(PARK.z + Math.sin(a) * 8)); g.lineTo(px(PARK.x + Math.cos(a) * 30), pz(PARK.z + Math.sin(a) * 30)); g.stroke(); }
    g.fillStyle = '#5fbfe6'; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 9 * kx, 7 * kz, 0, 0, 7); g.fill(); g.strokeStyle = '#bfeaff'; g.lineWidth = 3; g.beginPath(); g.ellipse(px(PARK.x), pz(PARK.z), 5 * kx, 4 * kz, 0, 0, 7); g.stroke();
    for (let f = 0; f < 40; f++) { g.fillStyle = ['#ff5d8f', '#ffd23f', '#ffffff', '#b06bff'][f % 4]; const a = f * 2.4, r = 24 + (f % 5) * 1.2; g.beginPath(); g.arc(px(PARK.x + Math.cos(a) * r), pz(PARK.z + Math.sin(a) * r), 3.5, 0, 7); g.fill(); }
    rect(AIRPORT.x0, AIRPORT.z0, AIRPORT.x1, 70, '#cfd4da', 26); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.moveTo(px(AVENUE + 6), pz(30)); g.lineTo(px(48), pz(30)); g.lineTo(px(48), pz(14)); g.stroke(); for (const z of [12, 22]) { g.strokeRect(px(44), pz(z), 16 * kx, 9 * kz); }
  });
  const top = add(new THREE.ShapeGeometry(outline(-1.5), 10), new THREE.MeshStandardMaterial({ map: plan, roughness: .95 }), 0, G + .02, 0, group, false);
  const uv = top.geometry.attributes.uv, spot = top.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (spot.getX(i) - CITY.x0) / W, 1 - (-spot.getY(i) - CITY.z0) / D);
  top.rotation.x = -Math.PI / 2;

  /* ---------- the airport: runway, terminal, control tower and two parked planes ---------- */
  const strip = canvasOf(64, 512, g => { g.fillStyle = '#4b525c'; g.fillRect(0, 0, 64, 512); g.fillStyle = '#fff'; for (let y = 60; y < 450; y += 44) g.fillRect(29, y, 6, 24); for (const y of [10, 474]) for (let x = 6; x < 60; x += 10) g.fillRect(x, y, 5, 28); });
  const runway = add(new THREE.PlaneGeometry(10, 48), new THREE.MeshStandardMaterial({ map: strip, roughness: .9 }), AVENUE, G + .06, 38, group, false); runway.rotation.x = -Math.PI / 2;
  const terminal = new THREE.MeshStandardMaterial({ roughness: .6, map: tile(256, 128, g => { g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 256, 128); pane(g, 8, 30, 240, 62, '#9fd3f5', '#4f86c6'); g.fillStyle = '#fbfaf5'; for (let x = 8; x < 256; x += 40) g.fillRect(x - 2, 30, 4, 62); g.fillStyle = '#ef5a45'; g.fillRect(0, 0, 256, 14); }) });
  batch(terminal, wallBox(13, 5.4, 10, 13, 5.4), 40, G + 2.7, 43); batch(red, new THREE.BoxGeometry(13.8, .5, 10.8), 40, G + 5.6, 43);
  batch(white, new THREE.CylinderGeometry(1.1, 1.4, 8, 12), 56, G + 4, 60); batch(glass, new THREE.CylinderGeometry(2.1, 1.7, 1.8, 12), 56, G + 8.9, 60); batch(red, new THREE.ConeGeometry(2.3, 1, 12), 56, G + 10.3, 60);
  for (const [x, z, color] of [[52, 16, '#3f9fe0'], [52, 26, '#ffc93c']]) { const body = mat(color, { roughness: .4 }); batch(body, new THREE.CapsuleGeometry(.7, 3.4, 4, 10).rotateZ(Math.PI / 2), x, G + 1.3, z); batch(white, new THREE.BoxGeometry(1.2, .14, 6.4), x - .3, G + 1.2, z); batch(body, new THREE.BoxGeometry(.9, 1.3, .14), x + 2, G + 2, z); batch(white, new THREE.BoxGeometry(.7, .12, 2.4), x + 2, G + 1.5, z); }

  /* ---------- downtown: every tower has shops at street level, a patterned front and a busy roof ---------- */
  const walls = WALLS.map((_, i) => new THREE.MeshStandardMaterial({ map: wallTile(i), roughness: i === 1 || i === 5 ? .3 : .7, metalness: i === 1 ? .25 : .04 })), roofs = ROOFS.map(c => mat(c)), shops = new THREE.MeshStandardMaterial({ map: shopTile(), roughness: .6 });
  const tallest = towers.reduce((a, b) => b.top > a.top ? b : a, towers[0]), blinkers = [], SIGNS = [['VIAAN AIR', '✈️', '#3f9fe0'], ['TOY SHOP', '🧸', '#9b6fd3'], ['ICE CREAM', '🍦', '#ef6f9f'], ['THE ZOO', '🦁', '#5fae4e']];
  let signs = 0;
  towers.forEach((t, n) => {
    const x = t.x - airport.x, z = t.z - airport.z, wide = TOWER * 2, body = t.top - G - 4.4, wall = walls[t.style], roof = roofs[t.style];
    batch(shops, wallBox(wide + .8, 4.4, wide + .8, 23.6, 4.4, (n % 4) * .25), x, G + 2.2, z); batch(roof, new THREE.BoxGeometry(wide + 1.7, .4, wide + 1.7), x, G + 4.5, z);
    // Tall towers step in as they rise; others are one block, or a block with a narrower top.
    const steps = t.top > 55 ? [[1, .54], [.78, .29], [.56, .17]] : n % 3 === 0 ? [[1, .68], [.72, .32]] : [[1, 1]];
    let y = G + 4.7, k = 1;
    // Each face shows whole windows: the tile is stretched a little so bays and floors fit exactly.
    for (const [part, share] of steps) { const h = body * share; k = part; const across = wide * k; batch(wall, wallBox(across, h, across, 2 * across / Math.max(1, Math.round(across / 4)), 2 * h / Math.max(1, Math.round(h / 4.2))), x, y + h / 2, z); batch(roof, new THREE.BoxGeometry(wide * k + .7, .5, wide * k + .7), x, y + h, z); y += h; }
    const w = wide * k, edge = w / 2 - 1;
    if (t === tallest) {         // the clock tower: four faces, a pointed roof and a light on top
      const face = new THREE.MeshStandardMaterial({ roughness: .5, map: canvasOf(128, 128, g => { g.fillStyle = WALLS[t.style]; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.strokeStyle = '#2a1f3d'; g.lineWidth = 6; g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42); g.lineTo(64 + Math.cos(a) * 49, 64 + Math.sin(a) * 49); g.stroke(); } g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 28); g.stroke(); g.beginPath(); g.moveTo(64, 64); g.lineTo(88, 74); g.stroke(); }) });
      batch(face, new THREE.BoxGeometry(w * .9, w * .9, w * .9), x, y + w * .45, z); batch(roofs[t.style], new THREE.ConeGeometry(w * .72, 7, 4).rotateY(Math.PI / 4), x, y + w * .9 + 3.5, z); blinkers.push(add(new THREE.SphereGeometry(.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a3d' }), x, y + w * .9 + 7.6, z, group, false));
    } else if (t.top > 55) { batch(steel, new THREE.CylinderGeometry(.12, .3, 10, 6), x, y + 5, z); batch(steel, new THREE.CylinderGeometry(1.4, 1.8, 1.4, 10), x, y + .7, z); blinkers.push(add(new THREE.SphereGeometry(.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a3d' }), x, y + 10.3, z, group, false)); }
    else if (n % 5 === 0) { batch(wood, new THREE.CylinderGeometry(1.5, 1.5, 2.4, 12), x + edge - 1, y + 2.1, z - edge + 1); batch(dark, new THREE.ConeGeometry(1.8, 1.1, 12), x + edge - 1, y + 3.8, z - edge + 1); for (const [dx, dz] of [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]]) batch(dark, new THREE.CylinderGeometry(.09, .09, 1, 5), x + edge - 1 + dx, y + .5, z - edge + 1 + dz); batch(steel, new THREE.BoxGeometry(2, 1.1, 1.6), x - edge + 1.4, y + .55, z + edge - 1.2); }   // a water tank and a vent
    else if (n % 5 === 1) { batch(green, new THREE.BoxGeometry(w - 1.6, .4, w - 1.6), x, y + .3, z); for (const [dx, dz, s] of [[-edge + .6, -edge + .6, 1.2], [edge - .8, edge - 1, 1], [-edge + 1, edge - .8, .8], [.6, -.4, .9]]) batch(s > .95 ? leaf : leaf2, new THREE.SphereGeometry(s, 8, 6), x + dx, y + .5 + s * .8, z + dz); batch(red, new THREE.ConeGeometry(1.5, .9, 8), x + edge - 1.6, y + 2.6, z - edge + 1.6); batch(white, new THREE.CylinderGeometry(.06, .06, 2.2, 5), x + edge - 1.6, y + 1.1, z - edge + 1.6); }   // a roof garden with a parasol
    else if (n % 5 === 2) { for (const [dx, dz] of [[-edge + 1.2, -edge + 1], [-edge + 1.2, 1], [edge - 1.4, -edge + 1.2]]) { batch(steel, new THREE.BoxGeometry(2, 1.2, 1.7), x + dx, y + .6, z + dz); batch(dark, new THREE.CylinderGeometry(.55, .55, .12, 10), x + dx, y + 1.25, z + dz); } batch(steel, new THREE.CylinderGeometry(.07, .07, 5, 5), x + edge - 1, y + 2.5, z + edge - 1); batch(white, new THREE.SphereGeometry(.8, 10, 6, 0, 7, 0, 1.5).rotateX(2.2), x, y + 1.1, z + edge - 1.2); }   // air units, an aerial and a dish
    else if (n % 5 === 3 && signs < SIGNS.length) {        // a rooftop sign
      const [name, icon, color] = SIGNS[signs++], board = new THREE.MeshStandardMaterial({ roughness: .5, map: canvasOf(512, 256, g => { g.fillStyle = '#fffdf2'; g.fillRect(0, 0, 512, 256); g.fillStyle = color; g.fillRect(12, 12, 488, 232); g.fillStyle = '#fff'; g.font = 'bold 76px sans-serif'; g.textAlign = 'center'; g.fillText(name, 256, 108); g.font = '90px serif'; g.fillText(icon, 256, 212); }) });
      batch(board, new THREE.BoxGeometry(w - .6, (w - .6) / 2, .3), x, y + 1.4 + (w - .6) / 4, z); for (const dx of [-w / 3, w / 3]) batch(dark, new THREE.CylinderGeometry(.12, .12, 1.4, 6), x + dx, y + .7, z);
    } else { const pad = new THREE.MeshStandardMaterial({ roughness: .9, map: canvasOf(128, 128, g => { g.fillStyle = ROOFS[t.style]; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffd84a'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.fillText('H', 64, 86); }) }); batch(pad, new THREE.CylinderGeometry(w * .38, w * .38, .2, 20), x, y + .36, z); }   // a helipad
  });

  /* ---------- the ring round downtown: cottages with gable roofs and chimneys, and corner shops ---------- */
  const cottages = houses.filter((h, i) => i % 3 !== 2), corner = houses.filter((h, i) => i % 3 === 2), turn = h => (Math.round(h.x + h.z) % 2 ? Math.PI / 2 : 0);
  const prism = new THREE.CylinderGeometry(2 / 3, 2 / 3, 1, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 1 / 3, 0).scale(1, 1, 1 / 1.1547).toNonIndexed(); prism.computeVertexNormals();   // a roof with flat faces: one long, one wide, one tall
  const front = new THREE.MeshStandardMaterial({ map: houseTile(), roughness: .8 }), shopFront = new THREE.MeshStandardMaterial({ map: cornerShopTile(), roughness: .75 }), plain = () => new THREE.MeshStandardMaterial({ roughness: .8 });
  const local = h => [h.x - airport.x, h.z - airport.z, h.top - G];
  copies(new THREE.BoxGeometry(1, 1, 1), front, cottages.length, i => { const [x, z, tall] = local(cottages[i]); dummy.position.set(x, G + (tall - 2.8) / 2, z); dummy.rotation.y = turn(cottages[i]); dummy.scale.set(9.4, tall - 2.8, 8); return HOUSES[cottages[i].style]; });
  copies(prism, plain(), cottages.length, i => { const [x, z, tall] = local(cottages[i]); dummy.position.set(x, G + tall - 2.8, z); dummy.rotation.y = turn(cottages[i]); dummy.scale.set(10.2, 2.8, 9); return HOUSE_ROOFS[(cottages[i].style + i) % HOUSE_ROOFS.length]; });
  copies(new THREE.BoxGeometry(1, 2.6, 1), mat('#b5654d'), cottages.length, i => { const [x, z, tall] = local(cottages[i]), a = turn(cottages[i]); dummy.position.set(x + Math.cos(a) * 2.6, G + tall - 1.2, z - Math.sin(a) * 2.6 + 1.2); });
  copies(new THREE.SphereGeometry(1, 8, 6), leaf2, cottages.length * 2, i => { const [x, z] = local(cottages[i >> 1]); dummy.position.set(x + (i % 2 ? 6.2 : -6.4), G + .7, z + (i % 2 ? 5.6 : 6.2)); dummy.scale.set(1.3, .9, 1.1); }, false);
  copies(new THREE.BoxGeometry(1, 1, 1), shopFront, corner.length, i => { const [x, z, tall] = local(corner[i]); dummy.position.set(x, G + (tall - .5) / 2, z); dummy.rotation.y = turn(corner[i]); dummy.scale.set(9.6, tall - .5, 9.6); return HOUSES[corner[i].style]; });
  copies(new THREE.BoxGeometry(1, 1, 1), plain(), corner.length, i => { const [x, z, tall] = local(corner[i]); dummy.position.set(x, G + tall - .25, z); dummy.scale.set(10.4, .5, 10.4); return HOUSE_ROOFS[(corner[i].style + i) % HOUSE_ROOFS.length]; });
  copies(new THREE.BoxGeometry(2, 1.1, 1.6), steel, corner.length, i => { const [x, z, tall] = local(corner[i]); dummy.position.set(x + 2, G + tall + .55, z - 2); });

  /* ---------- trees, street lamps, traffic lights and park benches ---------- */
  const spots = [], wide = { ns: ROADS_NS.filter(r => r.wide > 8), ew: ROADS_EW.filter(r => r.wide > 8) };
  for (const p of parks) { const x = p.x - airport.x, z = p.z - airport.z; if (Math.abs(x - PARK.x) < PARK.half + 4 && Math.abs(z - PARK.z) < PARK.half + 4) continue; for (const [dx, dz] of [[-5.5, -5.5], [5.5, -5], [-5, 5.5], [5.6, 5.6]]) spots.push([x + dx, z + dz, 1.3 + rand() * .7]); }
  for (let i = 0; i < 30; i++) { const a = rand() * Math.PI * 2, r = 12 + rand() * 17; spots.push([PARK.x + Math.cos(a) * r, PARK.z + Math.sin(a) * r, 1.2 + rand() * 1]); }
  for (const r of wide.ns) for (let z = CITY.z0 + 16; z < (r.at === AVENUE ? -4 : 60); z += 12) for (const side of [-1, 1]) spots.push([r.at + side * (r.wide / 2 + 2), z, .9]);
  for (const r of wide.ew) for (let x = CITY.x0 + 16; x < CITY.x1 - 16; x += 12) for (const side of [-1, 1]) spots.push([x, r.at + side * (r.wide / 2 + 2), .9]);
  for (let x = CITY.x0 + 30; x < CITY.x1 - 30; x += 13) if (Math.abs(x - AVENUE) > 26) spots.push([x, 71, 1.1]);     // trees along the boardwalk
  const offRoad = (x, z, gap = 1) => !inAirport(x, z) && Math.hypot(x - WHEEL.x, z - WHEEL.z) > 15 && ROADS_NS.every(r => Math.abs(x - r.at) > r.wide / 2 + gap) && ROADS_EW.every(r => Math.abs(z - r.at) > r.wide / 2 + gap);
  const trees = spots.filter(([x, z]) => offRoad(x, z));
  copies(new THREE.CylinderGeometry(.22, .32, 1.8, 6), mat('#8a5a34'), trees.length, i => { const [x, z, s] = trees[i]; dummy.position.set(x, G + .9 * s, z); dummy.scale.setScalar(s); });
  copies(new THREE.IcosahedronGeometry(1.5, 1), leaf, trees.length, i => { const [x, z, s] = trees[i]; dummy.position.set(x, G + 2.6 * s, z); dummy.scale.setScalar(s); });
  copies(new THREE.IcosahedronGeometry(1, 1), leaf2, trees.length, i => { const [x, z, s] = trees[i]; dummy.position.set(x + .6 * s, G + 3.7 * s, z + .3 * s); dummy.scale.setScalar(s); });
  const lamps = [];
  for (const r of wide.ns) for (let z = CITY.z0 + 22; z < (r.at === AVENUE ? -4 : 60); z += 24) for (const side of [-1, 1]) lamps.push([r.at + side * (r.wide / 2 + 2), z + (side > 0 ? 0 : 12), side, 0]);
  for (const r of wide.ew) for (let x = CITY.x0 + 22; x < CITY.x1 - 22; x += 24) for (const side of [-1, 1]) lamps.push([x + (side > 0 ? 0 : 12), r.at + side * (r.wide / 2 + 2), 0, side]);
  const lit = lamps.filter(([x, z]) => offRoad(x, z, .6));
  copies(new THREE.CylinderGeometry(.1, .14, 5.2, 6), dark, lit.length, i => { dummy.position.set(lit[i][0], G + 2.6, lit[i][1]); });
  copies(new THREE.BoxGeometry(1.6, .12, .12), dark, lit.length, i => { const [x, z, sx, sz] = lit[i]; dummy.position.set(x - sx * .7, G + 5.1, z - sz * .7); dummy.rotation.y = sz ? Math.PI / 2 : 0; }, false);
  copies(new THREE.SphereGeometry(.36, 8, 6), mat('#fff3c4', { emissive: '#ffe08a', emissiveIntensity: .6 }), lit.length, i => { const [x, z, sx, sz] = lit[i]; dummy.position.set(x - sx * 1.4, G + 4.9, z - sz * 1.4); }, false);
  // Traffic lights at the big crossings: a pole with red, amber and green.
  const signal = mergeGeometries([coloured(new THREE.CylinderGeometry(.1, .12, 4.4, 6).translate(0, 2.2, 0), '#4a5360'), coloured(new THREE.BoxGeometry(.6, 1.7, .5).translate(0, 4.6, 0), '#2a2f38'), ...[['#ff4a3d', 5.1], ['#ffc93c', 4.6], ['#58d66b', 4.1]].flatMap(([c, y]) => [coloured(new THREE.SphereGeometry(.2, 8, 6).translate(0, y, .26), c), coloured(new THREE.SphereGeometry(.2, 8, 6).translate(0, y, -.26), c)])]);
  const corners = []; for (const a of wide.ns) for (const b of wide.ew) { if (b.at > (a.at === AVENUE ? 4 : 68)) continue; for (const sx of [-1, 1]) for (const sz of [-1, 1]) corners.push([a.at + sx * (a.wide / 2 + 1.2), b.at + sz * (b.wide / 2 + 1.2), sx * sz > 0 ? 0 : Math.PI / 2]); }
  copies(signal, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }), corners.length, i => { dummy.position.set(corners[i][0], G, corners[i][1]); dummy.rotation.y = corners[i][2]; });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .4; batch(wood, new THREE.BoxGeometry(2.2, .2, .7), PARK.x + Math.cos(a) * 18.5, G + .6, PARK.z + Math.sin(a) * 18.5, -a + Math.PI / 2); batch(dark, new THREE.BoxGeometry(2.2, .5, .12), PARK.x + Math.cos(a) * 18.9, G + .95, PARK.z + Math.sin(a) * 18.9, -a + Math.PI / 2); }
  // A bandstand in the park.
  batch(white, new THREE.CylinderGeometry(3.2, 3.4, .6, 8), PARK.x - 14, G + .3, PARK.z + 14); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; batch(white, new THREE.CylinderGeometry(.1, .1, 2.8, 5), PARK.x - 14 + Math.cos(a) * 2.8, G + 2, PARK.z + 14 + Math.sin(a) * 2.8); } batch(red, new THREE.ConeGeometry(3.8, 1.8, 8), PARK.x - 14, G + 4.3, PARK.z + 14);
  batch(white, new THREE.CylinderGeometry(2.6, 2.8, .6, 20), PARK.x, G + .3, PARK.z); batch(white, new THREE.CylinderGeometry(.5, .7, 1.4, 10), PARK.x, G + 1.2, PARK.z);
  const jet = add(new THREE.ConeGeometry(.6, 3, 10), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: .8 }), PARK.x, G + 3.2, PARK.z, group, false);

  /* ---------- the harbour: a pier, boats, and the Ferris wheel ---------- */
  batch(wood, new THREE.BoxGeometry(7, .5, 34), -60, 1.4, CITY.z1 + 18); for (const z of [8, 20, 32]) for (const dx of [-3, 3]) batch(mat('#8a5a34'), new THREE.CylinderGeometry(.3, .3, 3, 6), -60 + dx, .2, CITY.z1 + z);
  for (let i = 0; i < 9; i++) { batch(white, new THREE.CylinderGeometry(.09, .09, 1.3, 5), -63.3, 2.3, CITY.z1 + 3 + i * 3.8); batch(white, new THREE.CylinderGeometry(.09, .09, 1.3, 5), -56.7, 2.3, CITY.z1 + 3 + i * 3.8); }
  const boats = [[-82, 100, '#ef5a45'], [-40, 112, '#3f9fe0'], [96, 104, '#ffc93c'], [150, 118, '#58c7a0']].map(([x, z, color], i) => {
    const boat = new THREE.Group(); boat.position.set(x, .3, z); boat.rotation.y = i * 1.1; group.add(boat);
    add(new THREE.SphereGeometry(1, 12, 6), mat(color), 0, .3, 0, boat).scale.set(1.5, .6, 3.2); add(new THREE.BoxGeometry(1.4, .7, 1.6), white, 0, .9, .6, boat, false); add(new THREE.CylinderGeometry(.07, .07, 5, 5), dark, 0, 2.8, -.4, boat, false);
    const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -.4, 0, 5.2, -.4, 0, 1.1, -3], 3)); sail.computeVertexNormals(); add(sail, new THREE.MeshStandardMaterial({ color: '#fff6da', side: THREE.DoubleSide }), 0, 0, 0, boat, false);
    return boat;
  });
  const wheel = new THREE.Group(), hub = G + 15.5, cabins = [];
  wheel.position.set(WHEEL.x, hub, WHEEL.z); group.add(wheel);
  add(new THREE.TorusGeometry(12, .35, 8, 48), white, 0, 0, 0, wheel); add(new THREE.TorusGeometry(11, .2, 6, 48), red, 0, 0, 0, wheel, false); add(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 12).rotateX(Math.PI / 2), gold, 0, 0, 0, wheel, false);
  for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(.14, .14, 24, 5), white, 0, 0, 0, wheel, false).rotation.z = i / 8 * Math.PI;
  for (let i = 0; i < 10; i++) { const cabin = add(new THREE.BoxGeometry(2.2, 1.9, 1.8), mat(CARS[i % CARS.length]), 0, 0, 0, group); add(new THREE.BoxGeometry(2.3, .8, 1.5), glass, 0, .25, 0, cabin, false); add(new THREE.ConeGeometry(1.7, .7, 4).rotateY(Math.PI / 4), white, 0, 1.3, 0, cabin, false); cabins.push(cabin); }
  for (const side of [-1, 1]) for (const lean of [-1, 1]) add(new THREE.CylinderGeometry(.35, .5, 17.5, 6), white, WHEEL.x + lean * 3.6, G + 7.8, WHEEL.z + side * 1.6).rotation.z = lean * .42;
  batch(red, new THREE.BoxGeometry(9, 1.4, 5), WHEEL.x, G + .7, WHEEL.z);

  for (const [material, list] of lists) { const m = new THREE.Mesh(mergeGeometries(list), material); m.castShadow = m.receiveShadow = true; group.add(m); list.forEach(g => g.dispose()); }

  /* ---------- traffic: cars with wheels, windows and lights, and buses on the wide streets ---------- */
  // Each vehicle is two shapes: the paintwork (tinted per car) and the trim (wheels, glass, lights), both facing +x.
  const part = (color, w, h, d, x, y, z) => coloured(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color), tyre = (x, z, r = .46) => coloured(new THREE.CylinderGeometry(r, r, .4, 12).rotateX(Math.PI / 2).translate(x, r, z), '#23262d');
  const carBody = mergeGeometries([new THREE.BoxGeometry(4.2, .85, 1.9).translate(0, .95, 0), new THREE.BoxGeometry(2.1, .14, 1.7).translate(-.25, 2.05, 0)]);
  const carTrim = mergeGeometries([tyre(1.3, .95), tyre(1.3, -.95), tyre(-1.3, .95), tyre(-1.3, -.95), part('#bfe3f7', 2.2, .66, 1.78, -.25, 1.68, 0), part('#2f3640', 2.3, .1, 1.82, -.25, 1.36, 0), part('#fff6c9', .1, .26, .4, 2.12, 1, .6), part('#fff6c9', .1, .26, .4, 2.12, 1, -.6), part('#ff4a3d', .1, .26, .4, -2.12, 1, .6), part('#ff4a3d', .1, .26, .4, -2.12, 1, -.6), part('#c9d1d9', 4.3, .16, 1.96, 0, .56, 0)]);
  const busBody = mergeGeometries([new THREE.BoxGeometry(7.6, 1.2, 2.2).translate(0, 1.2, 0), new THREE.BoxGeometry(7.6, .5, 2.2).translate(0, 2.9, 0)]);
  const busTrim = mergeGeometries([tyre(2.4, 1.1, .55), tyre(2.4, -1.1, .55), tyre(-2.4, 1.1, .55), tyre(-2.4, -1.1, .55), part('#bfe3f7', 7.5, .86, 2.24, 0, 2.23, 0), ...[-2.5, -1.25, 0, 1.25, 2.5].map(x => part('#ffb000', .14, .86, 2.26, x, 2.23, 0)), part('#fff6c9', .1, .3, .5, 3.82, 1.1, .7), part('#fff6c9', .1, .3, .5, 3.82, 1.1, -.7), part('#ff4a3d', .1, .3, .5, -3.82, 1.1, .7), part('#ff4a3d', .1, .3, .5, -3.82, 1.1, -.7), part('#ffffff', 3, .34, .06, 0, 3, 1.13)]);
  const drivers = [];
  for (const r of ROADS_EW) for (const lane of [-1, 1]) for (let i = 0; i < (r.wide > 8 ? 5 : 3); i++) drivers.push({ along: 'x', fixed: r.at + lane * r.wide * .25, way: lane, at: CITY.x0 + rand() * W, speed: 6 + rand() * 6, bus: r.wide > 8 && i === 0 });
  for (const r of ROADS_NS) for (const lane of [-1, 1]) for (let i = 0; i < (r.wide > 8 ? 6 : 4); i++) drivers.push({ along: 'z', fixed: r.at + lane * r.wide * .25, way: -lane, at: CITY.z0 + rand() * D, speed: 6 + rand() * 6, bus: r.wide > 8 && i === 0, avenue: r.at === AVENUE });
  const fleet = [false, true].map(bus => { const list = drivers.filter(d => d.bus === bus), trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 }), body = new THREE.InstancedMesh(bus ? busBody : carBody, new THREE.MeshStandardMaterial({ roughness: .35, metalness: .15 }), list.length), rest = new THREE.InstancedMesh(bus ? busTrim : carTrim, trim, list.length);
    list.forEach((d, i) => body.setColorAt(i, paint.set(bus ? '#ffb000' : i % 7 === 3 ? '#ffd400' : CARS[i % CARS.length]))); body.castShadow = true; body.frustumCulled = rest.frustumCulled = false; group.add(body, rest); return { list, body, rest }; });
  function drive(dt) {
    for (const { list, body, rest } of fleet) {
      list.forEach((d, i) => {
        const x0 = CITY.x0 + 8, x1 = CITY.x1 - 8, z0 = CITY.z0 + 8, z1 = d.avenue ? 0 : 66;
        d.at += d.way * d.speed * dt;
        if (d.along === 'x') { if (d.at > x1) d.at = x0; else if (d.at < x0) d.at = x1; } else if (d.at > z1) d.at = z0; else if (d.at < z0) d.at = z1;
        const x = d.along === 'x' ? d.at : d.fixed, z = d.along === 'x' ? d.fixed : d.at, on = !(d.along === 'x' && d.fixed > AIRPORT.z0 && x > AIRPORT.x0 - 4 && x < AIRPORT.x1 + 4);
        dummy.position.set(x, G, z); dummy.rotation.set(0, d.along === 'x' ? (d.way > 0 ? 0 : Math.PI) : d.way > 0 ? -Math.PI / 2 : Math.PI / 2, 0); dummy.scale.setScalar(on ? 1 : 0); dummy.updateMatrix(); body.setMatrixAt(i, dummy.matrix); rest.setMatrixAt(i, dummy.matrix);
      });
      body.instanceMatrix.needsUpdate = rest.instanceMatrix.needsUpdate = true;
    }
    dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
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
      const spin = clock * .22; wheel.rotation.z = spin;
      cabins.forEach((cabin, i) => { const a = spin + i / cabins.length * Math.PI * 2; cabin.position.set(WHEEL.x + Math.cos(a) * 12, hub + Math.sin(a) * 12 - 1.6, WHEEL.z); });
      drive(dt);
      const a = clock * .05; blimp.position.set(-10 + Math.cos(a) * 80, 90 + Math.sin(clock * .5) * 1.2, -150 + Math.sin(a) * 90); blimp.rotation.y = -a;
      boats.forEach((boat, i) => { boat.position.y = .3 + Math.sin(clock + i) * .12; boat.rotation.z = Math.sin(clock * .7 + i) * .04; });
      jet.scale.y = 1 + Math.sin(clock * 5) * .18;
      blinkers.forEach((light, i) => light.visible = Math.sin(clock * 3 + i) > -.3);
    }
  };
}
