// Cartoon dogs built from soft round shapes: the drivers who poke out of every car,
// the crowd beside the road, and the little portraits in the race order.
// Each dog faces +z, stands with its feet at y = 0 and is about two metres tall.
import * as THREE from 'three';

const SHAPES = {
  hi: new THREE.SphereGeometry(1, 18, 13), mid: new THREE.SphereGeometry(1, 12, 9), lo: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 9).translate(0, .5, 0), ring: new THREE.TorusGeometry(1, .2, 7, 18).rotateX(Math.PI / 2)
};
const FIXED = { dark: '#2a2326', white: '#ffffff', pink: '#ff7d9c', gold: '#ffc21a' };
// Joints are pivots: [parent, x, y, z]. Ears hang from the head; arms and tail from the body.
const JOINTS = { root: [null, 0, 0, 0], head: ['root', 0, 1, 0], earL: ['head', .4, .72, -.02], earR: ['head', -.4, .72, -.02], armL: ['root', .33, .86, 0], armR: ['root', -.33, .86, 0], tail: ['root', 0, .42, -.26] };
const part = (shape, color, joint, p, s, extra = {}) => ({ shape, color, joint, p, s, r: [0, 0, 0], ...extra });
const pair = (shape, color, joint, p, s, extra = {}) => [1, -1].map(side => part(shape, color, joint.replace('*', side > 0 ? 'L' : 'R'), [p[0] * side, p[1], p[2]], s, { ...extra, r: extra.r ? [extra.r[0], extra.r[1] * side, extra.r[2] * side] : [0, 0, 0] }));
// 'low' parts are hidden inside a car; 'fine' parts are left off the crowd; 'when' names the look that needs the part.
const PARTS = [
  part('mid', 'fur', 'root', [0, .62, 0], [.36, .42, .31]),
  part('lo', 'muzzle', 'root', [0, .58, .12], [.26, .31, .23]),
  ...pair('lo', 'fur', 'root', [.17, .2, 0], [.14, .22, .16], { low: true }),
  ...pair('lo', 'muzzle', 'root', [.18, .07, .08], [.15, .08, .21], { low: true }),
  part('ring', 'collar', 'root', [0, .99, 0], [.27, .27, .27]),
  part('lo', 'gold', 'root', [0, .93, .28], [.06, .06, .03], { fine: true }),
  part('lo', 'spots', 'root', [-.22, .76, .17], [.1, .1, .06], { when: 'spots' }),
  part('lo', 'spots', 'root', [.26, .5, -.1], [.09, .11, .09], { when: 'spots' }),
  ...pair('lo', 'fur', 'arm*', [0, -.2, 0], [.1, .24, .1]),
  ...pair('lo', 'muzzle', 'arm*', [0, -.42, 0], [.115, .1, .115]),
  part('lo', 'fur', 'tail', [0, .2, -.1], [.07, .24, .07], { low: true, r: [-.45, 0, 0] }),
  part('lo', 'muzzle', 'tail', [0, .4, -.2], [.078, .09, .078], { low: true }),
  part('hi', 'fur', 'head', [0, .44, .02], [.5, .45, .46]),
  part('mid', 'muzzle', 'head', [0, .31, .36], [.27, .2, .24]),
  part('lo', 'dark', 'head', [0, .39, .585], [.095, .07, .06]),
  part('lo', 'pink', 'head', [0, .19, .47], [.085, .06, .12], { tongue: true }),
  ...pair('lo', 'white', 'head', [.2, .56, .39], [.105, .125, .07]),
  ...pair('lo', 'eyes', 'head', [.2, .555, .445], [.06, .078, .035]),
  ...pair('lo', 'white', 'head', [.175, .6, .472], [.022, .022, .012], { fine: true }),
  part('lo', 'patch', 'head', [.21, .57, .34], [.2, .21, .1], { when: 'patch' }),
  part('lo', 'spots', 'head', [-.28, .74, .22], [.11, .1, .07], { when: 'spots' }),
  part('lo', 'spots', 'head', [.1, .87, .08], [.1, .05, .1], { when: 'spots' }),
  ...pair('lo', 'ear', 'ear*', [.07, -.26, 0], [.11, .3, .19], { when: 'floppy' }),
  ...pair('cone', 'ear', 'ear*', [-.1, .06, 0], [.17, .4, .1], { when: 'pointy', r: [0, 0, -.3] }),
  ...pair('cone', 'pink', 'ear*', [-.1, .08, .05], [.09, .25, .06], { when: 'pointy', fine: true, r: [0, 0, -.3] }),
  part('ring', 'gold', 'head', [0, .87, 0], [.2, .34, .2], { when: 'crown', fine: true }),
  ...[0, 1, 2, 3, 4].map(i => part('cone', 'gold', 'head', [Math.sin(i * 1.257) * .2, .88, Math.cos(i * 1.257) * .2], [.06, .2, .06], { when: 'crown', fine: true }))
];
const wears = (look, p) => !p.when || (p.when === 'floppy' || p.when === 'pointy' ? look.ears === p.when : !!look[p.when]);
const shade = (look, key) => FIXED[key] || look[key] || (key === 'eyes' ? FIXED.dark : look.fur);
const euler = new THREE.Euler(), quat = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3();
const compose = (out, p, r, s) => out.compose(vp.set(p[0], p[1], p[2]), quat.setFromEuler(euler.set(r[0], r[1], r[2])), vs.set(s[0], s[1], s[2]));
for (const p of PARTS) p.matrix = compose(new THREE.Matrix4(), p.p, p.r, p.s);
const materials = new Map();
const material = color => {
  if (!materials.has(color)) { const m = new THREE.MeshStandardMaterial({ color, roughness: .72 }); m.userData.keep = true; materials.set(color, m); }
  return materials.get(color);
};

