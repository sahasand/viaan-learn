import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as flight from './flight.js';
import * as airline from './airline.js';
import * as sky from './sky.js';
const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/init\(\);\s*$/,'');
class Vec {constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){return this.set(v.x,v.y,v.z);}lerp(v){return this.copy(v);}setScalar(){return this;}}
function harness(){
 const els={},events={};
 function element(id){const classes=new Set();return {id,open:false,hidden:false,disabled:false,style:{},dataset:{},children:[],textContent:'',innerHTML:'',listeners:{},classList:{add(c){classes.add(c);},remove(c){classes.delete(c);},toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},setAttribute(){},querySelectorAll(){return [];},getContext(){return {};},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}};}
 const get=id=>els[id]||(els[id]=element(id));
 class Mesh {constructor(g,m){this.geometry=g;this.material=m;this.position=new Vec();this.scale=new Vec();this.userData={};}}
 const ctx=vm.createContext({...flight,...airline,...sky,console,innerWidth:1280,innerHeight:720,performance:{now:()=>0},matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null,setItem(k,v){events.saved={k,v};}},window:{addEventListener(n,fn){events[n]=fn;}},document:{body:{dataset:{}},getElementById:get,querySelector:s=>get(s),querySelectorAll:()=>[],addEventListener(n,fn){events[n]=fn;}},THREE:{Vector3:Vec,SphereGeometry:class{},Mesh,MeshStandardMaterial:class{constructor(o){Object.assign(this,o);}}}});
 vm.runInContext(code+`; scene={add(){}};camera={position:new THREE.Vector3(),lookAt(){}};plane={position:new THREE.Vector3()};beacon={visible:false};setupControls();`,ctx);
 return {run:s=>vm.runInContext(s,ctx),get,events};
}
test('boarding controls keep takeoff disabled until both preparation actions complete',()=>{
 const h=harness();h.run("restartAirline();trip=newTrip('sunny','snowy');airportBoard()");assert.equal(h.get('depart').disabled,true);assert.equal(h.get('boardPassenger').disabled,true);
 h.get('loadBag').listeners.click();assert.equal(h.get('depart').disabled,true);assert.equal(h.get('boardPassenger').disabled,false);
 h.get('boardPassenger').listeners.click();assert.equal(h.get('depart').disabled,false);h.get('depart').listeners.click();assert.equal(h.run('phase'),'takeoff');assert.equal(h.run('trip.status'),'flying');assert.equal(h.get('airportBoard').open,false);
});
test('the real controller completes a guided passenger trip and stamps exactly once',()=>{
 const h=harness();h.run("restartAirline();trip=newTrip('sunny','snowy');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();");
 h.run('for(let i=0;i<141;i++)updateLanding(.05);setGuided(true);for(let i=0;i<4000&&phase===\'flying\';i++)updateFlight(.05);');
 assert.equal(h.run('phase'),'landing');assert.equal(h.run('landingAirport'),'snowy');
 h.run('for(let i=0;i<281&&phase===\'landing\';i++)updateLanding(.05)');
 assert.equal(h.run('phase'),'parked');assert.equal(h.run('currentAirport'),'snowy');assert.equal(h.run('passport.trips'),1);assert.equal(h.get('celebration').open,true);assert.match(h.get('arrivalTitle').textContent,/Penguin/);
 h.get('explore').listeners.click();assert.equal(h.get('airportBoard').open,true);assert.equal(h.run('trip'),null);assert.equal(h.run('passport.trips'),1);
});
test('pause and resume keep the passenger trip and landing progress intact',()=>{
 const h=harness();h.run("restartAirline();trip=newTrip('sunny','jungle');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();phase='landing';landingTime=3;landingAirport='jungle';openMenu();");
 assert.equal(h.run('paused'),true);assert.equal(h.get('menu').open,true);h.get('resume').listeners.click();assert.equal(h.run('paused'),false);assert.equal(h.run('landingTime'),3);assert.equal(h.run('trip.destination'),'jungle');
});
test('manual steering during final descent does not cancel the landing route',()=>{
 const h=harness();h.run("restartAirline();$('airportBoard').close();phase='landing';paused=false;airportLeg=1;landingAirport='snowy';landingStyle='hands';takeControl();");assert.equal(h.run('airportLeg'),1);assert.equal(h.run('phase'),'landing');
});
test('Land for me switches from manual timing to automatic timing without skipping rollout',()=>{
 const h=harness();h.run("restartAirline();$('airportBoard').close();phase='landing';paused=false;landingTime=4;landingStyle='hands';");h.get('land').listeners.click();assert.equal(h.run('landingStyle'),'auto');assert.equal(h.run('landingTime'),2.5);
});
test('free flight and the original picnic remain available without boarding',()=>{
 const h=harness();h.run('restartAirline()');h.get('freeFly').listeners.click();assert.equal(h.run('mode'),'free');assert.equal(h.run('phase'),'takeoff');assert.equal(h.run('trip'),null);
 h.run('openMenu()');h.get('picnicFlight').listeners.click();assert.equal(h.run('mode'),'picnic');assert.equal(h.run('phase'),'flying');assert.equal(h.run('collected'),0);assert.equal(h.run('landingAirport'),'sunny');
});
// The harness has no animation loop, so these tests move the clock themselves.
const CLOCK="skyItems=buildSky([]);function fly(n,each){for(let i=0;i<n&&phase==='flying';i++){elapsed+=.05;updateFlight(.05);if(each)each();}}function takeOff(){for(let i=0;i<141;i++){elapsed+=.05;updateLanding(.05);}}";
test('the autopilot flies a trip by itself, hands the stick back while the pilot steers, and lands on its own', () => {
 const h=harness();h.run(CLOCK+"restartAirline();trip=newTrip('sunny','snowy');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();takeOff();");
 assert.equal(h.run('phase'),'flying');h.get('guide').listeners.click();assert.equal(h.run('autopilot&&guided'),true);assert.match(h.get('guide').innerHTML,/Auto ON/);
 h.run('fly(80)');assert.ok(h.run('flightStars')>0,'it gathers stars');
 // Steering takes over only while it lasts.
 h.run("takeControl();keys.add('arrowleft');fly(20)");assert.equal(h.run('guided'),false);assert.equal(h.run('autopilot'),true);assert.match(h.get('guide').innerHTML,/Your turn/);
 h.run("keys.clear();fly(30)");assert.equal(h.run('guided'),true);assert.match(h.get('guide').innerHTML,/Auto ON/);
 // The passenger asks for something; doing it earns stars.
 h.run("setWish({kind:'toy',until:elapsed+7})");const before=h.run('pilot.stars');h.get('toy').listeners.click();assert.equal(h.run('wish'),null);assert.equal(h.run('pilot.stars'),before+3);
 h.get('toy').listeners.click();assert.equal(h.run('pilot.stars'),before+3,'only when asked');
 h.run("fly(6000,()=>{if(airportLeg>=0)takeControl();})");
 assert.equal(h.run('phase'),'landing','steering does not interrupt a landing the autopilot has begun');assert.equal(h.run('landingStyle'),'auto');assert.equal(h.run('landingAirport'),'snowy');
 h.run("for(let i=0;i<281&&phase==='landing';i++)updateLanding(.05)");assert.equal(h.run('phase'),'parked');assert.equal(h.run('passport.trips'),1);
 // It stays on for the next flight until its button is tapped.
 assert.equal(h.run('autopilot'),true);h.run("airportBoard();leaveAirport(true);takeOff();fly(1)");assert.equal(h.run('guided'),true);
 h.get('guide').listeners.click();assert.equal(h.run('autopilot||guided'),false);assert.match(h.get('guide').innerHTML,/Autopilot/);
});
test('with nobody aboard the autopilot tours to the next island and lands there', () => {
 const h=harness();h.run(CLOCK+"restartAirline();leaveAirport(true);takeOff();");h.get('guide').listeners.click();
 h.run("fly(9000)");assert.equal(h.run('phase'),'landing');assert.notEqual(h.run('landingAirport'),'sunny');assert.ok(h.run('flightStars')>25,`${h.run('flightStars')} stars`);
});
test('choosing to steer the landing, or Keep flying, takes the plane back from the autopilot', () => {
 const h=harness();h.run(CLOCK+"restartAirline();leaveAirport(true);takeOff();");h.get('guide').listeners.click();
 h.run("openLandingChoice()");h.get('handsLand').listeners.click();assert.equal(h.run('autopilot'),false);assert.equal(h.run('landingStyle'),'hands');assert.ok(h.run('airportLeg')>=0);
 h.run("visitAirport();autopilot=true");h.get('land').listeners.click();assert.equal(h.run('airportLeg'),-1);assert.equal(h.run('autopilot||guided'),false);
});

