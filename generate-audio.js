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
  // Phonics sounds (26)
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
  { id: 'phon_Q', text: 'kwuh' },
  { id: 'phon_R', text: 'rrr' },
  { id: 'phon_S', text: 'sss' },
  { id: 'phon_T', text: 'tuh' },
  { id: 'phon_U', text: 'uh' },
  { id: 'phon_V', text: 'vvv' },
  { id: 'phon_W', text: 'wuh' },
  { id: 'phon_X', text: 'ks' },
  { id: 'phon_Y', text: 'yuh' },
  { id: 'phon_Z', text: 'zzz' },

  // Sight words (5)
  { id: 'word_the', text: 'the' },
  { id: 'word_is', text: 'is' },
  { id: 'word_my', text: 'my' },
  { id: 'word_can', text: 'can' },
  { id: 'word_see', text: 'see' },

  // Sentences (5)
  { id: 'word_I_see_a_cat_', text: 'I see a cat.' },
  { id: 'word_This_is_my_dog_', text: 'This is my dog.' },
  { id: 'word_I_can_see_it_', text: 'I can see it.' },
  { id: 'word_The_cat_is_big_', text: 'The cat is big.' },
  { id: 'word_I_can_run_fast_', text: 'I can run fast!' },

  // Cheers (5)
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
