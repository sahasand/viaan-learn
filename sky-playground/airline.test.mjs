import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepFlight,touchesTarget,angleDelta,runwayLanding,runwayTakeoff} from './flight.js';
import {allObstacles,cityPlan} from './city.js';
import {AIRPORTS,SPEEDS,airportRunway,approachFor,parkedAt,worldGroundHeight,worldObstacles,newTrip,prepareTrip,arriveTrip,normalizePassport,stampArrival,assistedLanding,nearestAirport,WORLD,nightAt,CITY,cityEdge} from './airline.js';
const local=JSON.parse(readFileSync(new URL('./assets/obstacles.json',import.meta.url))),obstacles=allObstacles(local);

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
      const before=s;s=stepFlight(s,{x:0,y:0},1/60,route[leg],obstacles,{speed,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});
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
    s=stepFlight(s,{x:.3,y:-1},1/30,null,obstacles,{speed:19,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});
    assert.ok(s.y>=worldGroundHeight(s.x,s.z)+5.2-1e-8);
    for(const o of obstacles)if(Math.hypot(s.x-o.x,s.z-o.z)<o.radius+2.8-1e-6)assert.ok(s.y>=o.top+2-1e-8,o.wall?'never inside a tower':'never inside a tree or house');
  }}
});
test('selected speeds change travel distance while assistance retains tight turns',()=>{
  const start={...parkedAt('sunny'),x:0,z:130,y:25};const distances=[];
  for(const speed of Object.values(SPEEDS)){let s=start;for(let i=0;i<60;i++)s=stepFlight(s,{x:0,y:0},1/60,null,[],{speed,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});distances.push(Math.hypot(s.x-start.x,s.z-start.z));}
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
  for(let i=0;i<3600;i++){s=stepFlight(s,{x:0,y:0},1/60,null,[],{speed:19,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});if(Math.hypot(s.x-WORLD.x,s.z-WORLD.z)<330){cameBack=true;break;}}
  assert.ok(cameBack);
});
test('every destination has a valid local Blender export and its own palette',()=>{
  const colors=[];
  for(const a of AIRPORTS.filter(a=>!a.city)){const b=readFileSync(new URL(`./assets/${a.asset}.glb`,import.meta.url));assert.equal(b.toString('ascii',0,4),'glTF');const g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.ok(g.meshes.length>5);colors.push(JSON.stringify(g.materials.find(m=>m.name==='Meadow 0').pbrMetallicRoughness.baseColorFactor));}
  assert.equal(new Set(colors).size,4);
});
test('all five islands and their approaches are well inside the edge of the world',()=>{
  assert.equal(AIRPORTS.length,5);
  for(const a of AIRPORTS){
    assert.ok(Math.hypot(a.x-WORLD.x,a.z-WORLD.z)+101<WORLD.radius-60,`${a.id} is clear of the edge`);
    for(const p of approachFor(a.id))assert.ok(Math.hypot(p.x-WORLD.x,p.z-WORLD.z)<WORLD.radius-40,`${a.id} approach is inside the edge`);
    for(const b of AIRPORTS)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>240,`${a.id} and ${b.id} do not touch`);
  }
});
test('it is night over Starlight Island, day over the others, and dusk on the way in',()=>{
  for(const a of AIRPORTS)assert.equal(nightAt(a.x,a.z),a.id==='starry'?1:0,a.id);
  const end=approachFor('starry')[0];assert.equal(nightAt(end.x,end.z),1,'the landing approach is flown in the dark');
  let last=0;for(let z=0;z>=-420;z-=10){const n=nightAt(22,z);assert.ok(n>=last&&n-last<.2,'the sky darkens smoothly');last=n;}
});

test('Big City stands on flat ground with towers clear of the runway, Main Avenue and the park',()=>{
  const city=AIRPORTS.find(a=>a.city),{towers,houses,parks}=cityPlan(),r=airportRunway('city'),all=[...towers,...houses];
  assert.ok(towers.length>=30&&houses.length>=35,'a downtown of towers inside a ring of houses');assert.ok(towers.some(t=>t.top>60)&&towers.some(t=>t.top<25),'tall and small towers');
  assert.ok(CITY.x1-CITY.x0>=280&&CITY.z1-CITY.z0>=350,'a big city');
  for(const t of all){
    assert.ok(t.radius>t.half&&t.radius<t.half*1.42);assert.equal(!!t.wall,towers.includes(t),'towers are walls, houses are flown over');
    assert.ok(Math.abs(t.x-r.x)>=t.radius+9,'Main Avenue is open from shore to shore');
    assert.equal(worldGroundHeight(t.x,t.z),2.7,'every building stands on the flat');assert.ok(cityEdge(t.x-city.x,t.z-city.z)<-8,'and well inside the city');
    for(const o of all)if(o!==t)assert.ok(Math.hypot(o.x-t.x,o.z-t.z)>=t.radius+o.radius+2*2.8+3,'a plane fits down every street');
  }
  for(const h of houses)assert.ok(h.top<=12,'houses are low');
  assert.ok(parks.length>=4);
  for(let z=r.stopZ-60;z<=r.touchdownZ+16;z+=4)assert.equal(worldGroundHeight(r.x,z),2.7,'level under the runway');
  for(const p of approachFor('city'))assert.equal(worldGroundHeight(p.x,p.z),0,'the landing comes in over the harbour');
  assert.equal(worldGroundHeight(city.x+230,city.z),0);assert.equal(worldGroundHeight(city.x,city.z-200),2.7);
});
test('a plane below a tower top slides round it, and one above it flies over',()=>{
  const t=cityPlan().towers.find(t=>t.top>55),short=cityPlan().houses[0];
  // Aimed just off the middle of a tall tower from the west: it comes out the far side without ever going inside or up over.
  let s={x:t.x-40,y:20,z:t.z+1,heading:Math.PI/2,turn:0,climb:0,speed:13,returning:false},closest=99,highest=0;
  for(let i=0;i<600&&s.x<t.x+25;i++){s=stepFlight(s,{x:0,y:0},1/60,{x:t.x+60,y:20,z:t.z},obstacles,{speed:13,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});closest=Math.min(closest,Math.hypot(s.x-t.x,s.z-t.z));highest=Math.max(highest,s.y);}
  assert.ok(s.x>=t.x+25,'gets past');assert.ok(closest>=t.radius+2.8-1e-6,'never inside');assert.ok(highest<24,'does not hop over');
  s={x:short.x-40,y:short.top+8,z:short.z,heading:Math.PI/2,turn:0,climb:0,speed:13,returning:false};
  for(let i=0;i<300;i++)s=stepFlight(s,{x:0,y:0},1/60,null,[short],{speed:13,boundary:WORLD.radius,center:WORLD,groundHeight:worldGroundHeight});
  assert.ok(s.x>short.x+20&&Math.abs(s.z-short.z)<1,'straight over the top of a small one');
});
