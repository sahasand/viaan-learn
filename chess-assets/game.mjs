import {PIECES,LESSONS,hintPath,square,position,lessonBoard,lessonMoves,dangerSquares,validBadges,earnBadge,pieceSrc,pieceName,newPractice,practiceBoard,legalPracticeMoves,suggestMove,teddyMove,gameStatus,moveExplanation} from './learning.mjs';

export function createClub({document:doc,storage=null,schedule=setTimeout,cancel=clearTimeout,voice=null,utterance=null,rng=Math.random}={}){
 const $=id=>doc.getElementById(id);
 let badges=[];try{badges=validBadges(JSON.parse(storage?.getItem('viaan-chess-club-v1')));}catch{}
 const S={screen:'home',mode:'lesson',partner:'teddy',lesson:0,step:0,board:null,engine:newPractice(),selected:null,moves:[],last:null,hint:null,done:false,badges,pending:null,epoch:0,promotion:null,confirm:null,focus:'a8'};
 const cells=new Map();
 function stopVoice(){voice?.cancel();}
 function stopPending(){if(S.pending!==null)cancel(S.pending);S.pending=null;S.epoch++;stopVoice();}
 function save(){try{storage?.setItem('viaan-chess-club-v1',JSON.stringify(S.badges));}catch{}}
 function closeDialogs(){['badgeDialog','confirmDialog','promotionDialog'].forEach(id=>{if($(id).open)$(id).close();});S.promotion=null;}
 function show(screen){S.screen=screen;$('home').hidden=screen!=='home';$('play').hidden=screen!=='play';if(doc.defaultView?.scrollTo)doc.defaultView.scrollTo(0,0);}
 function say(title,text){$('coachTitle').textContent=title;$('coachText').textContent=text;}
 function rule(type,color='w'){return type==='P'&&color==='b'?PIECES.P.rule.replace('White pawns move up','Black pawns move down'):PIECES[type].rule;}
 function guide(type,color='w'){$('guideImg').src=pieceSrc(color+type);$('guideText').textContent=rule(type,color);}
 function renderHome(){
  $('badgeCount').textContent=S.badges.length+' / 6 badges';$('lessonGrid').innerHTML='';
  LESSONS.forEach((l,i)=>{const earned=S.badges.includes(l.id),b=doc.createElement('button');b.className='lesson-card'+(earned?' earned':'');b.setAttribute('aria-label',PIECES[l.type].name+' lessons'+(earned?', badge earned':''));b.innerHTML='<span class="number" aria-hidden="true">0'+(i+1)+'</span><img src="'+pieceSrc('w'+l.type)+'" alt=""><strong>'+PIECES[l.type].name+'</strong><small>'+(earned?'Badge earned':'3 little challenges')+'</small>'+(earned?'<span class="badge" aria-hidden="true">✦</span>':'');b.addEventListener('click',()=>startLesson(i));$('lessonGrid').appendChild(b);});
  const next=LESSONS.find(l=>!S.badges.includes(l.id));$('startLearning').textContent=next?'Meet the '+PIECES[next.type].name.toLowerCase()+' →':'Play the piece challenges →';
 }
 function home(){stopPending();closeDialogs();show('home');renderHome();$('startLearning').focus({preventScroll:true});}
 function buildGrid(){
  $('board').innerHTML='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const sq=square(r,c),b=doc.createElement('button');b.className='sq '+((r+c)%2?'dk':'lt');b.type='button';b.setAttribute('data-square',sq);b.addEventListener('click',()=>tap(sq));b.addEventListener('keydown',e=>{const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(!delta)return;e.preventDefault();const y=Math.max(0,Math.min(7,r+delta[0])),x=Math.max(0,Math.min(7,c+delta[1]));focusSquare(square(y,x));});$('board').appendChild(b);cells.set(sq,b);}
 }
 function focusSquare(sq){S.focus=sq;cells.forEach((b,k)=>b.tabIndex=k===sq?0:-1);cells.get(sq)?.focus({preventScroll:true});}
 function renderBoard(){
  const task=S.mode==='lesson'?LESSONS[S.lesson].tasks[S.step]:null;
  const danger=S.mode==='lesson'&&LESSONS[S.lesson].type==='K'?dangerSquares(S.board):[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const sq=square(r,c),p=S.board[r][c],b=cells.get(sq),legal=S.moves.includes(sq),target=task?.target===sq&&!S.done;
   b.innerHTML=(p?'<img class="piece" src="'+pieceSrc(p)+'" alt="" draggable="false">':'')+'<span class="coord" aria-hidden="true">'+(r===7?(c===0?sq:sq[0]):c===0?sq[1]:'')+'</span>';
   b.classList.toggle('success',false);b.tabIndex=S.focus===sq?0:-1;b.classList.toggle('selected',S.selected===sq);b.classList.toggle('legal',legal);b.classList.toggle('occupied',!!p);b.classList.toggle('target',target);b.classList.toggle('danger',danger.includes(sq));b.classList.toggle('last',!!S.last&&(S.last.from===sq||S.last.to===sq));b.classList.toggle('hint',!!S.hint&&(S.hint.from===sq||S.hint.to===sq));b.classList.toggle('check',S.mode==='practice'&&p===S.engine.turn()+'K'&&S.engine.isCheck());
   b.setAttribute('aria-label',sq+(p?', '+(p[0]==='w'?'white ':'black ')+pieceName(p[1]):', empty')+(target?', star goal':'')+(legal?', possible move':'')+(danger.includes(sq)?', attacked square':'')+(S.selected===sq?', selected':''));
  }
  const hintType=S.mode==='lesson'?LESSONS[S.lesson].type:S.hint?.piece;
  $('movePath').innerHTML=S.hint?'<defs><marker id="arrowTip" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6Z" fill="#9c6514"/></marker></defs><polyline points="'+hintPath(S.hint.from,S.hint.to,hintType)+'" fill="none" stroke="#9c6514" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="13 12" marker-end="url(#arrowTip)" opacity=".8"/>':'';
 }
 function startLesson(index,step=0){
  stopPending();closeDialogs();S.mode='lesson';S.lesson=index;S.step=step;S.board=lessonBoard(LESSONS[index],step);S.selected=null;S.moves=[];S.last=null;S.hint=null;S.done=false;S.focus=LESSONS[index].tasks[step].from;
  const l=LESSONS[index],p=PIECES[l.type];$('modePick').hidden=true;$('undoBtn').hidden=true;$('nextBtn').hidden=true;$('hintBtn').disabled=false;$('moveNote').hidden=true;$('captureTray').hidden=true;$('gameTitle').textContent='Meet the '+p.name.toLowerCase();$('gameEyebrow').textContent='Piece '+(index+1)+' of 6';$('gameSubtitle').textContent=p.tag;$('boardCaption').textContent='A movement puzzle. Find the star.';$('turnLabel').textContent=(step+1)+' / 3';$('taskDots').hidden=false;$('taskDots').innerHTML=l.tasks.map((_,i)=>'<span class="task-dot '+(i<step?'complete':i===step?'current':'')+'"></span>').join('');$('taskDots').setAttribute('aria-label','Challenge '+(step+1)+' of 3');$('legend').innerHTML='<b>★</b> Your goal &nbsp; · &nbsp; <b>●</b> A move you can make<br>Tap your piece, then tap the star.';say('Little challenge '+(step+1),l.tasks[step].prompt);guide(l.type);show('play');renderBoard();focusSquare(S.focus);
 }
 function lessonTap(sq){
  if(S.done)return;const l=LESSONS[S.lesson],t=l.tasks[S.step];
  if(sq===t.from){S.selected=sq;S.moves=lessonMoves(S.board,sq);say('Where can I go?',t.prompt);renderBoard();return;}
  if(!S.selected){say('First, choose your '+PIECES[l.type].name.toLowerCase(),'Tap the white '+PIECES[l.type].name.toLowerCase()+'. Then look for the star.');return;}
  if(!S.moves.includes(sq)){say('Let’s look together',PIECES[l.type].rule+' Try one of the dots.');return;}
  if(sq!==t.target){say('That move works!', 'For this challenge, find the move that lands on the star.');return;}
  const from=position(t.from),to=position(sq);S.board[to.r][to.c]=S.board[from.r][from.c];S.board[from.r][from.c]=null;S.last={from:t.from,to:sq};S.moves=[];S.selected=null;S.hint=null;S.done=true;$('hintBtn').disabled=true;renderBoard();say('You did it!','You found the '+PIECES[l.type].name.toLowerCase()+'’s move. '+(S.step<2?'Ready for one more little challenge?':'Three challenges finished. Your badge is ready!'));$('nextBtn').hidden=false;$('nextBtn').textContent=S.step<2?'Next little challenge →':'Collect my badge ✦';cells.get(sq).classList.add('success');$('nextBtn').focus({preventScroll:true});
 }
 function nextLessonStep(){if(!S.done)return;if(S.step<2){startLesson(S.lesson,S.step+1);return;}const l=LESSONS[S.lesson];S.badges=earnBadge(S.badges,l.id);save();$('badgeImg').src=pieceSrc('w'+l.type);$('badgeTitle').textContent=PIECES[l.type].name+' explorer!';$('badgeText').textContent='You tried all three challenges. '+S.badges.length+' of 6 piece badges collected.';$('nextPieceBtn').textContent=S.lesson<5?'Meet the '+PIECES[LESSONS[S.lesson+1].type].name.toLowerCase()+' →':'Try a practice game →';$('badgeDialog').showModal();}
 function startPractice(partner='teddy'){
  stopPending();closeDialogs();S.mode='practice';S.partner=partner;S.engine=newPractice();S.selected=null;S.moves=[];S.last=null;S.hint=null;S.done=false;S.focus='e2';$('modePick').hidden=false;$('modeTeddy').setAttribute('aria-pressed',String(partner==='teddy'));$('modeTogether').setAttribute('aria-pressed',String(partner==='together'));$('undoBtn').hidden=false;$('nextBtn').hidden=true;$('taskDots').hidden=true;$('captureTray').hidden=false;$('gameTitle').textContent='Let’s play chess';$('gameEyebrow').textContent='Practice together';$('gameSubtitle').textContent='Real chess. Room to try.';$('boardCaption').textContent='White at the bottom · black at the top';$('legend').innerHTML='<b>●</b> A legal move &nbsp; · &nbsp; <b>○</b> A capture<br>Keep your king safe. You can undo and try again.';guide('P');show('play');renderPractice();focusSquare('e2');
 }
 function renderPractice(note=''){
  S.board=practiceBoard(S.engine);const status=gameStatus(S.engine),thinking=S.partner==='teddy'&&S.engine.turn()==='b'&&!status.over;
  $('turnLabel').textContent=S.partner==='teddy'?(S.engine.turn()==='w'?'Your turn · white':'Teddy · black'):(S.engine.turn()==='w'?'White’s turn':'Black’s turn');
  say(thinking?'Teddy is thinking…':status.title,thinking?'Watch the black pieces. Then it is your turn again.':status.text);
  $('hintBtn').disabled=status.over||thinking;$('undoBtn').disabled=S.engine.history().length===0;
  $('moveNote').hidden=!note;if(note)$('moveNote').textContent=note;
  $('captureTray').innerHTML=S.engine.history({verbose:true}).filter(m=>m.captured).map(m=>'<img src="'+pieceSrc((m.color==='w'?'b':'w')+m.captured.toUpperCase())+'" alt="Captured '+pieceName(m.captured)+'">').join('');renderBoard();
 }
 function tap(sq){
  if(S.screen!=='play'||$('confirmDialog').open||$('promotionDialog').open||$('badgeDialog').open)return;
  S.focus=sq;if(S.mode==='lesson'){lessonTap(sq);return;}
  const game=S.engine;if(game.isGameOver()||(S.partner==='teddy'&&game.turn()==='b'))return;
  if(S.selected&&S.moves.includes(sq)){
   const choices=legalPracticeMoves(game,S.selected).filter(m=>m.to===sq);
   if(choices.some(m=>m.promotion)){S.promotion={from:S.selected,to:sq};$('promotionOptions').innerHTML='';['q','r','b','n'].forEach(type=>{const b=doc.createElement('button');b.innerHTML='<img src="'+pieceSrc(game.turn()+type.toUpperCase())+'" alt=""><span>'+pieceName(type)+'</span>';b.setAttribute('aria-label','Promote to '+pieceName(type));b.addEventListener('click',()=>{const mv={...S.promotion,promotion:type};$('promotionDialog').close();S.promotion=null;makeMove(mv);});$('promotionOptions').appendChild(b);});$('promotionDialog').showModal();return;}
   makeMove({from:S.selected,to:sq});return;
  }
  const p=game.get(sq);
  if(p&&p.color===game.turn()){S.selected=sq;S.hint=null;S.moves=[...new Set(legalPracticeMoves(game,sq).map(m=>m.to))];guide(p.type.toUpperCase(),p.color);say('Your '+pieceName(p.type).toLowerCase(),S.moves.length?rule(p.type.toUpperCase(),p.color):'This piece has no safe move right now. Try another piece.');renderBoard();}
  else{say('Try one of the dots',game.isCheck()?'Your king needs help. Choose a move that gets it out of check.':'Choose your piece first, then tap a dot to move it.');}
 }
 function makeMove(move){
  let result;try{result=S.engine.move(move);}catch{return false;}if(!result)return false;
  S.last={from:result.from,to:result.to};S.selected=null;S.moves=[];S.hint=null;renderPractice(moveExplanation(result));
  if(S.partner==='teddy'&&S.engine.turn()==='b'&&!S.engine.isGameOver()){const epoch=S.epoch;S.pending=schedule(()=>{S.pending=null;if(epoch!==S.epoch||S.screen!=='play'||S.mode!=='practice'||S.partner!=='teddy'||S.engine.turn()!=='b'||S.engine.isGameOver())return;const mv=teddyMove(S.engine,rng);if(mv)makeMove(mv);},850);}return true;
 }
 function undo(){
  if(S.mode!=='practice'||!S.engine.history().length)return;stopPending();closeDialogs();S.engine.undo();if(S.partner==='teddy'&&S.engine.turn()==='b'&&S.engine.history().length)S.engine.undo();S.selected=null;S.moves=[];S.hint=null;const last=S.engine.history({verbose:true}).at(-1);S.last=last?{from:last.from,to:last.to}:null;renderPractice('All right — try another idea.');
 }
 function hint(){
  if(S.mode==='lesson'){if(S.done)return;const t=LESSONS[S.lesson].tasks[S.step];S.selected=t.from;S.moves=lessonMoves(S.board,t.from);S.hint={from:t.from,to:t.target};say('Follow the star',t.prompt);renderBoard();return;}
  if(S.engine.isGameOver()||(S.partner==='teddy'&&S.engine.turn()==='b'))return;const mv=suggestMove(S.engine,rng);if(!mv)return;S.selected=mv.from;S.moves=[...new Set(legalPracticeMoves(S.engine,mv.from).map(m=>m.to))];S.hint=mv;guide(mv.piece.toUpperCase(),mv.color);say('Here’s one idea','Try your '+pieceName(mv.piece).toLowerCase()+' from '+mv.from+' to '+mv.to+'. The gold outlines show the two squares.');renderBoard();
 }
 function confirm(action,title,text){S.confirm=action;$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmYes').textContent='Yes, let’s go →';$('confirmDialog').showModal();}
 function changePartner(partner){if(partner===S.partner)return;confirm(()=>startPractice(partner),'Change your practice partner?','This starts a new board. You can keep playing this one instead.');}
 function restart(){confirm(()=>S.mode==='lesson'?startLesson(S.lesson,S.step):startPractice(S.partner),'Try this board again?','Your piece badges are saved. This board will start fresh.');}
 function speak(){if(!voice||!utterance)return;stopVoice();const line=new utterance($('coachTitle').textContent+'. '+$('coachText').textContent);line.lang='en-US';line.rate=.85;voice.speak(line);}
 $('speakBtn').hidden=!voice||!utterance;$('speakBtn').addEventListener('click',speak);
 $('startLearning').addEventListener('click',()=>{const n=LESSONS.findIndex(l=>!S.badges.includes(l.id));startLesson(n<0?0:n);});$('startPractice').addEventListener('click',()=>startPractice());$('nextBtn').addEventListener('click',nextLessonStep);$('nextPieceBtn').addEventListener('click',()=>S.lesson<5?startLesson(S.lesson+1):startPractice());$('badgeHome').addEventListener('click',home);$('badgeDialog').addEventListener('cancel',()=>home());$('clubBtn').addEventListener('click',()=>S.mode==='practice'&&S.engine.history().length?confirm(home,'Back to the club?','This practice game will finish. Your badges are saved.'):home());$('restartBtn').addEventListener('click',restart);$('modeTeddy').addEventListener('click',()=>changePartner('teddy'));$('modeTogether').addEventListener('click',()=>changePartner('together'));$('hintBtn').addEventListener('click',hint);$('undoBtn').addEventListener('click',undo);$('confirmYes').addEventListener('click',()=>{const action=S.confirm;S.confirm=null;$('confirmDialog').close();action?.();});$('confirmNo').addEventListener('click',()=>{$('confirmDialog').close();S.confirm=null;});$('promotionCancel').addEventListener('click',()=>{$('promotionDialog').close();S.promotion=null;});$('promotionDialog').addEventListener('cancel',()=>{S.promotion=null;});
 buildGrid();renderHome();
 return {state:S,cells,startLesson,startPractice,tap,makeMove,undo,hint,home,nextLessonStep};
}
if(typeof document!=='undefined'){
 let storage=null;try{storage=window.localStorage;}catch{}
 createClub({document,storage,voice:window.speechSynthesis,utterance:window.SpeechSynthesisUtterance});
}
