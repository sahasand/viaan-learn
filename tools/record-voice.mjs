// Records every line the learning games speak, in one natural voice, into ../audio, and
// writes play-kit/voice.js so the games know which lines have a recording.
//
//   node tools/record-voice.mjs --dry            list what would be recorded; spends nothing
//   node tools/record-voice.mjs                  record what is missing
//   node tools/record-voice.mjs --voice=cedar    choose the voice (default marin)
//   node tools/record-voice.mjs --redo=num,word,cheer,praise[,phon]
//                                                also re-record those older clips in this voice
//   node tools/record-voice.mjs --only=word_bat,num_9
//                                                record just those clips again, whatever kind they are
//
//   node tools/record-voice.mjs --trim           only cut the silence off the clips in the plan
//
// Each clip has the silence cut off both ends, so lines joined from several clips run
// together like one sentence, and a clip that comes back silent is asked for again. Both
// need macOS's afconvert to listen to the clip; without it clips are saved as they come.
//
// Needs OPENAI_API_KEY in the environment or in ../.env. Files already there are kept
// unless --redo names their kind, so a stopped run can simply be started again.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { lineId, kitLines, SPOKEN_NUMBERS } from '../play-kit/progress.js';
import { lines as mathLines } from '../number-playground/rules.js';
import { lines as storyLines } from '../story-garden/rules.js';
import { lines as caseLines } from '../little-detective/rules.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), audio = path.join(root, 'audio');
const arg = name => process.argv.find(a => a === '--' + name || a.startsWith('--' + name + '='))?.split('=')[1] ?? (process.argv.includes('--' + name) ? true : null);
const dry = arg('dry'), voice = typeof arg('voice') === 'string' ? arg('voice') : 'marin', only = typeof arg('only') === 'string' ? arg('only').split(',') : null;
const redo = only ? ['num', 'word', 'cheer', 'praise', 'phon'] : typeof arg('redo') === 'string' ? arg('redo').split(',') : [];
const has = id => fs.existsSync(path.join(audio, id + '.mp3'));
const TONE = 'Speak warmly, clearly and a little slowly, like a friendly early-childhood teacher talking with a four-year-old. Bright and encouraging, never shouting.';
const HOW = {
  line: TONE + ' Read the text exactly as written, word for word, adding nothing. Where it says "blank", say the word "blank". If the text is only part of a sentence, say it the way it would sound inside the sentence.',
  num: 'Say this number clearly with a warm smile, as when counting with a four-year-old.',
  word: 'Say this one word slowly and clearly, with a warm smile, for a child learning to read.',
  cheer: 'Say this with bright, warm joy, cheering a four-year-old who got something right. Genuine, not over the top.',
  phon: 'Pronounce this single letter sound slowly and clearly, the way an early-childhood teacher does when teaching phonics. Just the sound, not the letter name.'
};

