// Super Viaan: an original kid hero built from simple shapes, with a big head, a mask, a
// cape and a star on his chest. `pose` moves him for whatever the rules say he is doing.
import * as THREE from 'three';

export const BIG = 1.5;          // drawn larger than life so he is easy to follow on a phone
const INK = '#2a1f3d';
export function starShape(points = 5, outer = 1, inner = .46, depth = .28) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) { const a = i / (points * 2) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : outer; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }).center();
}
export const STAR = starShape();
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...more });
// A dark shell just outside a shape gives it a cartoon outline.
export function outlined(mesh, grow = 1.07) {
  const shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); shell.scale.setScalar(grow); mesh.add(shell); return mesh;
}

export function makeHero() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.rotation.order = 'YXZ';
  const suit = mat('#18a999', { roughness: .45 }), cape = new THREE.MeshStandardMaterial({ color: '#ff9f1c', side: THREE.DoubleSide, roughness: .65 });
  const skin = mat('#f6cfa6'), gold = mat('#ffd23f', { roughness: .35 }), hairColor = mat('#3b2a20', { roughness: .9 }), white = mat('#ffffff', { roughness: .3 }), ink = mat(INK), blush = mat('#f59a8f');
  const part = (geometry, material, x, y, z, parent = body) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const limb = (x, y, long, thick, tip) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot); part(new THREE.CapsuleGeometry(thick, long, 4, 10), suit, 0, -long / 2 - thick * .3, 0, pivot); outlined(part(new THREE.SphereGeometry(thick * tip, 12, 10), gold, 0, -long - thick * .9, 0, pivot), 1.1); return pivot; };
  // A small body under a big head, the way a toddler draws a hero.
  outlined(part(new THREE.CapsuleGeometry(.4, .42, 6, 16), suit, 0, 1.02, 0), 1.06);
  const belt = part(new THREE.TorusGeometry(.4, .07, 8, 22), gold, 0, .8, 0); belt.rotation.x = Math.PI / 2;
  const badge = part(STAR, gold, 0, 1.12, .41); badge.scale.setScalar(.21);
  const head = new THREE.Group(); head.position.set(0, 2.02, 0); body.add(head);
  outlined(part(new THREE.SphereGeometry(.66, 24, 18), skin, 0, 0, 0, head), 1.045);
  const hair = part(new THREE.SphereGeometry(.69, 20, 12, 0, Math.PI * 2, 0, Math.PI * .46), hairColor, 0, .03, -.04, head); hair.rotation.x = -.32;
  for (const [x, y, z, r] of [[-.18, .62, .3, .2], [.1, .68, .26, .22], [.34, .56, .2, .17]]) part(new THREE.SphereGeometry(r, 10, 8), hairColor, x, y, z, head);   // a tuft at the front
  part(new THREE.CylinderGeometry(.668, .668, .34, 26, 1, true), suit, 0, .06, 0, head);                                  // the mask
  for (const side of [-1, 1]) {
    part(new THREE.SphereGeometry(.14, 10, 8), suit, side * .66, .06, -.05, head).scale.set(.6, 1.6, 1.2);               // mask ties flying behind the ears
    const eye = part(new THREE.SphereGeometry(.17, 14, 12), white, side * .25, .06, .575, head); eye.scale.set(1, 1.18, .45);
    part(new THREE.SphereGeometry(.085, 10, 8), ink, side * .25, .04, .655, head).scale.set(1, 1.15, .5);
    part(new THREE.SphereGeometry(.03, 6, 6), white, side * .25 + .035, .09, .695, head);
    part(new THREE.SphereGeometry(.1, 8, 6), blush, side * .43, -.2, .47, head).scale.set(1, .6, .3);
  }
  const smile = part(new THREE.TorusGeometry(.17, .035, 6, 14, Math.PI), ink, 0, -.22, .6, head); smile.rotation.z = Math.PI;
  const gasp = part(new THREE.SphereGeometry(.13, 12, 10), mat('#8c2f39'), 0, -.3, .6, head); gasp.scale.set(1, 1.15, .4); gasp.visible = false;       // an open mouth for "wheee"
  const capeGeometry = new THREE.PlaneGeometry(1.25, 1.75, 5, 8); capeGeometry.translate(0, -.875, 0);
  const capeMesh = part(capeGeometry, cape, 0, 1.52, -.4), rest = capeGeometry.attributes.position.array.slice();
  const arms = [limb(-.5, 1.36, .4, .14, 1.35), limb(.5, 1.36, .4, .14, 1.35)], legs = [limb(-.22, .64, .32, .18, 1.4), limb(.22, .64, .32, .18, 1.4)];
  g.scale.setScalar(BIG);
  return { g, body, head, suit, cape, capeMesh, rest, arms, legs, smile, gasp, flip: 0, squash: 0, blink: 0 };
}

