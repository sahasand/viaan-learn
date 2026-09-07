// Airline journeys and world coordinates, independent of rendering and storage.
import { clamp, groundHeight, RUNWAY, AIRPORT_APPROACH, runwayLanding } from './flight.js';
export const AIRPORTS = [
  { id:'sunny', name:'Sunny Island', airport:'Sunny Airport', x:0, z:0, icon:'☀', color:'#edd28b', animal:'panda', passenger:'Panda', wish:'a day at the beach', asset:'sunny-island' },
  { id:'snowy', name:'Snowy Mountain', airport:'Snowflake Airport', x:-235, z:-190, icon:'❄', color:'#c5deeb', animal:'penguin', passenger:'Penguin', wish:'a snowy holiday', asset:'snowy-island' },
  { id:'jungle', name:'Jungle Bay', airport:'Jungle Airport', x:235, z:-180, icon:'❀', color:'#b3d7a1', animal:'frog', passenger:'Frog', wish:'a jungle picnic', asset:'jungle-island' }
];
export const SPEEDS = { slow:8, cruise:13, fast:19 };
export const airportById = id => AIRPORTS.find(a=>a.id===id) || AIRPORTS[0];
export function airportRunway(id) {
  const a=airportById(id); return {...RUNWAY,x:RUNWAY.x+a.x,touchdownZ:RUNWAY.touchdownZ+a.z,stopZ:RUNWAY.stopZ+a.z};
}
export function approachFor(id) { const a=airportById(id);return AIRPORT_APPROACH.map(p=>({...p,x:p.x+a.x,z:p.z+a.z})); }
export function parkedAt(id) { const r=airportRunway(id);return {x:r.x,y:r.parkedY,z:r.stopZ,heading:0,turn:0,climb:0,speed:0,returning:false}; }
export function worldGroundHeight(x,z) { return Math.max(...AIRPORTS.map(a=>groundHeight(x-a.x,z-a.z))); }
export function worldObstacles(local) {return AIRPORTS.flatMap(a=>local.map(o=>({...o,x:o.x+a.x,z:o.z+a.z})));}
export function nearestAirport(state) {return AIRPORTS.reduce((best,a)=>Math.hypot(state.x-a.x,state.z-a.z)<Math.hypot(state.x-best.x,state.z-best.z)?a:best).id;}
export function newTrip(origin,destination) {
  if(!AIRPORTS.some(a=>a.id===origin)||!AIRPORTS.some(a=>a.id===destination)||origin===destination)return null;
  return {origin,destination,bag:false,boarded:false,status:'boarding'};
}
export function prepareTrip(trip,action) {
  if(!trip || trip.status!=='boarding')return trip;
  if(action==='bag')return {...trip,bag:true};
  if(action==='board'&&trip.bag)return {...trip,boarded:true};
  if(action==='depart'&&trip.bag&&trip.boarded)return {...trip,status:'flying'};
  return trip;
}
export function arriveTrip(trip,airport) {return trip?.status==='flying'&&trip.destination===airport?{...trip,status:'arrived'}:trip;}
export function normalizePassport(raw) {
  let p;try{p=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
  return {stamps:[...new Set(Array.isArray(p?.stamps)?p.stamps.filter(id=>AIRPORTS.some(a=>a.id===id)):[])],trips:Number.isSafeInteger(p?.trips)&&p.trips>=0?p.trips:0};
}
export function stampArrival(passport,before,after) {
  if(before?.status!=='flying'||after?.status!=='arrived'||before.destination!==after.destination)return passport;
  return {...passport,stamps:[...new Set([...passport.stamps,after.destination])],trips:passport.trips+1};
}
// Eight seconds to gently steer the approach, then six seconds of runway rollout.
// Steering has real lateral/height effects. The narrowing corridor guarantees a safe touchdown.
export function assistedLanding(start,previous,seconds,dt,input,runway) {
  const t=clamp(seconds/8,0,1),base=runwayLanding(start,seconds<=8?seconds*5/8:seconds-3,runway);
  if (seconds < 8) base.speed = Math.abs(start.z-runway.touchdownZ)/8;
  const delta=clamp(dt,0,.05),fade=1-t;
  const x=clamp((previous.manualX||0)+clamp(input.x,-1,1)*3.5*delta-(previous.manualX||0)*1.4*delta,-4*fade,4*fade);
  const y=clamp((previous.manualY||0)+clamp(input.y,-1,1)*2*delta-(previous.manualY||0)*1.4*delta,-1.5*fade,1.5*fade);
  return {...base,x:base.x+x,y:Math.max(runway.parkedY,base.y+y),turn:seconds<8?clamp(input.x,-1,1)*.45*fade:0,manualX:x,manualY:y,finished:seconds>=14};
}
