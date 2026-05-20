const fs = require('fs');
const path = require('path');

// Load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Set OPENAI_API_KEY environment variable');
  process.exit(1);
}

const API_URL = 'https://api.openai.com/v1/audio/speech';
// "shimmer" - warm, friendly female voice; good for kids
const VOICE = 'shimmer';

const AUDIO_DIR = path.join(__dirname, 'audio');
const BUNDLE_FILE = path.join(__dirname, 'audio-bundle.json');

// All clips to generate
const clips = [
  // === Phonics: single letters (26) ===
  { id: 'phon_A', text: 'aah' },
  { id: 'phon_B', text: 'buh' },
  { id: 'phon_C', text: 'kuh' },
  { id: 'phon_D', text: 'duh' },
  { id: 'phon_E', text: 'eh' },
  { id: 'phon_F', text: 'fuh' },
  { id: 'phon_G', text: 'guh' },
  { id: 'phon_H', text: 'huh' },
  { id: 'phon_I', text: 'ih' },
  { id: 'phon_J', text: 'juh' },
  { id: 'phon_K', text: 'kuh' },
  { id: 'phon_L', text: 'lll' },
  { id: 'phon_M', text: 'mmm' },
  { id: 'phon_N', text: 'nnn' },
  { id: 'phon_O', text: 'ahh' },
  { id: 'phon_P', text: 'puh' },
  { id: 'phon_R', text: 'rrr' },
  { id: 'phon_S', text: 'sss' },
  { id: 'phon_T', text: 'tuh' },
  { id: 'phon_U', text: 'uh' },
  { id: 'phon_V', text: 'vvv' },
  { id: 'phon_W', text: 'wuh' },
  { id: 'phon_X', text: 'ks' },
  { id: 'phon_Y', text: 'yuh' },
  { id: 'phon_Z', text: 'zzz' },

  // === Phonics: digraphs & alternatives (~25) ===
  { id: 'phon_ll', text: 'lll' },
  { id: 'phon_ss', text: 'sss' },
  { id: 'phon_ch', text: 'ch' },
  { id: 'phon_sh', text: 'sh' },
  { id: 'phon_th', text: 'th' },
  { id: 'phon_ng', text: 'ng' },
  { id: 'phon_ai', text: 'ay' },
  { id: 'phon_ee', text: 'ee' },
  { id: 'phon_igh', text: 'eye' },
  { id: 'phon_oa', text: 'oh' },
  { id: 'phon_oo', text: 'oo' },
  { id: 'phon_ar', text: 'ar' },
  { id: 'phon_or', text: 'or' },
  { id: 'phon_ur', text: 'er' },
  { id: 'phon_ow', text: 'ow' },
  { id: 'phon_oi', text: 'oy' },
  { id: 'phon_ear', text: 'ear' },
  { id: 'phon_air', text: 'air' },
  { id: 'phon_er', text: 'er' },
  { id: 'phon_a_e', text: 'ay' },
  { id: 'phon_i_e', text: 'eye' },
  { id: 'phon_o_e', text: 'oh' },
  { id: 'phon_u_e', text: 'yoo' },
  { id: 'phon_ay', text: 'ay' },
  { id: 'phon_ea', text: 'ee' },
  { id: 'phon_ie', text: 'eye' },
  { id: 'phon_oy', text: 'oy' },
  { id: 'phon_ou', text: 'ow' },
  { id: 'phon_ir', text: 'er' },
  { id: 'phon_ue', text: 'yoo' },
  { id: 'phon_ew', text: 'yoo' },
  { id: 'phon_aw', text: 'aw' },
  { id: 'phon_ph', text: 'f' },
  { id: 'phon_oe', text: 'oh' },

  // === Decodable words (~120) ===
  ...['sat','tap','pat','pan','pin','tin','tip','nap','map','mat','man','pit',
  'sip','sad','dad','dim','dig','got','cot','cop','cod','kid','kit',
  'den','pen','pet','peg','bed','red','run','rub','rug','mud','mug','hug',
  'hen','hop','hid','him','hit','hot','bin','bit','bat','bag','fun','fit',
  'fin','fan','leg','lip','log','lot','lid','bell','fell','doll','miss','hiss','fuss',
  'chip','chop','chin','ship','shop','shed','shin','thin','them','king','ring','sing',
  'vet','wax','web','yam','zip',
  'wait','feet','night','boat','food','park','fork','hurt','cow','coin','deer','hair',
  'moon','rain','bus',
  'hand','tent','lamp','milk','pond','desk','fist','jump',
  'clap','flag','plug','drum','frog','grin','swim','snap',
  'cake','bike','bone','tube',
  'play','day','bean','pie','boy','loud','bird','glue','stew','paw','phone','toe',
  'dog','cat','goat','cup','fish'
  ].map(w => ({ id: 'word_' + w, text: w })),

  // === Sight words (~40) ===
  ...['the','is','my','can','see','to','I','no','go','into',
  'he','she','we','me','be','was','you','they','all','are','her',
  'said','have','like','so','do','some','come','were','there','little','one','when','out','what',
  'oh','their','people','looked','called','asked','could','water','where','who','many','because','for','in','it','at'
  ].map(w => ({ id: 'word_' + w, text: w })),

  // === Cheers (5) ===
  { id: 'cheer_great', text: 'Great!' },
  { id: 'cheer_awesome', text: 'Awesome!' },
  { id: 'cheer_yes', text: 'Yes!' },
  { id: 'cheer_super', text: 'Super!' },
  { id: 'cheer_wow', text: 'Wow!' },
];

async function generateClip(clip) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: clip.text,
      voice: VOICE,
      response_format: 'mp3',
      speed: 0.9,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed for "${clip.id}": ${res.status} ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const bundle = {};
  let done = 0;

  for (const clip of clips) {
    const mp3Path = path.join(AUDIO_DIR, `${clip.id}.mp3`);

    // Skip if already generated
    if (fs.existsSync(mp3Path)) {
      console.log(`[${++done}/${clips.length}] Skipping ${clip.id} (exists)`);
      const buf = fs.readFileSync(mp3Path);
      bundle[clip.id] = 'data:audio/mpeg;base64,' + buf.toString('base64');
      continue;
    }

    console.log(`[${++done}/${clips.length}] Generating: ${clip.id} ("${clip.text}")`);
    const buf = await generateClip(clip);
    fs.writeFileSync(mp3Path, buf);
    bundle[clip.id] = 'data:audio/mpeg;base64,' + buf.toString('base64');

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync(BUNDLE_FILE, JSON.stringify(bundle, null, 2));
  console.log(`\nDone! ${clips.length} clips generated.`);
  console.log(`MP3 files: ${AUDIO_DIR}/`);
  console.log(`Bundle: ${BUNDLE_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