test('the airport card shows tickets, then one boarding step at a time, and the plane shop on its own page',()=>{
 const h=harness(),view=()=>h.get('airportBoard').dataset.view;h.run("restartAirline()");assert.equal(view(),'pick');assert.equal(h.get('boardingSteps').hidden,true);
 assert.match(h.get('destinationCards').innerHTML,/data-destination="starry"/);assert.equal((h.get('destinationCards').innerHTML.match(/class="ticket"/g)||[]).length,4,'four flights from every airport');
 h.run("trip=newTrip('sunny','starry');airportBoard()");assert.equal(view(),'board');assert.match(h.get('airportHeading').textContent,/Starlight Island/);
 const showing=()=>['loadBag','boardPassenger','depart'].filter(id=>!h.get(id).hidden);
 assert.deepEqual(showing(),['loadBag']);h.get('loadBag').listeners.click();assert.deepEqual(showing(),['boardPassenger']);h.get('boardPassenger').listeners.click();assert.deepEqual(showing(),['depart']);
 h.get('openHangar').listeners.click();assert.equal(view(),'hangar');assert.equal(h.run('trip.boarded'),true,'looking at the plane keeps the flight');h.get('closeHangar').listeners.click();assert.equal(view(),'board');
 h.get('otherPlaces').listeners.click();assert.equal(view(),'pick');assert.equal(h.run('trip'),null);
});
test('takeoff counts three, two, one, go as the plane rolls',()=>{
 const h=harness(),seen=[];h.run("restartAirline();trip=newTrip('sunny','starry');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();");
 for(let i=0;i<141;i++){h.run('updateLanding(.05)');const now=h.get('countdown').textContent;if(now!==seen.at(-1))seen.push(now);}
 assert.deepEqual(seen,['3','2','1','Go!','']);assert.equal(h.run('phase'),'flying');
});
test('a guided trip to Starlight Island lands at Moonbeam Airport and stamps the passport',()=>{
 const h=harness();h.run("restartAirline();trip=newTrip('jungle','starry');currentAirport='jungle';state=parkedAt('jungle');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();");
 h.run("for(let i=0;i<141;i++)updateLanding(.05);setGuided(true);for(let i=0;i<6000&&phase==='flying';i++)updateFlight(.05);");
 assert.equal(h.run('phase'),'landing');assert.equal(h.run('landingAirport'),'starry');
 h.run("for(let i=0;i<281&&phase==='landing';i++)updateLanding(.05)");
 assert.equal(h.run('currentAirport'),'starry');assert.deepEqual(h.run('passport.stamps'),['starry']);assert.match(h.get('arrivalTitle').textContent,/Owl/);
});