// One dog made of real meshes with joints that can be posed. `seated` leaves off the legs and tail.
export function makeDog(look, seated = false) {
  const joints = {};
  for (const [name, [parent, x, y, z]] of Object.entries(JOINTS)) {
    joints[name] = new THREE.Group(); joints[name].position.set(x, y, z);
    if (parent) joints[parent].add(joints[name]);
  }
  let tongue = null;
  for (const p of PARTS) {
    if (!wears(look, p) || (seated && p.low)) continue;
    const mesh = new THREE.Mesh(SHAPES[p.shape], material(shade(look, p.color)));
    mesh.position.fromArray(p.p); mesh.rotation.fromArray(p.r); mesh.scale.fromArray(p.s);
    mesh.castShadow = p.shape === 'hi' || p.shape === 'mid'; joints[p.joint].add(mesh);
    if (p.tongue) tongue = mesh;
  }
  return { group: joints.root, joints, tongue, look, pointy: look.ears === 'pointy' };
}
// Poses a driver: paws on the roof, ears streaming back with speed, head turning into the bend.
export function poseDriver(dog, clock, speed, steer, boost, air, calm) {
  const fast = Math.min(speed / 26, 1.4), flutter = calm ? 0 : Math.sin(clock * 17 + dog.group.id) * .12 * fast;
  for (const [name, side] of [['armL', 1], ['armR', -1]]) dog.joints[name].rotation.set(-1.25, 0, side * .28);
  dog.joints.head.rotation.set((air ? -.3 : 0) - fast * .06, steer * -.38, calm ? 0 : Math.sin(clock * 2.3 + dog.group.id) * .04 + steer * .1);
  for (const [name, side] of [['earL', 1], ['earR', -1]]) dog.joints[name].rotation.set(dog.pointy ? fast * .22 : fast * .95 + flutter, 0, dog.pointy ? 0 : side * (.12 + fast * .5 + flutter));
  if (dog.tongue) dog.tongue.scale.set(.085, .06, boost ? .2 : .12);
}
// A small picture of a dog's face for the race order, drawn with the game's own renderer.
export function portrait(renderer, look, background = '#fff3d6', size = 128) {
  const scene = new THREE.Scene(), dog = makeDog(look, true), camera = new THREE.PerspectiveCamera(26, 1, .1, 30);
  const canvas = renderer.domElement, picture = document.createElement('canvas');
  scene.background = new THREE.Color(background);
  scene.add(dog.group, new THREE.HemisphereLight('#ffffff', '#c9b79a', 2.2));
  const light = new THREE.DirectionalLight('#fff4e0', 2.4); light.position.set(2, 3, 4); scene.add(light);
  for (const [name, side] of [['armL', 1], ['armR', -1]]) dog.joints[name].rotation.set(0, 0, side * .3);
  dog.joints.head.rotation.set(0, -.25, .06);
  camera.aspect = canvas.width / canvas.height; camera.position.set(.5, 1.62, 3.6); camera.lookAt(0, 1.47, 0);
  // The square in the middle of the picture is all that is kept.
  const side = Math.min(canvas.width, canvas.height); camera.fov = 26 * (canvas.height / side); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  picture.width = picture.height = size;
  picture.getContext('2d').drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, size, size);
  return picture.toDataURL('image/png');
}

