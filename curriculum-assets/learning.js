/* Shared curriculum rules. No DOM, audio, or storage side effects. */
(function (root) {
  'use strict';
  const worlds = {
    math: { title: 'Number Playground', short: 'Math', art: 'apple', buddy: 'bear', intro: 'Little objects. Big discoveries.', color: '#28775f', groups: ['Count & compare', 'Add & explore', 'Take away', 'Number patterns'] },
    eng: { title: 'Story Garden', short: 'English', art: 'book', buddy: 'owl', intro: 'Listen, build, and grow a story.', color: '#536b9b', groups: ['Listen', 'First sounds', 'Sound teams', 'Blend', 'More sounds', 'Read stories'] },
    crit: { title: 'Little Detective', short: 'Thinking', art: 'car', buddy: 'frog', intro: 'Look closely. Find the little clues.', color: '#8c607c', groups: ['Spot the odd one', 'Find a partner', 'What happens next?', 'Silly stories', 'Patterns & order'] }
  };
  const toys = 'apple car fish seed sprout flower tree cup ball cookie book blocks hat ice cloud egg'.split(' ');
  const animals = 'bear cat dog duck elephant frog giraffe lion owl panda penguin turtle'.split(' ');
  function artPath(name) { return toys.includes(name) ? 'curriculum-assets/' + name + '.png' : animals.includes(name) ? 'memory-assets/' + name + '.png' : null; }
  function escape(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function shuffle(a, random = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function progress(raw) {
    let p; try { p = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { }
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    if (!p.__learning || typeof p.__learning !== 'object' || Array.isArray(p.__learning)) p.__learning = {};
    if (!p.__learning.levels || typeof p.__learning.levels !== 'object' || Array.isArray(p.__learning.levels)) p.__learning.levels = {};
    p.__learning.v = 1; return p;
  }
  function completed(p, id) { return !!p.__learning.levels[id]?.complete || (Number.isFinite(p[id]) && p[id] > 0); }
  function frontier(arr, p, skip) { let i = arr.findIndex(l => l.id !== skip && !completed(p, l.id)); if (i < 0) i = arr.findIndex(l => l.id !== skip && p.__learning.levels[l.id]?.assisted > 0); return i < 0 ? 0 : i; }
  function round() { return { done: false, assisted: false, misses: 0 }; }
  function attempt(r, correct) { if (r.done) return false; if (correct) r.done = true; else { r.assisted = true; r.misses++; } return true; }
  function finish(p, lv, rounds, world) {
    if (rounds.length !== lv.q.length || rounds.some(r => !r.done)) return false;
    const independent = rounds.filter(r => !r.assisted).length, old = p.__learning.levels[lv.id];
    p.__learning.levels[lv.id] = { complete: true, independent, assisted: rounds.length - independent, misses: rounds.reduce((n, r) => n + r.misses, 0), plays: (Number.isFinite(old?.plays) ? old.plays : 0) + 1, bestIndependent: Math.max(Number.isFinite(old?.bestIndependent) ? old.bestIndependent : 0, independent) };
    p[lv.id] = Math.max(Number.isFinite(p[lv.id]) ? p[lv.id] : 0, independent * 2);
    p.__learning.last = { world, id: lv.id }; return true;
  }
  const oddGroups = ['animals','things we can eat','things in the sky','birds','containers', 'animals that spend time in water','round things','things we wear','sweet treats','birds', 'vehicles','things in the sky','animals','things that grow','things we wear', 'animals','things we can eat','things in the sky','containers','vehicles'];
  const pairs = { 'sock:shoe':'We put socks inside shoes.', 'bird:nest':'A bird can make a nest for its eggs.', 'dog:bone':'A dog can chew a suitable bone.', 'key:lock':'A matching key opens a lock.', 'toothbrush:toothpaste':'We put toothpaste on a toothbrush.', 'hen:egg':'A hen lays eggs.', 'rain:umbrella':'An umbrella helps keep us dry in the rain.', 'cat:mouse':'A cat may chase a mouse.', 'fish:net':'A net can catch a fish.', 'toe:sock':'A sock covers our toes.', 'seed:flower':'With care, a flower seed can grow into a flower.', 'cow:milk':'Cows make milk for their calves.', 'king:queen':'A king and a queen are royal titles.', 'rain:cloud':'Rain falls from clouds.', 'car:key':'A car key can unlock a car.', 'moon:star':'We can see the moon and stars in the sky.', 'bird:egg':'Birds lay eggs.', 'pig:mud':'Mud helps pigs cool down.', 'fish:puddle':'Fish need water to breathe.' };
  const causes = {
    ice: ['The ice is getting warm.', 'Warm ice melts into water.'], seed: ['We plant a seed and give it water and light.', 'A seed can sprout and grow into a plant.'], glass: ['A glass falls onto a hard floor. What might happen?', 'Glass can break when it hits a hard floor.'], cloud: ['A dark rain cloud moves overhead. What might happen?', 'Rain can fall from a cloud and collect in puddles.'], egg: ['A baby chicken is ready to hatch.', 'A chick comes out of its egg.'], caterpillar: ['The caterpillar makes a chrysalis. Later…', 'After changing inside a chrysalis, a butterfly emerges.'], rain: ['Sunlight shines through raindrops. What might appear?', 'Sunlight passing through raindrops can make a rainbow.'], chick: ['The chick eats and grows for many weeks.', 'A female chick grows into a hen.'], sprout: ['We care for this little flowering plant.', 'A sprout grows and can make flowers.']
  };
  // Captions describe actions; a pair of unrelated pictures alone is not a question.
  const silly = [
    ['fish','tree','A fish grows on a tree.','Fish hatch from eggs. They do not grow on trees.'],
    ['car','cookie','A car eats a cookie.','Cars do not eat food.'],
    ['tree','hat','A tree walks to school.','Trees have roots and cannot walk.'],
    ['cup','egg','A cup lays an egg.','Birds lay eggs. Cups do not.'],
    ['fish','book','A fish reads a book.','People read books. Fish cannot read.'],
    ['apple','cloud','An apple flies by flapping its wings.','Apples have no wings.'],
    ['elephant','cup','A whole grown elephant fits inside a tea cup.','A grown elephant is much bigger than a tea cup.'],
    ['hat','cookie','A child eats a hat for lunch.','A hat is clothing, not food.'],
    ['cloud','book','A cloud turns the pages of a book.','Clouds have no hands to turn pages.'],
    ['dog','car','A dog drives a car by itself.','A dog cannot drive a real car.'],
    ['ice','flower','An ice cube grows roots and flowers.','Ice is frozen water, not a plant.'],
    ['fish','tree','A fish climbs a tree using hands.','Fish have fins, not hands.'],
    ['cookie','egg','A cookie hatches from a chicken egg.','A chick can hatch from a chicken egg.'],
    ['book','apple','A book takes a bite of an apple.','A book has pages, not a mouth.'],
    ['cup','tree','A tea cup grows into a tree.','Trees can grow from seeds. A tea cup cannot.'],
    ['car','flower','A car drinks nectar like a butterfly.','Cars cannot drink nectar.'],
    ['apple','ball','An apple bounces itself to the park.','An apple cannot move itself to the park.'],
    ['fish','car','A fish drives a car on the road.','Fish cannot drive real cars.'],
    ['egg','book','An egg reads a bedtime story aloud.','An egg cannot speak or read.'],
    ['elephant','flower','An elephant is smaller than a tiny flower.','A real elephant is much bigger than a tiny flower.']
  ];
  const normal = [
    {v:'normal-a', items:['dog','ball'], label:'A dog plays with a ball.'},
    {v:'normal-b', items:['seed','flower'], label:'A seed grows into a flower.'},
    {v:'normal-c', items:['hat'], label:'A child wears a hat.'},
    {v:'normal-d', items:['book'], label:'A grown-up reads a book.'},
    {v:'normal-e', items:['apple'], label:'A child eats an apple.'},
    {v:'normal-f', items:['egg'], label:'A hen lays an egg.'}
  ];
  function prepare(data) {
    let oi = 0, si = 0;
    const same = [['ai','ay','a_e'],['ee','ea','ey','e_e'],['igh','ie','i_e'],['oa','oe','o_e'],['ur','ir','er'],['aw','au','or'],['ue','ew','u_e'],['oi','oy'],['ow','ou'],['f','ff','ph'],['w','wh'],['c','k','ck'],['s','ss'],['l','ll'],['z','zz']];
    Object.values(data).forEach(arr => arr.forEach(lv => lv.q.forEach(q => {
      if (q.w === 'deer') { if(q.ph) q.ph=q.ph.map(s=>s==='ear'?'eer':s); if(q.pool) q.pool=q.pool.map(s=>s==='ear'?'eer':s); if(q.t==='ml'){q.a='eer';q.ch=q.ch.map(s=>s==='ear'?'eer':s);} }
      if (q.t === 'ml') q.show = q.w.replace(q.a, '_');
      if (q.t === 'rhy' && q.word.toLowerCase() === q.a) Object.assign(q, {word:'BUG',p:'What rhymes with BUG?',a:'rug',ch:['rug','nut','hat']});
      if (q.t === 'snd') {
        const group = same.find(g => g.includes(q.sound.toLowerCase()));
        if (group) { q.ch = q.ch.filter(c => c === q.a || !group.includes(c.toLowerCase())); for (const c of ['m','s','t','n']) if (q.ch.length < 3 && !q.ch.includes(c) && !group.includes(c)) q.ch.push(c); }
      }
      if (q.t === 'odd') q.group = oddGroups[oi++];
      if (q.t === 'goes') q.explain = pairs[q.w + ':' + q.a];
      if (q.t === 'next') { q.context = causes[q.w][0]; q.explain = causes[q.w][1]; }
      if (q.t === 'silly') { const s = silly[si], a = 'silly-' + si; q.ch = [{v:a,items:s.slice(0,2),label:s[2]}, normal[si % normal.length], normal[(si+1)%normal.length]]; q.a = a; q.explain = s[3]; si++; }
    })));
    return data;
  }
  function explanation(q) {
    if (q.explain) return q.explain;
    if (q.t === 'odd') return 'The others are ' + q.group + '. The ' + q.a + ' belongs to a different group.';
    if (q.t === 'pat') return 'The pictures repeat: ' + q.seq.join(', ') + '. Next comes ' + q.a + '.';
    if (q.t === 'seq') return 'First ' + q.order[0] + ', then ' + q.order[1] + ', and later ' + q.order[2] + '.';
    if (q.t === 'c') return 'You counted ' + q.d + ' objects, each one once!';
    if (q.t === 'ad') return q.x + ' and ' + q.y + ' together make ' + q.a + '.';
    if (q.t === 'eq') return q.eq.replace('?', q.a) + '.';
    if (q.t === 'b') return q.a + ' is bigger. It has more counters.';
    if (q.t === 'cm' || q.t === 'cl') return (q.a === 'l' ? q.l : q.r) + ' is the group with ' + (q.t === 'cl' ? 'fewer' : 'more') + ' counters.';
    if (q.t === 'm') return 'The number trail is ' + q.s.map(n => n == null ? q.a : n).join(', ') + '.';
    if (q.t === 'rhy') return q.word.toLowerCase() + ' and ' + q.a + ' rhyme. Listen to their endings!';
    if (q.t === 'fw') return q.p.replace(/_+/, q.a);
    if (q.t === 'ul') return q.upper + ' and ' + q.a + ' are the same letter, big and small.';
    if (q.t === 'wb' || q.t === 'bl' || q.t === 'ml') return 'You made the word ' + q.w + '!';
    if (q.t === 'ls') return q.img + ' starts with ' + q.a + '.';
    return 'You found ' + (q.a || q.w) + '!';
  }
  function hint(q) {
    if (q.t === 'odd') return 'Find the ' + q.group + '. Which picture is left over?';
    if (q.t === 'goes') return 'Think about what we use together, or what we find together.';
    if (q.t === 'next') return 'Listen to the little story. What could change?';
    if (q.t === 'silly') return 'Listen to each story. Which action could not really happen?';
    if (q.t === 'pat') return 'Say the pictures in order. Listen for the part that repeats.';
    if (q.t === 'seq') return 'Start with what happens first. Then look for the next step.';
    if (q.t === 'c') return 'Tap each object once. The last number tells you how many.';
    if (q.t === 'ad') return 'Join the two groups. Then count all the objects.';
    if (q.t === 'eq') return q.eq.includes('-') ? 'Tap the counters to take some away. Count what is left.' : 'Use the counters or hop along the number line.';
    if (['b','cm','cl'].includes(q.t)) return 'Compare the rows. Each full frame has ten counters.';
    if (q.t === 'm') return 'Follow the jumps on the number trail.';
    if (q.t === 'rhy') return 'Hear each word. Which ending sounds the same?';
    if (q.t === 'fw') return 'Read the sentence with each choice. Which one makes sense?';
    if (q.t === 'wb') return 'Say the word slowly. Find the next sound tile.';
    if (q.t === 'ml') return 'Say the whole word. Which sound fits in the empty space?';
    if (q.t === 'bl') return 'Tap the sounds, then slide them together.';
    return 'Listen again, then look closely at each choice.';
  }
  root.Learning = { worlds, artPath, escape, shuffle, progress, completed, frontier, round, attempt, finish, prepare, explanation, hint };
})(typeof window === 'undefined' ? globalThis : window);
