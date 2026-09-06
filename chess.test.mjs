import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Chess} from './chess-assets/chess.mjs';
import {LESSONS,lessonBoard,lessonMoves,dangerSquares,validBadges,earnBadge,newPractice,suggestMove,teddyMove,gameStatus,practiceBoard,moveExplanation,position} from './chess-assets/learning.mjs';
import {createClub} from './chess-assets/game.mjs';

function harness(stored=null){
 const els=new Map(),timers=new Map();let next=1;const saved=new Map(stored?[['viaan-chess-club-v1',stored]]:[]);
 function el(){const cls=new Set(),attrs={},listeners={};return {hidden:false,open:false,disabled:false,innerHTML:'',textContent:'',children:[],style:{},classList:{add:c=>cls.add(c),toggle:(c,f)=>f?cls.add(c):cls.delete(c),contains:c=>cls.has(c)},setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],addEventListener:(k,f)=>listeners[k]=f,appendChild(n){this.children.push(n);},focus(){},showModal(){this.open=true;},close(){this.open=false;},click(){listeners.click?.({});}};}
 const document={getElementById(id){if(!els.has(id))els.set(id,el());return els.get(id);},createElement:el};
 const club=createClub({document,storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},schedule:fn=>{const id=next++;timers.set(id,fn);return id;},cancel:id=>timers.delete(id),rng:()=>0});
 return {...club,els,timers,saved,flush(){const pending=[...timers.entries()];for(const [id,fn] of pending){timers.delete(id);fn();}}};
}