// Poses the hero. `what` is 'run', 'air', 'swing', 'climb', 'wait' or 'cheer'; `rope` is the angle
// to the hook (0 straight up, positive ahead) while swinging.
export function poseHero(m, { what, x, y, vx, vy, rope = 0, holding = false, t, dt, reduced = false }) {
  const g = m.g, speed = Math.hypot(vx, vy), ease = 1 - Math.exp(-16 * dt);
  let face = Math.PI / 2 - .55, lean = 0, armL = 0, armR = 0, legL = 0, legR = 0, hop = 0, spread = 0, look = 0, open = false;
  if (what === 'run') { const p = t * 14; lean = .22; legL = Math.sin(p) * 1.05; legR = -legL; armL = -legL * .9; armR = legL * .9; hop = Math.abs(Math.sin(p)) * .14; if (holding) { armR = Math.PI * .86; look = -.25; } }
  else if (what === 'wait') { face = .25; armR = Math.PI + Math.sin(t * 6) * .45; spread = .4; hop = Math.abs(Math.sin(t * 3)) * .1; look = Math.sin(t * 1.3) * .12; }
  else if (what === 'climb') { const p = t * 13; face = Math.PI / 2; armL = Math.PI + Math.sin(p) * .55; armR = Math.PI - Math.sin(p) * .55; legL = Math.sin(p) * .7 - .3; legR = -Math.sin(p) * .7 - .3; look = -.3; }
  else if (what === 'swing') { face = Math.PI / 2 - .3; lean = rope * .75; armL = armR = rope + Math.PI - lean; legL = .55 + vx * .03; legR = .1 + vx * .03; look = -.2; open = speed > 9; }
  else if (what === 'air') { lean = THREE.MathUtils.clamp(-vy * .035, -.55, .7); armL = armR = Math.PI * .82; spread = .75; legL = .6; legR = -.3; open = true; }
  else { face = 0; hop = Math.abs(Math.sin(t * 7)) * 1; armL = armR = Math.PI + Math.sin(t * 14) * .4; spread = .55; open = true; }
  // A somersault after a good swing, and a squash on landing or a stretch on taking off.
  m.flip = Math.max(0, m.flip - dt * 1.9); m.squash += (0 - m.squash) * (1 - Math.exp(-11 * dt));
  const turn = what === 'air' && !reduced ? (1 - m.flip) * Math.PI * 2 * (m.flip > 0 ? 1 : 0) : 0, squash = reduced ? 0 : m.squash;
  g.position.set(x, y + hop * BIG, 0); g.rotation.y += (face - g.rotation.y) * ease; g.rotation.x += (lean - g.rotation.x) * ease;
  m.body.rotation.x = turn; m.body.position.set(0, 1.3 * (1 - Math.cos(turn)), -1.3 * Math.sin(turn));   // turning about his middle, not his feet
  g.scale.set(BIG * (1 + squash * .28), BIG * (1 - squash * .32), BIG * (1 + squash * .28));
  m.arms[0].rotation.x += (armL - m.arms[0].rotation.x) * ease; m.arms[1].rotation.x += (armR - m.arms[1].rotation.x) * ease;
  m.arms[0].rotation.z += (-spread - m.arms[0].rotation.z) * ease; m.arms[1].rotation.z += (spread - m.arms[1].rotation.z) * ease;
  m.legs[0].rotation.x += (legL - m.legs[0].rotation.x) * ease; m.legs[1].rotation.x += (legR - m.legs[1].rotation.x) * ease;
  m.head.rotation.x += (look - m.head.rotation.x) * ease; m.head.rotation.z = Math.sin(t * 2.2) * .05;
  m.smile.visible = !open; m.gasp.visible = open;
  // The cape streams out behind and ripples.
  const pos = m.capeMesh.geometry.attributes.position, flow = Math.min(1.3, .22 + speed * .075 + (what === 'cheer' ? .3 : 0));
  for (let i = 0; i < pos.count; i++) { const rx = m.rest[i * 3], ry = m.rest[i * 3 + 1], down = -ry / 1.75; pos.setZ(i, -down * flow * 1.25 + (reduced ? 0 : Math.sin(t * 10 + down * 4.5 + rx * 1.5) * .11 * down)); pos.setY(i, ry * (1 - flow * .3)); pos.setX(i, rx * (1 + down * .25)); }
  pos.needsUpdate = true; m.capeMesh.geometry.computeVertexNormals();
}
