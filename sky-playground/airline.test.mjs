import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepFlight,touchesTarget,angleDelta,runwayLanding,runwayTakeoff} from './flight.js';
import {AIRPORTS,SPEEDS,airportRunway,approachFor,parkedAt,worldGroundHeight,worldObstacles,newTrip,prepareTrip,arriveTrip,normalizePassport,stampArrival,assistedLanding,nearestAirport} from './airline.js';
const local=JSON.parse(readFileSync(new URL('./assets/obstacles.json',import.meta.url))),obstacles=worldObstacles(local);

test('a passenger can depart only after choosing another airport, loading a bag and boarding',()=>{
  assert.equal(newTrip('sunny','sunny'),null);assert.equal(newTrip('unknown','snowy'),null);
  const t=newTrip('sunny','snowy');assert.equal(prepareTrip(t,'depart'),t);assert.equal(prepareTrip(t,'board'),t);
  const bag=prepareTrip(t,'bag'),board=prepareTrip(bag,'board'),flying=prepareTrip(board,'depart');
  assert.equal(t.bag,false);assert.equal(bag.bag,true);assert.equal(board.boarded,true);assert.equal(flying.status,'flying');assert.equal(prepareTrip(flying,'bag'),flying);
});
test('all six airport routes reach a correctly aligned approach at each speed',()=>{
  for(const from of AIRPORTS)for(const to of AIRPORTS)if(from!==to)for(const speed of Object.values(SPEEDS)){
    let s=runwayTakeoff(parkedAt(from.id),7,airportRunway(from.id)),leg=0,aligned=false;
    const route=approachFor(to.id);
    for(let i=0;i<60*160;i++){
      const before=s;s=stepFlight(s,{x:0,y:0},1/60,route[leg],obstacles,{speed,boundary:490,groundHeight:worldGroundHeight});
      if(touchesTarget(before,s,route[leg],4.5)){if(leg===0)leg=1;else if(Math.abs(angleDelta(0,s.heading))<.45){aligned=true;break;}else leg=0;}
    }
    assert.ok(aligned,`${from.id} → ${to.id}, speed ${speed}`);
    assert.ok(Math.abs(s.x-airportRunway(to.id).x)<4.5);
  }
});
test('automatic landing and takeoff use the selected airport coordinates',()=>{
  for(const a of AIRPORTS){const r=airportRunway(a.id),start={...parkedAt(a.id),...approachFor(a.id)[1],speed:9};
    const parked=runwayLanding(start,11,r);assert.equal(parked.x,r.x);assert.equal(parked.z,r.stopZ);assert.equal(parked.y,r.parkedY);assert.equal(parked.speed,0);
    const up=runwayTakeoff(parked,7,r);assert.equal(up.x,r.x);assert.ok(up.y>15);assert.ok(up.z<r.stopZ-45);
  }
});
test('guided manual landings accept steering but stay in the corridor and finish on the runway',()=>{
  for(const a of AIRPORTS)for(const hz of [20,60,120])for(const direction of [-1,0,1]){
    const r=airportRunway(a.id),start={...parkedAt(a.id),...approachFor(a.id)[1],speed:9};let state=start,maxOffset=0;
    for(let i=1;i<=hz*14;i++){state=assistedLanding(start,state,i/hz,1/hz,{x:direction,y:direction},r);maxOffset=Math.max(maxOffset,Math.abs(state.manualX));assert.ok(Math.abs(state.x-r.x)<4.01);assert.ok(state.y>=r.parkedY);}
    assert.equal(state.finished,true);assert.equal(state.x,r.x);assert.equal(state.z,r.stopZ);assert.equal(state.speed,0);if(direction)assert.ok(maxOffset>.7,'child steering visibly affects the plane');
  }
});
test('full input cannot cross island terrain or cloned obstacle tops in airline flight',()=>{
  for(const a of AIRPORTS){let s={...parkedAt(a.id),y:20};for(let i=0;i<900;i++){
    s=stepFlight(s,{x:.3,y:-1},1/30,null,obstacles,{speed:19,boundary:490,groundHeight:worldGroundHeight});
    assert.ok(s.y>=worldGroundHeight(s.x,s.z)+5.2-1e-8);
    for(const o of obstacles)if(Math.hypot(s.x-o.x,s.z-o.z)<o.radius+2.8)assert.ok(s.y>=o.top+2-1e-8);
  }}
});
test('selected speeds change travel distance while assistance retains tight turns',()=>{
  const start={...parkedAt('sunny'),x:0,z:130,y:25};const distances=[];
  for(const speed of Object.values(SPEEDS)){let s=start;for(let i=0;i<60;i++)s=stepFlight(s,{x:0,y:0},1/60,null,[],{speed,boundary:490,groundHeight:worldGroundHeight});distances.push(Math.hypot(s.x-start.x,s.z-start.z));}
  assert.ok(distances[0]<distances[1]&&distances[1]<distances[2]);
});
test('landing at the wrong airport cannot finish a trip or award passport progress',()=>{
  let t=prepareTrip(prepareTrip(prepareTrip(newTrip('sunny','snowy'),'bag'),'board'),'depart');
  assert.equal(arriveTrip(t,'jungle'),t);assert.equal(arriveTrip(newTrip('sunny','snowy'),'snowy').status,'boarding');
  const before=t;t=arriveTrip(t,'snowy');const p=stampArrival(normalizePassport(null),before,t);
  assert.deepEqual(p,{stamps:['snowy'],trips:1});assert.equal(stampArrival(p,t,arriveTrip(t,'snowy')),p);
});
test('passport reload validates unknown stamps and invalid counts',()=>{
  for(const raw of ['null','oops','[]','{"trips":-1}'])assert.deepEqual(normalizePassport(raw),{stamps:[],trips:0});
  assert.deepEqual(normalizePassport('{"stamps":["snowy","snowy","bad","jungle"],"trips":7}'),{stamps:['snowy','jungle'],trips:7});
  assert.equal(nearestAirport(parkedAt('jungle')),'jungle');
});
test('airline boundary turns back without preventing inter-island travel',()=>{
  let s={...parkedAt('sunny'),x:500,z:0,y:30,heading:Math.PI/2},cameBack=false;
  for(let i=0;i<3600;i++){s=stepFlight(s,{x:0,y:0},1/60,null,[],{speed:19,boundary:490,groundHeight:worldGroundHeight});if(Math.hypot(s.x,s.z)<355){cameBack=true;break;}}
  assert.ok(cameBack);
});
test('both added destinations have valid local Blender exports and distinct palettes',()=>{
  const colors=[];
  for(const a of AIRPORTS){const b=readFileSync(new URL(`./assets/${a.asset}.glb`,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');const g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.ok(g.meshes.length>5);colors.push(JSON.stringify(g.materials.find(m=>m.name==='Meadow 0').pbrMetallicRoughness.baseColorFactor));}
  assert.equal(new Set(colors).size,3);
});