// Everything to record: the games' lines, the numbers they count with, and any older clips asked for.
const plan = [];
for (const text of new Set([...kitLines(), ...mathLines(), ...storyLines(), ...caseLines()])) plan.push({ id: lineId(text), text: text.replace(/_{2,}/g, 'blank'), kind: 'line', line: text });
for (const n of SPOKEN_NUMBERS) plan.push({ id: 'num_' + n, text: String(n), kind: 'num' });
if (redo.length) {
  const old = fs.readFileSync(path.join(root, 'generate-audio.js'), 'utf8');
  for (const [, id, text] of old.matchAll(/\{\s*id:\s*'([^']+)',\s*text:\s*'((?:[^'\\]|\\.)*)'/g)) {
    const kind = id.split('_')[0] === 'praise' ? 'cheer' : id.split('_')[0];
    if (redo.includes(id.split('_')[0]) && HOW[kind] && !plan.some(p => p.id === id)) plan.push({ id, text: text.replace(/\\'/g, "'"), kind });
  }
}
// Word clips are named after their word, so the folder itself is the list.
if (redo.includes('word')) for (const file of fs.readdirSync(audio)) if (file.startsWith('word_')) plan.push({ id: file.slice(0, -4), text: file.slice(5, -4), kind: 'word' });
const todo = only ? plan.filter(p => only.includes(p.id)) : plan.filter(p => !has(p.id) || redo.includes(p.id.split('_')[0]));

function writeManifest() {
  const voiced = plan.filter(p => p.kind === 'line' && has(p.id)).map(p => p.id).sort(), numbers = SPOKEN_NUMBERS.filter(n => has('num_' + n));
  fs.writeFileSync(path.join(root, 'play-kit', 'voice.js'), `// Which spoken lines and numbers have a recording in ../audio. Written by
// tools/record-voice.mjs; do not edit by hand. A line with no recording here is spoken
// by the device voice instead.
export const VOICED = new Set(${JSON.stringify(voiced)});
export const NUMBERS = new Set(${JSON.stringify(numbers)});
`);
  return voiced.length;
}

/* ---------- cutting silence ---------- */
// An MP3 is a row of short frames, so whole frames can be dropped from either end without
// encoding the sound again. The clip is decoded once to find where the sound is.
const QUIET = 250, LEAD = .12, TAIL = .12, canListen = fs.existsSync('/usr/bin/afconvert');
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const KBPS = { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
function framesOf(buf) {
  const out = []; let at = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') at = 10 + ((buf[6] & 127) << 21 | (buf[7] & 127) << 14 | (buf[8] & 127) << 7 | buf[9] & 127);
  while (at + 4 <= buf.length) {
    const version = buf[at + 1] >> 3 & 3, kbps = KBPS[version === 3 ? 3 : 2][buf[at + 2] >> 4], rate = RATES[version]?.[buf[at + 2] >> 2 & 3];
    if (buf[at] !== 0xff || (buf[at + 1] & 0xe6) !== 0xe2 || !kbps || !rate) { at++; continue; }   // not the start of a Layer III frame
    const samples = version === 3 ? 1152 : 576, size = Math.floor(samples / 8 * kbps * 1000 / rate) + (buf[at + 2] >> 1 & 1);
    out.push({ at, size, seconds: samples / rate }); at += size;
  }
  return out;
}
// Returns 'silent' when the clip holds no sound at all, else 'trimmed' or 'kept'.
function trim(id) {
  if (!canListen) return 'kept';
  const file = path.join(audio, id + '.mp3'), wav = path.join(os.tmpdir(), `viaan-voice-${process.pid}-${id}.wav`);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1', file, wav]);
  const pcm = fs.readFileSync(wav), start = pcm.indexOf('data') + 8, count = (pcm.length - start) >> 1; fs.unlinkSync(wav);
  let first = -1, last = -1;
  for (let i = 0; i < count; i++) if (Math.abs(pcm.readInt16LE(start + i * 2)) > QUIET) { if (first < 0) first = i; last = i; }
  if (first < 0) return 'silent';
  const buf = fs.readFileSync(file), all = framesOf(buf), each = all[0].seconds;
  const from = Math.max(0, Math.floor((first / 24000 - LEAD) / each)), to = Math.min(all.length, Math.ceil((last / 24000 + TAIL) / each) + 1);
  if (from === 0 && to === all.length) return 'kept';
  fs.writeFileSync(file, Buffer.concat(all.slice(from, to).map(f => buf.subarray(f.at, f.at + f.size))));
  return 'trimmed';
}
if (arg('trim')) { const n = plan.filter(p => has(p.id) && (!only || only.includes(p.id))).map(p => trim(p.id)); console.log(`${n.filter(r => r === 'trimmed').length} clips trimmed, ${n.filter(r => r === 'kept').length} already tight, ${n.filter(r => r === 'silent').length} silent.`); process.exit(0); }

const seconds = todo.reduce((n, p) => n + 0.6 + p.text.length / 13, 0);
console.log(`${plan.length} clips in the plan, ${todo.length} to record with voice "${voice}" (about ${Math.round(seconds / 60)} minutes of speech).`);
if (dry) { for (const kind of Object.keys(HOW)) { const n = todo.filter(p => p.kind === kind).length; if (n) console.log(`  ${kind}: ${n}`); } console.log('Dry run: nothing recorded.'); process.exit(0); }

const envFile = path.join(root, '.env');
if (!process.env.OPENAI_API_KEY && fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const [key, ...value] = line.split('='); if (key.trim() === 'OPENAI_API_KEY') process.env.OPENAI_API_KEY = value.join('=').trim(); }
if (!process.env.OPENAI_API_KEY) { console.error('Set OPENAI_API_KEY in the environment or in .env'); process.exit(1); }

async function record(clip) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: clip.text, instructions: HOW[clip.kind], response_format: 'mp3' }) });
    if (response.ok) { fs.writeFileSync(path.join(audio, clip.id + '.mp3'), Buffer.from(await response.arrayBuffer())); if (trim(clip.id) !== 'silent') return true; }
    const problem = response.ok ? 'came back silent' : `${response.status} ${(await response.text()).slice(0, 160)}`;
    if (attempt >= 3 || (!response.ok && response.status < 500 && response.status !== 429)) { console.error(`  failed ${clip.id}: ${problem}`); return false; }
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}
let done = 0, failed = 0; const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length && failed < 8) { (await record(queue.shift())) ? done++ : failed++; if ((done + failed) % 40 === 0) console.log(`  ${done + failed} of ${todo.length}`); } }));
console.log(`Recorded ${done}, failed ${failed}${failed >= 8 ? ' (stopped early)' : ''}. ${writeManifest()} lines now have a recording.`);