test('all eighteen distinct lessons have reachable one-move goals and local piece artwork',()=>{
 assert.equal(LESSONS.length,6);assert.equal(new Set(LESSONS.map(l=>l.type)).size,6);
 for(const l of LESSONS){assert.equal(l.tasks.length,3);assert.ok(readFileSync(new URL('./pieces/w'+l.type+'.svg',import.meta.url)).length>0);l.tasks.forEach((t,i)=>{assert.ok(lessonMoves(lessonBoard(l,i),t.from).includes(t.target),l.id+' challenge '+i);});}
});
test('rook and bishop cannot jump through a friend or an enemy',()=>{
 const r=lessonBoard(LESSONS[0],1);assert.ok(!lessonMoves(r,'d4').includes('d7'));assert.ok(!lessonMoves(r,'d4').includes('d6'));
 const b=lessonBoard(LESSONS[1],2);assert.ok(lessonMoves(b,'c3').includes('f6'));assert.ok(!lessonMoves(b,'c3').includes('g7'));
});
test('knight jumps over surrounding friends but cannot land on one',()=>{
 const b=lessonBoard(LESSONS[3],1);assert.ok(lessonMoves(b,'d4').includes('f5'));const {r,c}=position('f5');b[r][c]='wP';assert.ok(!lessonMoves(b,'d4').includes('f5'));
});
test('king challenge rejects attacked squares and shows the threat',()=>{
 const b=lessonBoard(LESSONS[4],1);assert.ok(dangerSquares(b).includes('d5'));assert.ok(!lessonMoves(b,'d4').includes('d5'));assert.ok(lessonMoves(b,'d4').includes('e4'));
});
test('pawn lessons distinguish straight movement from diagonal captures',()=>{
 const b=lessonBoard(LESSONS[5],2);assert.deepEqual(lessonMoves(b,'d4').sort(),['d5','e5']);b[3][3]='bP';assert.ok(!lessonMoves(b,'d4').includes('d5'));
});
test('badges validate storage and never duplicate completions',()=>{
 assert.deepEqual(validBadges('rook'),[]);assert.deepEqual(validBadges(['rook','rook','bogus']),['rook']);assert.deepEqual(earnBadge(['rook'],'rook'),['rook']);const h=harness('{bad json');assert.deepEqual(h.state.badges,[]);
});
test('practice starts with the normal 32 pieces and legal moves',()=>{
 const g=newPractice();assert.equal(practiceBoard(g).flat().filter(Boolean).length,32);assert.equal(g.moves().length,20);assert.throws(()=>g.move({from:'e2',to:'e5'}));
});
test('practice prevents a pinned piece exposing the king',()=>{
 const g=new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');assert.ok(!g.moves({square:'e2',verbose:true}).some(m=>m.to==='d2'));
});
test('practice ends by checkmate with both kings still on the board',()=>{
 const g=newPractice();['f3','e5','g4','Qh4#'].forEach(m=>g.move(m));assert.equal(gameStatus(g).title,'Checkmate!');assert.equal(gameStatus(g).over,true);assert.equal(g.board().flat().filter(p=>p?.type==='k').length,2);
});
test('stalemate is a draw, not a win for the side with moves',()=>{
 const g=new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');assert.equal(g.isStalemate(),true);assert.match(gameStatus(g).text,/stalemate/);assert.equal(gameStatus(g).over,true);
});
test('practice allows castling and explains that both pieces move',()=>{
 const g=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const m=g.move('O-O');assert.equal(g.get('f1').type,'r');assert.equal(g.get('g1').type,'k');assert.match(moveExplanation(m),/king and rook/);
});
test('en passant removes the passed pawn and is explained',()=>{
 const g=newPractice();['e4','a6','e5','d5'].forEach(m=>g.move(m));const m=g.move('exd6');assert.equal(g.get('d5'),undefined);assert.match(moveExplanation(m),/En passant/);
});
test('hints and Teddy suggest legal moves without changing board, history or repetition state',()=>{
 const g=newPractice();['Nf3','Nf6','Ng1','Ng8'].forEach(m=>g.move(m));const before=g.fen(),history=g.history();for(const fn of [suggestMove,teddyMove]){const m=fn(g,()=>0);assert.ok(g.moves().includes(m.san));assert.equal(g.fen(),before);assert.deepEqual(g.history(),history);assert.equal(g.isThreefoldRepetition(),false);}
});
test('lesson wrong move gives guidance without moving or awarding progress',()=>{
 const h=harness();h.startLesson(0);const before=JSON.stringify(h.state.board);h.tap('d4');h.tap('e5');assert.equal(JSON.stringify(h.state.board),before);assert.equal(h.state.done,false);assert.equal(h.state.badges.length,0);
 h.tap('e4');assert.match(h.els.get('coachTitle').textContent,/works/);assert.equal(h.state.done,false);
});
test('all three completed challenges award and persist one badge; a replay does not duplicate it',()=>{
 const h=harness();for(let round=0;round<2;round++){h.startLesson(0);for(let i=0;i<3;i++){const t=LESSONS[0].tasks[i];h.tap(t.from);h.tap(t.target);assert.equal(h.state.done,true);h.nextLessonStep();}assert.deepEqual(h.state.badges,['rook']);}
 assert.deepEqual(JSON.parse(h.saved.get('viaan-chess-club-v1')),['rook']);assert.equal(h.els.get('badgeDialog').open,true);
});
test('square labels expose piece, position and goal; selection adds available moves',()=>{
 const h=harness();h.startLesson(0);assert.match(h.cells.get('d4').getAttribute('aria-label'),/white Rook/);assert.match(h.cells.get('d7').getAttribute('aria-label'),/star goal/);h.tap('d4');assert.match(h.cells.get('d7').getAttribute('aria-label'),/possible move/);
});
test('undo before Teddy moves cancels its callback; a stale callback cannot touch a new game',()=>{
 const h=harness();h.startPractice();h.makeMove({from:'e2',to:'e4'});assert.equal(h.timers.size,1);const pending=[...h.timers.values()][0];h.undo();assert.equal(h.timers.size,0);assert.equal(h.state.engine.history().length,0);h.startLesson(0);const before=JSON.stringify(h.state.board);pending();assert.equal(JSON.stringify(h.state.board),before);
});
test('undo after Teddy moves returns both turns; two-player undo returns just one',()=>{
 const h=harness();h.startPractice();h.makeMove({from:'e2',to:'e4'});h.flush();assert.equal(h.state.engine.history().length,2);h.undo();assert.equal(h.state.engine.history().length,0);assert.equal(h.state.engine.turn(),'w');h.startPractice('together');h.makeMove({from:'e2',to:'e4'});h.makeMove({from:'e7',to:'e5'});h.undo();assert.equal(h.state.engine.history().length,1);assert.equal(h.state.engine.turn(),'b');
});
test('home cancels AI work and preserves completed badges',()=>{
 const h=harness('["rook"]');h.startPractice();h.makeMove({from:'d2',to:'d4'});h.home();assert.equal(h.timers.size,0);assert.equal(h.state.screen,'home');assert.deepEqual(h.state.badges,['rook']);
});
test('promotion waits for the child to choose and applies the chosen piece',()=>{
 const h=harness();h.startPractice('together');h.state.engine.load('7k/P7/8/8/8/8/8/7K w - - 0 1');h.tap('a7');h.tap('a8');assert.equal(h.els.get('promotionDialog').open,true);assert.equal(h.state.engine.get('a7').type,'p');const opts=h.els.get('promotionOptions').children;assert.equal(opts.length,4);opts[0].click();assert.equal(h.state.engine.get('a8').type,'q');assert.equal(h.els.get('promotionDialog').open,false);
});
test('practice refuses interaction during Teddy turn and allows undo after checkmate',()=>{
 const h=harness();h.startPractice();h.makeMove({from:'e2',to:'e4'});h.tap('d7');assert.equal(h.state.selected,null);h.startPractice('together');['f3','e5','g4','Qh4#'].forEach(m=>h.state.engine.move(m));h.undo();assert.equal(h.state.engine.isGameOver(),false);assert.equal(h.state.engine.history().length,3);
});

test('two-player pawn coaching describes black moving down the board',()=>{
 const h=harness();h.startPractice('together');h.makeMove({from:'e2',to:'e4'});h.tap('e7');assert.match(h.els.get('coachText').textContent,/Black pawns move down/);
});