test('a guided trip from Sunny Island lands at City Airport, and the next takeoff starts fresh',()=>{
 const h=harness();h.run("restartAirline();trip=newTrip('sunny','city');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();");
 h.run("for(let i=0;i<141;i++)updateLanding(.05);setGuided(true);for(let i=0;i<9000&&phase==='flying';i++)updateFlight(.05);");
 assert.equal(h.run('phase'),'landing');assert.equal(h.run('landingAirport'),'city');
 h.run("for(let i=0;i<281&&phase==='landing';i++)updateLanding(.05)");
 assert.equal(h.run('currentAirport'),'city');assert.deepEqual(h.run('passport.stamps'),['city']);assert.match(h.get('arrivalTitle').textContent,/Giraffe/);
 h.run("trip=newTrip('city','jungle');trip=prepareTrip(prepareTrip(trip,'bag'),'board');leaveAirport();");assert.equal(h.run('airportLeg'),-1);assert.equal(h.get('missionSubtitle').textContent,'Speeding up along the runway');
});
test('with nobody aboard the autopilot follows the round-trip trail from each island to the next',()=>{
 assert.deepEqual(['sunny','snowy','starry','jungle','city'].map(sky.tourFrom),['sunny>snowy','snowy>starry','starry>jungle','jungle>city','city>sunny']);
 const h=harness();h.run(CLOCK+"restartAirline();leaveAirport(true);takeOff();");h.get('guide').listeners.click();h.run("fly(9000)");
 assert.equal(h.run('phase'),'landing');assert.equal(h.run('landingAirport'),'snowy');
});
