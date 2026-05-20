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

  // === Rhyme targets + picture words not already covered ===
  ...['apple','bug','dip','hat','ice','mop','net','pig','sit','star','sun','tree'
  ].map(w => ({ id: 'word_' + w, text: w })),

  // === Numbers (referenced by Math renderers) ===
  { id: 'num_0', text: 'zero' },
  { id: 'num_1', text: 'one' },
  { id: 'num_2', text: 'two' },
  { id: 'num_3', text: 'three' },
  { id: 'num_4', text: 'four' },
  { id: 'num_5', text: 'five' },
  { id: 'num_6', text: 'six' },
  { id: 'num_7', text: 'seven' },
  { id: 'num_8', text: 'eight' },
  { id: 'num_9', text: 'nine' },
  { id: 'num_10', text: 'ten' },
  { id: 'num_11', text: 'eleven' },
  { id: 'num_12', text: 'twelve' },
  { id: 'num_15', text: 'fifteen' },
  { id: 'num_18', text: 'eighteen' },
  { id: 'num_20', text: 'twenty' },
  { id: 'num_25', text: 'twenty-five' },
  { id: 'num_30', text: 'thirty' },

  // === Prompt audio (spoken question text) ===
  { id: 'prompt_Apple_starts_with_', text: "Apple starts with?" },
  { id: 'prompt_Blend_the_sounds_', text: "Blend the sounds!" },
  { id: 'prompt_Build_it_', text: "Build it!" },
  { id: 'prompt_Count_all_the_dots_', text: "Count all the dots!" },
  { id: 'prompt_Count_all_together_', text: "Count all together!" },
  { id: 'prompt_Count_backwards_', text: "Count backwards!" },
  { id: 'prompt_Count_by_twos_',  text: 'Count by twos!' },
  { id: 'prompt_Count_by_fives_', text: 'Count by fives!' },
  { id: 'prompt_Fill_in_the_blank_', text: "Fill in the blank!" },
  { id: 'prompt_Fill_in_the_gap_', text: "Fill in the gap!" },
  { id: 'prompt_How_many_dots_', text: "How many dots?" },
  { id: 'prompt_How_many_together_', text: "How many together?" },
  { id: 'prompt_Ink_starts_with_', text: "Ink starts with?" },
  { id: 'prompt_Match_the_lowercase_', text: "Match the lowercase!" },
  { id: 'prompt_Missing_letter_', text: "Missing letter!" },
  { id: 'prompt_Pig_starts_with_', text: "Pig starts with?" },
  { id: 'prompt_Solve_it_', text: "Solve it!" },
  { id: 'prompt_Sun_starts_with_', text: "Sun starts with?" },
  { id: 'prompt_Tap_the_group_with_LESS_', text: "Tap the group with LESS!" },
  { id: 'prompt_Tap_the_group_with_MORE_', text: "Tap the group with MORE!" },
  { id: 'prompt_Tap_the_letter_you_hear_', text: "Tap the letter you hear!" },
  { id: 'prompt_Tap_the_picture_', text: "Tap the picture!" },
  { id: 'prompt_Tap_the_sound_you_hear_', text: "Tap the sound you hear!" },
  { id: 'prompt_Tree_starts_with_', text: "Tree starts with?" },
  { id: 'prompt_What_comes_first_', text: "What comes first?" },
  { id: 'prompt_What_comes_next_', text: "What comes next?" },
  { id: 'prompt_What_is_missing_', text: "What is missing?" },
  { id: 'prompt_What_number_is_missing_', text: "What number is missing?" },
  { id: 'prompt_What_rhymes_with_BED_', text: "What rhymes with BED?" },
  { id: 'prompt_What_rhymes_with_BUG_', text: "What rhymes with BUG?" },
  { id: 'prompt_What_rhymes_with_CAT_', text: "What rhymes with CAT?" },
  { id: 'prompt_What_rhymes_with_CUP_', text: "What rhymes with CUP?" },
  { id: 'prompt_What_rhymes_with_DIP_', text: "What rhymes with DIP?" },
  { id: 'prompt_What_rhymes_with_FAN_', text: "What rhymes with FAN?" },
  { id: 'prompt_What_rhymes_with_HAT_', text: "What rhymes with HAT?" },
  { id: 'prompt_What_rhymes_with_HEN_', text: "What rhymes with HEN?" },
  { id: 'prompt_What_rhymes_with_HOP_', text: "What rhymes with HOP?" },
  { id: 'prompt_What_rhymes_with_LOG_', text: "What rhymes with LOG?" },
  { id: 'prompt_What_rhymes_with_MAP_', text: "What rhymes with MAP?" },
  { id: 'prompt_What_rhymes_with_MOP_', text: "What rhymes with MOP?" },
  { id: 'prompt_What_rhymes_with_NET_', text: "What rhymes with NET?" },
  { id: 'prompt_What_rhymes_with_PAN_', text: "What rhymes with PAN?" },
  { id: 'prompt_What_rhymes_with_PEN_', text: "What rhymes with PEN?" },
  { id: 'prompt_What_rhymes_with_PIG_', text: "What rhymes with PIG?" },
  { id: 'prompt_What_rhymes_with_PIN_', text: "What rhymes with PIN?" },
  { id: 'prompt_What_rhymes_with_RING_', text: "What rhymes with RING?" },
  { id: 'prompt_What_rhymes_with_RUG_', text: "What rhymes with RUG?" },
  { id: 'prompt_What_rhymes_with_SAT_', text: "What rhymes with SAT?" },
  { id: 'prompt_What_rhymes_with_SIT_', text: "What rhymes with SIT?" },
  { id: 'prompt_What_rhymes_with_STAR_', text: "What rhymes with STAR?" },
  { id: 'prompt_What_rhymes_with_TIP_', text: "What rhymes with TIP?" },
  { id: 'prompt_Which_is_BIGGER_', text: "Which is BIGGER?" },
  { id: 'prompt_Which_letter_is_this_', text: "Which letter is this?" },
  { id: 'prompt_Which_number_is_BIGGER_', text: "Which number is BIGGER?" },
  { id: 'prompt_Which_word_says__I__', text: "Which word says \"I\"?" },
  { id: 'prompt_Which_word_says__all__', text: "Which word says \"all\"?" },
  { id: 'prompt_Which_word_says__are__', text: "Which word says \"are\"?" },
  { id: 'prompt_Which_word_says__asked__', text: "Which word says \"asked\"?" },
  { id: 'prompt_Which_word_says__be__', text: "Which word says \"be\"?" },
  { id: 'prompt_Which_word_says__because__', text: "Which word says \"because\"?" },
  { id: 'prompt_Which_word_says__called__', text: "Which word says \"called\"?" },
  { id: 'prompt_Which_word_says__come__', text: "Which word says \"come\"?" },
  { id: 'prompt_Which_word_says__could__', text: "Which word says \"could\"?" },
  { id: 'prompt_Which_word_says__do__', text: "Which word says \"do\"?" },
  { id: 'prompt_Which_word_says__go__', text: "Which word says \"go\"?" },
  { id: 'prompt_Which_word_says__have__', text: "Which word says \"have\"?" },
  { id: 'prompt_Which_word_says__he__', text: "Which word says \"he\"?" },
  { id: 'prompt_Which_word_says__her__', text: "Which word says \"her\"?" },
  { id: 'prompt_Which_word_says__into__', text: "Which word says \"into\"?" },
  { id: 'prompt_Which_word_says__like__', text: "Which word says \"like\"?" },
  { id: 'prompt_Which_word_says__little__', text: "Which word says \"little\"?" },
  { id: 'prompt_Which_word_says__looked__', text: "Which word says \"looked\"?" },
  { id: 'prompt_Which_word_says__many__', text: "Which word says \"many\"?" },
  { id: 'prompt_Which_word_says__me__', text: "Which word says \"me\"?" },
  { id: 'prompt_Which_word_says__my__', text: "Which word says \"my\"?" },
  { id: 'prompt_Which_word_says__no__', text: "Which word says \"no\"?" },
  { id: 'prompt_Which_word_says__oh__', text: "Which word says \"oh\"?" },
  { id: 'prompt_Which_word_says__one__', text: "Which word says \"one\"?" },
  { id: 'prompt_Which_word_says__out__', text: "Which word says \"out\"?" },
  { id: 'prompt_Which_word_says__people__', text: "Which word says \"people\"?" },
  { id: 'prompt_Which_word_says__said__', text: "Which word says \"said\"?" },
  { id: 'prompt_Which_word_says__she__', text: "Which word says \"she\"?" },
  { id: 'prompt_Which_word_says__so__', text: "Which word says \"so\"?" },
  { id: 'prompt_Which_word_says__some__', text: "Which word says \"some\"?" },
  { id: 'prompt_Which_word_says__the__', text: "Which word says \"the\"?" },
  { id: 'prompt_Which_word_says__their__', text: "Which word says \"their\"?" },
  { id: 'prompt_Which_word_says__there__', text: "Which word says \"there\"?" },
  { id: 'prompt_Which_word_says__they__', text: "Which word says \"they\"?" },
  { id: 'prompt_Which_word_says__to__', text: "Which word says \"to\"?" },
  { id: 'prompt_Which_word_says__was__', text: "Which word says \"was\"?" },
  { id: 'prompt_Which_word_says__water__', text: "Which word says \"water\"?" },
  { id: 'prompt_Which_word_says__we__', text: "Which word says \"we\"?" },
  { id: 'prompt_Which_word_says__were__', text: "Which word says \"were\"?" },
  { id: 'prompt_Which_word_says__what__', text: "Which word says \"what\"?" },
  { id: 'prompt_Which_word_says__when__', text: "Which word says \"when\"?" },
  { id: 'prompt_Which_word_says__where__', text: "Which word says \"where\"?" },
  { id: 'prompt_Which_word_says__who__', text: "Which word says \"who\"?" },
  { id: 'prompt_Which_word_says__you__', text: "Which word says \"you\"?" },

  // === Feedback clips ===
  { id: 'sfx_oops',         text: 'Oops!' },
  { id: 'praise_perfect',   text: 'Perfect!' },
  { id: 'praise_great',     text: 'Great job!' },
  { id: 'praise_keepgoing', text: 'Keep going!' },

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