// The whole crowd is drawn as five instanced meshes, one per shape, however many dogs there are.
// Each spot is { x, y, z, facing, look, scale, beat, d, back }.
export function makeCrowd(spots) {
  const parts = PARTS.filter(p => !p.fine), group = new THREE.Group(), meshes = {}, slot = [], count = {}, tint = new THREE.Color();
  for (const p of parts) { count[p.shape] = count[p.shape] || 0; slot.push(count[p.shape]++); }
  for (const shape of Object.keys(count)) {
    const mesh = new THREE.InstancedMesh(SHAPES[shape], new THREE.MeshStandardMaterial({ roughness: .72 }), count[shape] * spots.length);
    mesh.frustumCulled = false; mesh.castShadow = shape === 'hi' || shape === 'mid'; meshes[shape] = mesh; group.add(mesh);
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const worn = spots.map((spot, i) => parts.map((p, j) => {
    const index = i * count[p.shape] + slot[j], on = wears(spot.look, p);
    meshes[p.shape].setColorAt(index, tint.set(shade(spot.look, p.color)));
    if (!on) meshes[p.shape].setMatrixAt(index, zero);
    return on ? index : -1;
  }));
  const joint = Object.fromEntries(Object.keys(JOINTS).map(name => [name, new THREE.Matrix4()])), local = new THREE.Matrix4(), out = new THREE.Matrix4(), turn = {};
  const pose = (i, clock, cheer, calm) => {
    const spot = spots[i], b = spot.beat, hop = calm ? 0 : Math.max(0, Math.sin(clock * 8 + b)) * cheer, waves = !calm && cheer < .3 && Math.sin(clock * .5 + b * 3) > .2;
    const arm = side => cheer > .3 ? 2.6 + Math.sin(clock * 9 + b + side) * .28 : waves && side > 0 === b > 3 ? 2.35 + Math.sin(clock * 7 + b) * .45 : .32;
    turn.root = [0, spot.facing, calm ? 0 : Math.sin(clock * 2 + b) * .05];
    turn.head = [-.14 * cheer, 0, calm ? 0 : Math.sin(clock * 2.3 + b) * .09];
    turn.earL = [0, 0, spot.look.ears === 'pointy' ? 0 : .12 + hop * .7]; turn.earR = [0, 0, -turn.earL[2]];
    turn.armL = [0, 0, arm(1)]; turn.armR = [0, 0, -arm(-1)];
    turn.tail = [0, 0, calm ? 0 : Math.sin(clock * (9 + cheer * 9) + b) * .7];
    for (const [name, [parent, x, y, z]] of Object.entries(JOINTS)) {
      if (!parent) compose(joint.root, [spot.x, spot.y + hop * .3 * spot.scale, spot.z], turn.root, [spot.scale, spot.scale * (1 + hop * .06), spot.scale]);
      else joint[name].multiplyMatrices(joint[parent], compose(local, [x, y, z], turn[name], [1, 1, 1]));
    }
    parts.forEach((p, j) => { if (worn[i][j] >= 0) meshes[p.shape].setMatrixAt(worn[i][j], out.multiplyMatrices(joint[p.joint], p.matrix)); });
  };
  spots.forEach((_, i) => pose(i, 0, 0, true));
  for (const mesh of Object.values(meshes)) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  return {
    group,
    // `cheerAt(spot)` says how excited each dog is (0 to 1); far-away dogs are left as they were.
    update(clock, cheerAt, calm) {
      spots.forEach((spot, i) => { const cheer = cheerAt(spot); if (cheer >= 0) pose(i, clock, cheer, calm); });
      for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
    },
    // Dogs are stored front row first, so a slow device can simply draw fewer of them.
    show(amount) { for (const [shape, mesh] of Object.entries(meshes)) mesh.count = Math.ceil(spots.length * amount) * count[shape]; }
  };
}
