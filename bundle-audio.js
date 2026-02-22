const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'index.html');
const BUNDLE_FILE = path.join(__dirname, 'audio-bundle.json');

if (!fs.existsSync(BUNDLE_FILE)) {
  console.error('audio-bundle.json not found. Run generate-audio.js first.');
  process.exit(1);
}

const bundle = JSON.parse(fs.readFileSync(BUNDLE_FILE, 'utf8'));
let html = fs.readFileSync(HTML_FILE, 'utf8');

// Build the AUDIO object as a JS string
const audioObj = 'var AUDIO=' + JSON.stringify(bundle) + ';\n';

// New playback functions
const newFunctions = `
${audioObj}
var _curAudio=null;
function playClip(id){
  if(_curAudio){try{_curAudio.pause();_curAudio.currentTime=0}catch(e){}_curAudio=null}
  var src=AUDIO[id];
  if(!src)return;
  _curAudio=new Audio(src);
  _curAudio.play();
}
function speakSound(letter){playClip('phon_'+letter)}
function speakWord(w){playClip('word_'+w.replace(/[^a-zA-Z]/g,'_'))}
function cheer(){var c=['great','awesome','yes','super','wow'];playClip('cheer_'+c[Math.floor(Math.random()*c.length)])}
`;

// Find and replace the exact speech block
const oldStart = '// Speech\nfunction speak(txt)';
const oldEnd = "function cheer(){var c=['Great!','Awesome!','Yes!','Super!','Wow!'];speak(c[Math.floor(Math.random()*c.length)])}";

const startIdx = html.indexOf(oldStart);
const endIdx = html.indexOf(oldEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find the speech functions block to replace.');
  console.error('startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

html = html.slice(0, startIdx) + newFunctions.trim() + html.slice(endIdx + oldEnd.length);

fs.writeFileSync(HTML_FILE, html);

const clipCount = Object.keys(bundle).length;
const sizeKB = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Bundled ${clipCount} audio clips into index.html`);
console.log(`New file size: ${sizeKB} KB`);
