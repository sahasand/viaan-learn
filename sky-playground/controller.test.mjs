import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as flight from './flight.js';
import * as airline from './airline.js';
const code=readFileSync(new URL('./game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/init\(\);\s*$/,'');
class Vec {constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){return this.set(v.x,v.y,v.z);}lerp(v){return this.copy(v);}setScalar(){return this;}}
function harness(){
 const els={},events={};
 function element(id){const classes=new Set();return {id,open:false,hidden:false,disabled:false,style:{},dataset:{},children:[],textContent:'',innerHTML:'',listeners:{},classList:{add(c){classes.add(c);},remove(c){classes.delete(c);},toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},setAttribute(){},querySelectorAll(){return [];},getContext(){return {};},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}};}
 const get=id=>els[id]||(els[id]=element(id));
 class Mesh {constructor(g,m){this.geometry=g;this.material=m;this.position=new Vec();this.scale=new Vec();this.userData={};}}
 const ctx=vm.createContext({...flight,...airline,console,innerWidth:1280,innerHeight:720,performance:{now:()=>0},matchMedia:()=>({matches:true}),localStorage:{getItem:()=>null,setItem(k,v){events.saved={k,v};}},window:{addEventListener(n,fn){events[n]=fn;}},document:{body:{dataset:{}},getElementById:get,querySelector:s=>get(s),querySelectorAll:()=>[],addEventListener(n,fn){events[n]=fn;}},THREE:{Vector3:Vec,SphereGeometry:class{},Mesh,MeshStandardMaterial:class{constructor(o){Object.assign(this,o);}}}});
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
