/* Child-facing experience. Curriculum content remains in index.html. */
(function (root) {
  'use strict';
  root.LearningApp = { start };
  function start(source) {
    const L = root.Learning, E = L.escape, D = L.prepare({math:source.MATH, eng:source.ENG, crit:source.CRIT});
    let raw; try { raw = localStorage.getItem('vla4'); } catch (_) {}
    const p = L.progress(raw);
    const state = {world:'math', index:0, qi:0, rounds:[], group:1, adventure:null, hint:0, build:null};
    const $ = id => document.getElementById(id);
    let audio = null, audioToken = 0, timer = null, focusReturn = null;
    const save = () => { try { localStorage.setItem('vla4', JSON.stringify(p)); } catch (_) {} };
    const level = () => D[state.world][state.index];
    const question = () => level().q[state.qi];
    const round = () => state.rounds[state.qi];
    const phonId = s => 'phon_' + (s === 'eer' ? 'ear' : s.length === 1 ? s.toUpperCase() : s);
    const wordId = s => 'word_' + s.replace(/[^a-zA-Z]/g,'_');
    const art = (name, cls='') => L.artPath(name) ? '<img class="toy '+cls+'" src="'+L.artPath(name)+'" alt="" draggable="false">' : '<span class="symbol '+cls+'" aria-hidden="true">'+E(source.EM[name] || name)+'</span>';
    const button = (text, id, cls='soft') => '<button class="'+cls+'" id="'+id+'">'+text+'</button>';
    function stopAudio() { audioToken++; clearTimeout(timer); if (audio) { audio.onended=null; audio.onerror=null; audio.pause(); audio=null; } if (root.speechSynthesis) root.speechSynthesis.cancel(); document.querySelectorAll('.sounding').forEach(x=>x.classList.remove('sounding')); }
    function say(text) { stopAudio(); if (p.__sound === false || !root.speechSynthesis) return; const u = new SpeechSynthesisUtterance(text.replace(/_+/g,' blank ').replace(/=/g,' equals ').replace(/\+/g,' plus ')); u.rate=.85; root.speechSynthesis.speak(u); }
    function clips(ids, onItem) {
      stopAudio(); if (p.__sound === false) return;
      const token = audioToken; let index=0;
      function next() {
        if (token !== audioToken || index >= ids.length) { document.querySelectorAll('.sounding').forEach(x=>x.classList.remove('sounding')); return; }
        if (onItem) onItem(index);
        const clip = new Audio('audio/'+ids[index]+'.mp3'); audio=clip; let advanced=false;
        function advance() { if (advanced || token !== audioToken) return; advanced=true; index++; timer=setTimeout(next,180); }
        clip.onended=advance; clip.onerror=advance; const playing=clip.play(); if (playing?.catch) playing.catch(advance);
      } next();
    }
    function speakNumber(n) { if ([0,1,2,3,4,5,6,7,8,9,10,11,12,15,18,20,25,30].includes(Number(n))) clips(['num_'+n]); else say(String(n)); }
    function go(screen) { stopAudio(); $('exampleDialog').close(); document.querySelectorAll('.scr').forEach(el=>{el.classList.toggle('on',el.id===screen);el.classList.toggle('vis',el.id===screen);}); document.body.dataset.world=state.world; root.scrollTo(0,0); const heading=$(screen).querySelector('h1,h2'); if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});} }
    function stats(w) { const arr=D[w];return arr.filter(l=>L.completed(p,l.id)).length; }
    function day() { const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
    function plan(create=false) {
      let a=p.__adv;
      const valid=a && a.d===day() && Number.isInteger(a.n) && a.n>=0 && a.n<=4 && ['memory','plane','chess'].includes(a.g) && Array.isArray(a.s) && a.s.length===4 && a.s.every(s=>s && Object.hasOwn(D,s.w) && D[s.w].some(l=>l.id===s.id));
      if (!valid) {const e1=D.eng[L.frontier(D.eng,p)], e2=D.eng[L.frontier(D.eng,p,e1.id)]; a={d:day(),n:0,g:['memory','plane','chess'][Math.floor(Date.now()/864e5)%3],s:[{w:'eng',id:e1.id},{w:'math',id:D.math[L.frontier(D.math,p)].id},{w:'eng',id:e2.id},{w:'crit',id:D.crit[L.frontier(D.crit,p)].id}]}; if(create){p.__adv=a;save();}} return a;
    }
    function adventureNext() { const a=plan(true); if(a.n===4){location.href=a.g==='plane'?'sky-playground/':a.g+'.html';return;} const step=a.s[a.n];state.world=step.w;state.adventure={step:a.n};startLevel(D[step.w].findIndex(l=>l.id===step.id)); }
    function renderHome() {
      const a=plan(), total=Object.keys(D).reduce((n,w)=>n+stats(w),0);
      $('badgeCount').textContent=total+' adventure badge'+(total===1?'':'s');
      $('advLabel').textContent=a.n===4?'Pick your game':a.n>0?'Continue my adventure':'Start my adventure';
      $('advSub').textContent=a.n===4?'Your four learning stops are complete.': 'Four little learning stops, at your own pace.';
      $('adventureTrail').innerHTML=a.s.map((s,i)=>'<span class="trail-stop '+(i<a.n?'complete':i===a.n?'current':'')+'"><b>'+ (i<a.n?'✓':i+1)+'</b>'+L.worlds[s.w].short+'</span>').join('')+'<span class="trail-stop"><b>☆</b>Play</span>';
      Object.keys(D).forEach(w=>{ const lv=D[w][L.frontier(D[w],p)]; $('next-'+w).textContent='Next: '+lv.title; $('progress-'+w).textContent=stats(w)+' / '+D[w].length+' badges'; });
      $('parentProgress').innerHTML=Object.keys(D).map(w=>{
        const records=D[w].map(l=>p.__learning.levels[l.id]).filter(Boolean), independent=records.reduce((n,r)=>n+(Number.isFinite(r.independent)?r.independent:0),0), assisted=records.reduce((n,r)=>n+(Number.isFinite(r.assisted)?r.assisted:0),0);
        return '<div><strong>'+L.worlds[w].short+'</strong><span>'+stats(w)+' lessons completed</span><small>'+independent+' independent · '+assisted+' with help, across latest recorded attempts</small></div>';
      }).join('')+'<p>Older badges are preserved. Earlier scores do not tell us whether help was used. Progress is saved in this browser.</p>';
      $('soundToggle').textContent=p.__sound===false?'Sound off':'Sound on';$('soundToggle').setAttribute('aria-pressed',String(p.__sound!==false));
      go('home');
    }
    function label(lv) { const t=lv.q[0].t; if(state.world==='eng')return ['snd','lr','ls','ul','rhy'].includes(t)?'Listen': ['wb','ml'].includes(t)?'Build':'Read'; return lv.title; }
    function lessonCard(lv,idx,small=false) { const m=L.worlds[state.world], done=L.completed(p,lv.id); return '<button class="lesson-card '+(small?'compact':'')+'" data-level="'+idx+'">'+art(lv.q[0].img||(['odd','pat'].includes(lv.q[0].t)?lv.q[0].ch[0]:m.art))+'<span><small>'+ (done?'✓ Badge earned':'5 little challenges')+'</small><strong>'+E(label(lv))+'</strong><span>'+E(lv.title)+(state.world==='crit'?' · '+(idx%4+1):'')+'</span></span><b aria-hidden="true">→</b></button>'; }
    function renderLevels(reset=false) {
      if(reset) { const lv=D[state.world][L.frontier(D[state.world],p)];state.group=state.world==='eng'?lv.ph:lv.w; }
      const m=L.worlds[state.world],arr=D[state.world],idx=L.frontier(arr,p),next=arr[idx];
      $('lT').textContent=m.title;$('lS').textContent=stats(state.world)+' badges';
      $('levelIntro').innerHTML='<div>'+art(m.buddy)+'<span><small>YOUR NEXT DISCOVERY</small><h2>'+E(next.title)+'</h2><p>'+m.intro+'</p></span>'+button('Let’s play →','nextLesson','primary')+'</div>';
      $('nextLesson').onclick=()=>startLevel(idx);
      $('wkT').innerHTML=m.groups.map((g,i)=>'<button class="topic '+(state.group===i+1?'selected':'')+'" aria-pressed="'+(state.group===i+1)+'" data-group="'+(i+1)+'">'+E(g)+'</button>').join('');
      $('wkT').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.group=Number(b.dataset.group);renderLevels();});
      const selected=arr.map((lv,i)=>({lv,i})).filter(x=>(state.world==='eng'?x.lv.ph:x.lv.w)===state.group);
      let shown=selected;
      if(state.world==='eng') {const local=selected.find(x=>!L.completed(p,x.lv.id))||selected[0];shown=selected.filter(x=>x.lv.w===local.lv.w);}
      $('lG').innerHTML=shown.map(x=>lessonCard(x.lv,x.i)).join('');
      $('allLessons').innerHTML=selected.map(x=>lessonCard(x.lv,x.i,true)).join('');
      $('browseLessons').hidden=state.world!=='eng';$('browseLessons').open=false;
      $('levels').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>startLevel(Number(b.dataset.level)));
      go('levels');
    }
    function startLevel(index) {state.index=index;state.qi=0;state.rounds=level().q.map(L.round);state.finished=false;go('game');renderQuestion();showExample();}
    function feedback(text,correct=false) { $('lessonFeedback').textContent=text; $('lessonFeedback').classList.toggle('success',correct); }
    function readQuestion() {
      const q=question();
      if(q.t==='c'){say('How many apples? Tap each apple once to count.');return;}
      if(q.t==='snd'){clips([phonId(q.sound)]);return;}
      if(q.t==='bl'){blend(q);return;}
      if(['wb','ml','pm'].includes(q.t)){clips([wordId(q.w)]);return;}
      if(q.t==='sw'){clips([wordId(q.target)]);return;}
      if(q.t==='rhy'){clips([wordId(q.word.toLowerCase())]);return;}
      if(q.t==='lr'){clips([phonId(q.show)]);return;}
      if(q.t==='ls'){clips([wordId(q.img)]);return;}
      say((q.context||q.p||'Match the lowercase letter.')+(q.t==='eq'?' '+q.eq:''));
    }
    function choose(value,btn) {
      const r=round(),q=question(); if(r.done)return;
      const correct=String(value)===String(q.a);
      if(!L.attempt(r,correct))return;
      if(correct){btn.classList.add('correct');completeAnswer();}
      else{btn.classList.add('try-again');btn.setAttribute('aria-label',(btn.getAttribute('aria-label')||btn.textContent)+' — try again');feedback('Let’s try again. '+L.hint(q));say('Let’s try again. '+L.hint(q));}
    }
    function completeAnswer() {
      const q=question();feedback(L.explanation(q),true);$('nextQuestion').disabled=false;$('nextQuestion').textContent=state.qi===level().q.length-1?'Collect my badge ☆':'Next →';$('hintButton').disabled=true;
      $('qA').querySelectorAll('[data-answer],[data-build]').forEach(b=>b.disabled=true);
      $('gF').style.width=((state.qi+1)/level().q.length*100)+'%';
      if(q.t==='fw')$('sentenceText').textContent=L.explanation(q);
      if(q.t==='wb')$('builtWord').textContent=q.w;
      if(['wb','bl','ml'].includes(q.t))clips([wordId(q.w)]);else if(q.t==='rhy')clips([wordId(q.word.toLowerCase()),wordId(q.a)]);else say(L.explanation(q));
    }
    function choices(q,picture=false) {
      return '<div class="answers '+(picture?'picture-answers':'')+'">'+L.shuffle(q.ch).map(c=>{
        const obj=typeof c==='object', v=obj?c.v:c, name=obj?c.label:String(c), visual=obj?'<span class="scene-art">'+c.items.map(i=>art(i)).join('')+'</span>':picture?art(c):'<span class="answer-text">'+E(c)+'</span>';
        return '<div class="answer-wrap"><button class="answer '+(obj?'scene':'')+'" data-answer="'+E(v)+'" aria-label="'+E(name)+'">'+visual+(picture||obj?'<span class="answer-caption">'+E(name)+'</span>':'')+'</button>'+ (q.t==='rhy'||obj?'<button class="hear-choice" data-hear="'+E(name)+'" '+(obj?'data-sentence="true"':'')+' aria-label="Hear '+E(name)+'">♪ Hear</button>':'')+'</div>';
      }).join('')+'</div>';
    }
    function frames(n,color='mint') { let h='<div class="frames" aria-label="'+n+' counters">';for(let start=0;start<n;start+=10){h+='<span class="ten-frame">';for(let i=0;i<10;i++)h+='<i class="counter '+(start+i<n?'filled '+color:'')+'"></i>';h+='</span>';}return h+'</div>'; }
    function countObjects(n,name='apple',interactive=true) {return '<div class="count-objects">'+Array.from({length:n},(_,i)=>interactive?'<button class="count-object" data-count="'+i+'" aria-label="Count object '+(i+1)+'">'+art(name)+'<b></b></button>':'<span class="count-object">'+art(name)+'</span>').join('')+'</div>';}
    function numberLine(max=10){return '<div class="number-line" aria-label="Number line from zero to '+max+'">'+Array.from({length:max+1},(_,i)=>'<button data-number="'+i+'">'+i+'</button>').join('')+'</div>';}
    function build(q,pictures=false) {
      const parts=pictures?q.order:q.ph||source.WPH[q.w]||q.w.split(''), pool=L.shuffle(q.pool||parts);
      state.build={parts,index:0,pictures};
      return '<p class="stage-note">Tap the tiles in order.</p><div class="build-slots" id="buildSlots">'+parts.map((_,i)=>'<span aria-label="Space '+(i+1)+'">'+(i+1)+'</span>').join('')+'</div><div class="build-pool">'+pool.map((c,i)=>'<button class="build-tile" data-build="'+E(c)+'" aria-label="'+E(c)+'" data-tile="'+i+'">'+(pictures?art(c)+'<small>'+E(c)+'</small>':E(c).replace('_','…'))+'</button>').join('')+'</div><p class="built-word" id="builtWord"></p>';
    }
    function blend(q) { const parts=q.ph||source.WPH[q.w]||[q.w];clips(parts.map(phonId).concat(wordId(q.w)),i=>{document.querySelectorAll('[data-phon]').forEach((b,n)=>b.classList.toggle('sounding',n===i));}); }
    function renderQuestion() {
      stopAudio();state.hint=0;state.build=null;
      const q=question(),lv=level();
      $('gTt').textContent=L.worlds[state.world].title;$('gSt').textContent=(state.qi+1)+' of '+lv.q.length;
      $('lessonName').textContent=lv.title;$('gF').style.width=(state.qi/lv.q.length*100)+'%';
      $('nextQuestion').disabled=true;$('nextQuestion').textContent='Next →';$('hintButton').disabled=false;
      $('lessonFeedback').classList.remove('success'); feedback('Take your time. You can ask for help.');
      let prompt=q.t==='c'?'How many apples?':q.t==='wb'?'Build the word':q.t==='seq'?'Tell the story in order':q.p||'Match the lowercase!';
      let body='',after='',standalone=false;
      switch(q.t) {
        case 'c': body='<p class="stage-note">Tap each apple to count it.</p>'+countObjects(q.d)+'<output id="countTotal" aria-live="polite">Let’s count!</output>';break;
        case 'm': body='<div class="number-trail">'+q.s.map(n=>'<span class="'+(n==null?'missing':'')+'">'+(n==null?'?':n)+'</span>').join('<i>→</i>')+'</div>'+numberLine(Math.max(...q.s.filter(n=>n!=null),q.a));break;
        case 'b':body='<div class="compare-board">'+[q.x,q.y].map((n,i)=>'<div><b class="big-number">'+n+'</b>'+frames(n,i?'peach':'mint')+'</div>').join('<span>or</span>')+'</div>';break;
        case 'cm':case 'cl':body='<div class="compare-board">'+['l','r'].map((side,i)=>'<button class="group-answer" data-answer="'+side+'" aria-label="'+(side==='l'?'Left':'Right')+' group: '+q[side]+' counters"><b class="big-number">'+q[side]+'</b>'+frames(q[side],i?'peach':'mint')+'</button>').join('<span>or</span>')+'</div>';standalone=true;break;
        case 'ad':body='<div class="addition-board" id="additionBoard"><div>'+countObjects(q.x,'apple',false)+'</div><b>+</b><div>'+countObjects(q.y,'cookie',false)+'</div></div>'+button('Join the groups','joinGroups');break;
        case 'eq': {body='<div class="equation">'+E(q.eq)+'</div>';const match=q.eq.match(/^(\d+) - (\d+)/);if(match){body+='<p class="stage-note">Tap '+match[2]+' counters to take them away.</p><div class="take-away">'+Array.from({length:Number(match[1])},(_,i)=>'<button data-remove="'+i+'" aria-label="Take away counter '+(i+1)+'">'+art('ball')+'</button>').join('')+'</div>';}else{body+='<details class="number-help"><summary>Open my counting tray</summary>'+countObjects(q.eq.startsWith('?')?Number(q.eq.split('=').pop()):Number(q.eq.split('+')[0])+Number(q.eq.split('+')[1].split('=')[0]),'ball')+'</details>';}body+=numberLine(10);break;}
        case 'lr':body='<div class="letter-display">'+E(q.show)+'</div>';break;
        case 'ls':body=art(q.img,'feature-toy')+'<p class="picture-label">'+E(q.img)+'</p>';break;
        case 'ul':body='<div class="letter-display">'+E(q.upper)+' <span class="subtle">→</span> ?</div>';break;
        case 'snd':body=art('owl','feature-toy')+button('♪ Hear the sound','targetHear','audio-button');break;
        case 'sw':body=art('book','feature-toy')+button('♪ Hear the word','targetHear','audio-button');break;
        case 'rhy':body=(L.artPath(q.word.toLowerCase())?art(q.word.toLowerCase(),'story-toy'):'')+'<div class="word-display">'+E(q.word.toLowerCase())+'</div>'+button('♪ Hear '+E(q.word.toLowerCase()),'targetHear','audio-button');break;
        case 'fw':{prompt='Finish the little story';const pic=q.p.toLowerCase().split(/\W+/).find(w=>L.artPath(w));body=(pic?art(pic,'story-toy'):'')+'<p class="sentence" id="sentenceText">'+E(q.p).replace(/_+/,'<span class="word-gap" aria-label="missing word">…</span>')+'</p>';break;}
        case 'pm':body='<div class="word-display">'+E(q.w)+'</div>';after=choices(q,true);break;
        case 'ml':body='<div class="missing-word">'+q.show.split('').map(c=>'<span class="'+(c==='_'?'missing':'')+'">'+(c==='_'?'?':E(c))+'</span>').join('')+'</div>'+button('♪ Hear the word','targetHear','audio-button');break;
        case 'bl':body='<div class="phonemes">'+(q.ph||source.WPH[q.w]||[q.w]).map(s=>'<button data-phon="'+E(s)+'">'+E(s).replace('_','…')+'</button>').join('')+'</div>'+button('♪ Slide the sounds together','blendButton','audio-button');break;
        case 'wb':body=button('♪ Hear the word','targetHear','audio-button')+build(q);standalone=true;break;
        case 'odd':body='<p class="stage-note">Look for a group. Find the one that is different.</p>';after=choices(q,true);break;
        case 'goes':body=art(q.w,'feature-toy')+'<p class="picture-label">'+E(q.w)+'</p>';after=choices(q,true);break;
        case 'next':body='<p class="story-context">'+E(q.context)+'</p>'+art(q.w,'feature-toy');after=choices(q,true);break;
        case 'silly':body='<p class="stage-note">Tap ♪ Hear to listen to each little story.</p>';after=choices(q,true);break;
        case 'pat':body='<div class="pattern-train">'+q.seq.map(s=>'<span>'+art(s)+'</span>').join('')+'<span class="missing">?</span></div>';after=choices(q,true);break;
        case 'seq':body=build(q,true);standalone=true;break;
        default:throw new Error('Unknown activity: '+q.t);
      }
      $('qA').innerHTML='<h1 class="question-title">'+E(prompt)+'</h1><div class="play-stage">'+body+'</div>'+(!standalone?(after||choices(q)):'');
      $('qA').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>choose(b.dataset.answer,b));
      $('qA').querySelectorAll('[data-hear]').forEach(b=>b.onclick=()=>b.dataset.sentence?say(b.dataset.hear):clips([wordId(b.dataset.hear)]));
      $('qA').querySelectorAll('[data-phon]').forEach(b=>b.onclick=()=>{clips([phonId(b.dataset.phon)]);b.classList.add('sounding');});
      $('qA').querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{if(b.classList.contains('counted'))return;b.classList.add('counted');const n=$('qA').querySelectorAll('.counted').length;b.querySelector('b').textContent=n;b.setAttribute('aria-label','Counted '+n);if($('countTotal'))$('countTotal').textContent=n+' counted';speakNumber(n);});
      $('qA').querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>{b.classList.toggle('visited');speakNumber(b.dataset.number);});
      $('qA').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{b.classList.toggle('removed');b.setAttribute('aria-pressed',String(b.classList.contains('removed')));const left=$('qA').querySelectorAll('[data-remove]:not(.removed)').length;feedback(left+' left in your tray.');speakNumber(left);});
      $('qA').querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{
        const r=round(),build=state.build;if(r.done||b.disabled)return;
        if(b.dataset.build===build.parts[build.index]){const slot=$('buildSlots').children[build.index];slot.innerHTML=build.pictures?art(b.dataset.build):E(b.dataset.build).replace('_','…');slot.classList.add('placed');slot.setAttribute('aria-label',b.dataset.build);b.disabled=true;b.classList.remove('clue');if(!build.pictures)clips([phonId(b.dataset.build)]);build.index++;if(build.index===build.parts.length){L.attempt(r,true);completeAnswer();}}
        else{L.attempt(r,false);feedback('Try another tile. '+L.hint(q));say('Try another tile. '+L.hint(q));}
      });
      if($('targetHear'))$('targetHear').onclick=readQuestion;
      if($('blendButton'))$('blendButton').onclick=()=>blend(q);
      if($('joinGroups'))$('joinGroups').onclick=()=>{$('additionBoard').innerHTML=countObjects(q.x,'apple',false)+countObjects(q.y,'cookie',false);$('additionBoard').classList.add('joined');$('joinGroups').disabled=true;say('Now count every object in the tray.');};
      // A counting tray is an optional scaffold and is recorded as help.
      $('qA').querySelectorAll('.number-help').forEach(d=>d.ontoggle=()=>{if(d.open&&!round().done)round().assisted=true;});
      root.scrollTo(0,0);
      document.querySelector('.question-title').tabIndex=-1;document.querySelector('.question-title').focus({preventScroll:true});
      readQuestion();
    }
    function showHint() {
      if(round().done)return;round().assisted=true;state.hint++;
      let text=L.hint(question());
      if(state.hint>1){const q=question(),value=state.build?state.build.parts[state.build.index]:q.a;document.querySelectorAll('[data-answer],[data-build]').forEach(b=>{if((b.dataset.answer||b.dataset.build)===String(value)&&!b.disabled)b.classList.add('clue');});text=state.build?'Try the glowing tile next.':'Look at the glowing choice. '+L.explanation(q);}
      feedback(text);say(text);
    }
    function exampleContent(q) {
      if(['c','b','cm','cl'].includes(q.t))return {title:'Count each object once',html:countObjects(3,'apple',false)+'<strong class="example-answer">1 · 2 · 3</strong>',text:'Touch one apple for each number. One, two, three. The last number tells us there are three apples.'};
      if(['ad','eq'].includes(q.t))return {title:'Numbers tell a story',html:countObjects(2,'apple',false)+'<strong class="example-answer">2 + 1 = 3</strong>'+countObjects(1,'cookie',false),text:'Two apples and one cookie make three things altogether. Take one away and two are left.'};
      if(q.t==='m')return {title:'Follow the number trail',html:'<div class="number-trail"><span>1</span><i>→</i><span>2</span><i>→</i><span>3</span></div>',text:'One, two, three. Each jump adds one. Other trails can go backwards or make bigger jumps. Look for the rule.'};
      if(q.t==='rhy')return {title:'Listen to the endings',html:'<div class="example-pair">'+art('cat')+art('hat')+'</div><strong class="example-answer">cat · hat</strong>',text:'Cat and hat. Their endings sound the same. These words rhyme.',words:['cat','hat']};
      if(['bl','wb','ml'].includes(q.t))return {title:'Sounds make a word',html:'<div class="phonemes"><span>c</span><span>a</span><span>t</span></div>'+art('cat','story-toy')+'<strong class="example-answer">cat</strong>',text:'Listen to the sounds, then slide them together to make cat. To build a word, tap its sound tiles in order.',sounds:['c','a','t']};
      if(q.t==='fw')return {title:'Read a little story',html:art('cat','story-toy')+'<p class="sentence">The cat can sit.</p>',text:'The cat can sit. A sentence tells a little story. Try each word in the space and listen for the one that makes sense.'};
      if(q.t==='odd')return {title:'Find a group',html:'<div class="example-pair">'+art('apple')+art('cookie')+art('car')+'</div>',text:'We can eat an apple and a cookie. We cannot eat a car! The car is the odd one out.'};
      if(q.t==='pat')return {title:'Find the repeating part',html:'<div class="example-pair">'+['apple','cookie','apple','cookie'].map(x=>art(x)).join('')+'</div>',text:'Apple, cookie. Apple, cookie. The same pair repeats, so apple comes next.'};
      if(q.t==='goes')return {title:'Look for a connection',html:'<div class="example-pair">'+art('seed')+art('flower')+'</div>',text:'A seed can grow into a flower. They go together because one can grow into the other.'};
      if(['next','seq'].includes(q.t))return {title:'Tell a story in steps',html:'<div class="example-pair">'+['seed','sprout','flower'].map(x=>art(x)).join('')+'</div>',text:'First a seed. With water and light, a sprout grows. Later, the plant can make a flower.'};
      if(q.t==='silly')return {title:'Could that really happen?',html:'<div class="example-pair">'+art('book')+art('apple')+'</div>',text:'A child can eat an apple. But a book cannot eat an apple. A book has no mouth!'};
      return {title:'Listen and look',html:art('owl','feature-toy')+'<div class="letter-display">s</div>',text:'Use Hear again to listen. Look closely at the letters or words, then tap your choice. You can always ask for a clue.'};
    }
    function showExample() {
      stopAudio();focusReturn=document.activeElement;const ex=exampleContent(question());
      $('exampleBody').innerHTML='<small>LET’S LEARN TOGETHER</small><h2 id="exampleTitle">'+ex.title+'</h2>'+ex.html+'<p>'+E(ex.text)+'</p>';
      $('hearExample').onclick=()=>{if(ex.sounds)clips(ex.sounds.map(phonId).concat(wordId('cat')));else if(ex.words)clips(ex.words.map(wordId));else say(ex.text);};
      $('exampleDialog').showModal();$('tryExample').focus();
    }
    function finishLevel() {
      if(state.finished||!L.finish(p,level(),state.rounds,state.world))return;state.finished=true;
      if(state.adventure){const a=p.__adv;if(a&&a.d===day()&&a.n===state.adventure.step)a.n++;}
      save();const m=L.worlds[state.world];$('doneArt').innerHTML=art(m.buddy);$('dcT').textContent='You earned a badge!';$('dcM').textContent='You explored '+level().title+'. Keep being curious, Viaan!';$('dcS').textContent='☆ '+m.short+' explorer';
      $('dcL').textContent=state.adventure?'Next adventure stop →':'Choose another discovery';go('done');say('You earned a badge! Well done, Viaan.');
    }
    $('wM').onclick=()=>{state.world='math';state.adventure=null;renderLevels(true);};$('wE').onclick=()=>{state.world='eng';state.adventure=null;renderLevels(true);};$('wC').onclick=()=>{state.world='crit';state.adventure=null;renderLevels(true);};
    $('advB').onclick=adventureNext;$('lBk').onclick=renderHome;$('gBk').onclick=()=>{if(state.adventure){state.adventure=null;renderHome();}else renderLevels();};
    $('hearAgain').onclick=()=>{if(round().done)say(L.explanation(question()));else readQuestion();};$('hintButton').onclick=showHint;$('exampleButton').onclick=()=>{if(!round().done)round().assisted=true;showExample();};
    $('nextQuestion').onclick=()=>{if(!round().done)return;if(state.qi===level().q.length-1)finishLevel();else{state.qi++;renderQuestion();}};
    $('tryExample').onclick=()=>{$('exampleDialog').close();stopAudio();if(focusReturn?.isConnected)focusReturn.focus();readQuestion();};
    $('exampleDialog').addEventListener('cancel',()=>{stopAudio();});
    $('dcR').onclick=()=>startLevel(state.index);$('dcL').onclick=()=>state.adventure?adventureNext():renderLevels();$('doneHome').onclick=()=>{state.adventure=null;renderHome();};
    $('soundToggle').onclick=()=>{p.__sound=p.__sound===false;save();stopAudio();$('soundToggle').textContent=p.__sound?'Sound on':'Sound off';$('soundToggle').setAttribute('aria-pressed',String(p.__sound));};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});root.addEventListener('pagehide',stopAudio);
    renderHome();
  }
})(window);
