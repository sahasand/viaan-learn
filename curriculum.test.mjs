import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('./curriculum-assets/learning.js',import.meta.url),'utf8'),context);
vm.runInContext(html.split('/* CURRICULUM_START */')[1].split('/* CURRICULUM_END */')[0],context);
const {Learning:L,MATH,ENG,CRIT}=context;
const D=L.prepare({math:MATH,eng:ENG,crit:CRIT}), levels=Object.values(D).flat(),questions=levels.flatMap(l=>l.q);
const app=fs.readFileSync(new URL('./curriculum-assets/experience.js',import.meta.url),'utf8');

test('all 196 existing lesson IDs and 980 questions remain available',()=>{
  assert.deepEqual(Object.values(D).map(a=>a.length),[16,160,20]);assert.equal(questions.length,980);
  assert.equal(new Set(levels.map(l=>l.id)).size,196);assert.ok(levels.every(l=>l.q.length===5));
});
test('every choice activity has exactly one correct choice',()=>{
  for(const q of questions.filter(q=>q.ch))assert.equal(q.ch.filter(c=>String(typeof c==='object'?c.v:c)===String(q.a)).length,1,JSON.stringify(q));
});
test('all missing-letter displays reconstruct the intended word with one slot',()=>{
  for(const q of ENG.flatMap(l=>l.q).filter(q=>q.t==='ml')){assert.equal(q.show.split('_').length,2,JSON.stringify(q));assert.equal(q.show.replace('_',q.a),q.w);}
});
test('no rhyme target is its own answer',()=>{for(const q of questions.filter(q=>q.t==='rhy'))assert.notEqual(q.word.toLowerCase(),q.a);});
test('sound-only choices do not ask children to distinguish equivalent spellings',()=>{
  const same=[['ai','ay','a_e'],['ee','ea','ey','e_e'],['ur','ir','er'],['aw','au','or'],['oa','oe','o_e']];
  for(const q of questions.filter(q=>q.t==='snd'))for(const g of same)if(g.includes(q.sound))assert.equal(q.ch.filter(c=>g.includes(c)).length,1);
});
test('all math arithmetic and number trails are consistent',()=>{
  for(const q of MATH.flatMap(l=>l.q)){
    if(q.t==='c')assert.equal(q.a,q.d);
    if(q.t==='ad')assert.equal(q.a,q.x+q.y);
    if(q.t==='b')assert.equal(q.a,Math.max(q.x,q.y));
    if(q.t==='eq'){const [left,right]=q.eq.replace('?',q.a).split('=');const terms=left.match(/(\d+)\s*([+-])\s*(\d+)/);assert.equal(terms[2]==='+'?+terms[1]+ +terms[3]:+terms[1]- +terms[3],+right);}
    if(q.t==='m'){const nums=q.s.map(n=>n==null?q.a:n),delta=nums[1]-nums[0];assert.ok(nums.slice(1).every((n,i)=>n-nums[i]===delta));}
  }
});
test('all thinking questions have useful explanations and grounded scenes',()=>{
  for(const q of CRIT.flatMap(l=>l.q)){assert.ok(L.explanation(q).length>10,JSON.stringify(q));assert.ok(!L.explanation(q).includes('undefined'));if(q.t==='silly'){assert.ok(q.ch.every(c=>c.label&&c.items.length));assert.ok(q.explain);}if(q.t==='next')assert.ok(q.context);if(q.t==='odd')assert.ok(q.group);}
});
test('wrong answer stays unfinished, retry can finish once and remains assisted',()=>{
  const r=L.round();assert.equal(L.attempt(r,false),true);assert.equal(r.done,false);assert.equal(r.assisted,true);assert.equal(r.misses,1);
  assert.equal(L.attempt(r,true),true);assert.equal(r.done,true);assert.equal(L.attempt(r,true),false);assert.equal(L.attempt(r,false),false);assert.equal(r.misses,1);
});
test('completion preserves old scores and distinguishes independence from help',()=>{
  const p=L.progress({m1a:8,__streak:12}),lv=MATH[0],rs=lv.q.map(L.round);
  rs.forEach((r,i)=>{if(i===0)L.attempt(r,false);if(i===1)r.assisted=true;L.attempt(r,true);});
  assert.equal(L.finish(p,lv,rs,'math'),true);assert.equal(p.m1a,8);assert.equal(p.__streak,12);
  assert.equal(p.__learning.levels.m1a.independent,3);assert.equal(p.__learning.levels.m1a.assisted,2);assert.equal(p.__learning.levels.m1a.misses,1);assert.equal(p.__learning.last.id,'m1a');assert.equal(L.completed(p,'m1a'),true);
});
test('incomplete or abandoned lesson cannot earn a badge',()=>{
  const p=L.progress('{}');assert.equal(L.finish(p,MATH[0],MATH[0].q.map(L.round),'math'),false);assert.equal(L.completed(p,'m1a'),false);
});
test('all-assisted lesson earns completion without inventing independent points',()=>{
  const p=L.progress('{}'),rs=MATH[0].q.map(L.round);rs.forEach(r=>{r.assisted=true;L.attempt(r,true);});L.finish(p,MATH[0],rs,'math');assert.equal(p.m1a,0);assert.equal(L.completed(p,'m1a'),true);assert.equal(L.frontier(MATH,p),1);
});
test('legacy badges survive and malformed storage recovers safely',()=>{
  assert.equal(L.completed(L.progress('{"m1a":2}'),'m1a'),true);
  for(const value of ['null','[]','oops','{"__learning":{"levels":null}}','{"__learning":[]}'])assert.equal(typeof L.progress(value).__learning.levels,'object');
});
test('word-building pools contain every required tile with sufficient duplicates',()=>{
  for(const q of questions.filter(q=>q.t==='wb')){const parts=q.ph||context.WPH[q.w]||q.w.split(''),pool=[...(q.pool||parts)];for(const part of parts){const i=pool.indexOf(part);assert.notEqual(i,-1,q.w+': '+part);pool.splice(i,1);}}
});
test('referenced original artwork exists and no remote image assets are needed',()=>{
  for(const name of 'apple car fish seed sprout flower tree cup ball cookie book blocks hat ice cloud egg bear owl frog panda'.split(' ')){assert.ok(fs.existsSync(new URL(L.artPath(name),import.meta.url)));}
  assert.ok(!app.includes('https://'));
});
test('ten-frames represent every counter, including quantities greater than ten',()=>{
  const fn=app.slice(app.indexOf('function frames('),app.indexOf('function countObjects('));const ctx=vm.createContext({});vm.runInContext(fn,ctx);
  for(const n of [1,5,10,12,15,20,25,30]){const markup=ctx.frames(n);assert.equal((markup.match(/filled mint/g)||[]).length,n);assert.equal((markup.match(/class="ten-frame"/g)||[]).length,Math.ceil(n/10));}
});
test('every curriculum question type has a renderer',()=>{
  for(const t of new Set(questions.map(q=>q.t)))assert.ok(app.includes("case '"+t+"':"),t);
});
// Exercise the actual cancellation implementation with delayed media callbacks.
function audioHarness(){
  const sounds=[],tasks=[],elements=[];let speechCancelled=0;
  const ctx=vm.createContext({p:{},root:{speechSynthesis:{cancel(){speechCancelled++;}}},document:{querySelectorAll(){return elements;}},setTimeout(fn){tasks.push(fn);return tasks.length;},clearTimeout(){},Audio:class{constructor(src){this.src=src;sounds.push(this);}pause(){this.paused=true;}play(){return Promise.resolve();}}});
  const from=app.indexOf('function stopAudio()'),to=app.indexOf('function go(');
  vm.runInContext('let audio=null,audioToken=0,timer=null;'+app.slice(from,to),ctx);return {ctx,sounds,tasks,get cancelled(){return speechCancelled;}};
}
test('navigation cancels audio and stale endings cannot start another clip',()=>{
  const h=audioHarness();h.ctx.clips(['phon_C','phon_A','phon_T']);const old=h.sounds[0],end=old.onended;h.ctx.stopAudio();end();h.tasks.forEach(fn=>fn());assert.equal(h.sounds.length,1);assert.equal(old.paused,true);assert.equal(old.onended,null);
});
test('rapid replay cancels the previous phoneme sequence',()=>{
  const h=audioHarness();h.ctx.clips(['phon_C','phon_A']);const end=h.sounds[0].onended;h.ctx.clips(['word_cat']);end();h.tasks.forEach(fn=>fn());assert.equal(h.sounds.length,2);assert.ok(h.sounds[1].src.endsWith('word_cat.mp3'));
});
