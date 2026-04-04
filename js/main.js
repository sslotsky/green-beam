import { PianoKey } from './piano-key.js';
import { Jukebox } from './jukebox.js';
import { Audio } from './audio.js';
import { Recorder } from './recorder.js';
import { makeShareUrl, loadFromHash, encode } from './sharing.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// --- Layout ---
const whiteKeyWidth = 36;
const whiteKeyHeight = 150;
const blackKeyWidth = 22;
const blackKeyHeight = 100;
const bodyPadding = 12;
const bodyTop = canvas.height - whiteKeyHeight - bodyPadding * 2;
const pianoY = bodyTop + bodyPadding;
const numOctaves = 3;
const pianoWidth = numOctaves * 7 * whiteKeyWidth;
const pianoX = (canvas.width - pianoWidth) / 2 + 30;
const bodyX = pianoX - bodyPadding;
const bodyWidth = pianoWidth + bodyPadding * 2;
const bodyHeight = canvas.height - bodyTop;
const blackKeyAfter = new Set([0, 1, 3, 4, 5]);

// --- Services ---
const audio = new Audio();
const recorder = new Recorder();

// --- Load shared recording from URL hash ---
const sharedEvents = loadFromHash();
let sharedRecording = null;
if (sharedEvents) {
  const hash = encode(sharedEvents);
  const existing = recorder.recordings.find(r => r.hash === hash);
  if (existing) {
    sharedRecording = existing;
  } else {
    sharedRecording = {
      name: 'Shared Song',
      timestamp: new Date(),
      events: sharedEvents,
      hash,
    };
    recorder.recordings.push(sharedRecording);
    recorder._save();
  }
  history.replaceState(null, '', location.pathname);
}

// --- Instrument selector ---
const instrumentSelect = document.getElementById('instrument');
Audio.instruments.forEach(name => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name.replace(/_/g, ' ');
  instrumentSelect.appendChild(opt);
});
audio.load('acoustic_grand_piano');
instrumentSelect.addEventListener('change', () => audio.load(instrumentSelect.value));

// --- Record button ---
const recordBtn = document.getElementById('recordBtn');
const recDot = document.getElementById('recDot');

recordBtn.addEventListener('click', () => {
  if (recorder.recording) {
    recorder.stop();
    recDot.style.background = '#cc0000';
    recDot.style.boxShadow = 'none';
  } else {
    recorder.start();
    recDot.style.background = '#ff0000';
    recDot.style.boxShadow = '0 0 6px #ff0000';
  }
});

// --- Build piano keys ---
const whiteKeys = [];
const blackKeys = [];
const allKeys = [];
const keysByLabel = {};

const whiteLabels = ['z','x','c','v','b','n','m','a','s','d','f','g','h','j','q','w','e','r','t','y','u'];
const blackLabels = ['1','2','3','4','5','6','7','8','9','0','-','=','[',']','\\'];
const whiteMidiOffsets = [0, 2, 4, 5, 7, 9, 11];
const blackMidiOffsets = [1, 3, 6, 8, 10];
const startMidi = 48; // C3
const beamWidth = blackKeyWidth - 10;

let whiteIndex = 0;
let blackIndex = 0;

for (let oct = 0; oct < numOctaves; oct++) {
  let blackMidiIndex = 0;
  for (let i = 0; i < 7; i++) {
    const x = pianoX + (oct * 7 + i) * whiteKeyWidth;
    const label = whiteLabels[whiteIndex] || null;
    const midi = startMidi + oct * 12 + whiteMidiOffsets[i];
    const key = new PianoKey(x, pianoY, whiteKeyWidth, whiteKeyHeight, false, label, midi, { beamWidth, beamOriginY: bodyTop, audio, recorder });
    whiteKeys.push(key);
    if (label) keysByLabel[label] = key;
    whiteIndex++;

    if (blackKeyAfter.has(i)) {
      const bx = x + whiteKeyWidth - blackKeyWidth / 2;
      const bLabel = blackLabels[blackIndex] || null;
      const bMidi = startMidi + oct * 12 + blackMidiOffsets[blackMidiIndex];
      const bKey = new PianoKey(bx, pianoY, blackKeyWidth, blackKeyHeight, true, bLabel, bMidi, { beamWidth, beamOriginY: bodyTop, audio, recorder });
      blackKeys.push(bKey);
      if (bLabel) keysByLabel[bLabel] = bKey;
      blackIndex++;
      blackMidiIndex++;
    }
  }
}

allKeys.push(...whiteKeys, ...blackKeys);

// --- Jukebox ---
const jukebox = new Jukebox(20, canvas.height - 160, 80, 150);
const overlay = document.getElementById('overlay');
const recordingList = document.getElementById('recordingList');
const cancelBtn = document.getElementById('cancelBtn');
const playBtn = document.getElementById('playBtn');
let selectedIndex = -1;

function selectLi(li, rec) {
  recordingList.querySelectorAll('li').forEach(el => el.classList.remove('selected'));
  li.classList.add('selected');
  selectedIndex = recorder.recordings.indexOf(rec);
}

function renderList(preselect = null) {
  recordingList.innerHTML = '';
  selectedIndex = -1;
  shareStatus.style.display = 'none';
  if (recorder.recordings.length === 0) {
    recordingList.innerHTML = '<li class="empty">No recordings yet</li>';
    return;
  }
  const sorted = recorder.recordings.slice().sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach(rec => {
    const li = document.createElement('li');
    const timeStr = rec.timestamp.toLocaleTimeString();
    const noteCount = rec.events.filter(e => e.type === 'on').length;
    li.innerHTML = `<span>${rec.name}</span><span style="color:#888">${noteCount} notes - ${timeStr}</span>`;
    li.addEventListener('click', () => selectLi(li, rec));
    if (rec === preselect) selectLi(li, rec);
    recordingList.appendChild(li);
  });
}

function openJukebox(preselect = null) {
  renderList(preselect);
  overlay.classList.add('open');
}

const shareBtn = document.getElementById('shareBtn');
const shareStatus = document.getElementById('shareStatus');

cancelBtn.addEventListener('click', () => overlay.classList.remove('open'));
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
playBtn.addEventListener('click', () => {
  if (selectedIndex < 0) return;
  overlay.classList.remove('open');
  recorder.playRecording(recorder.recordings[selectedIndex], allKeys);
});

shareBtn.addEventListener('click', () => {
  if (selectedIndex < 0) return;
  const rec = recorder.recordings[selectedIndex];
  const { url, truncated, totalNotes, sharedNotes } = makeShareUrl(rec.events);
  navigator.clipboard.writeText(url);
  if (truncated) {
    shareStatus.textContent = `Link copied! Sharing first ${sharedNotes} of ${totalNotes} notes.`;
  } else {
    shareStatus.textContent = 'Link copied to clipboard!';
  }
  shareStatus.style.display = 'block';
});


// --- Mouse interaction ---
let mouseKey = null;

function keyAtPoint(px, py) {
  for (const key of blackKeys) { if (key.containsPoint(px, py)) return key; }
  for (const key of whiteKeys) { if (key.containsPoint(px, py)) return key; }
  return null;
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (jukebox.containsPoint(x, y)) { openJukebox(); return; }
  mouseKey = keyAtPoint(x, y);
  if (mouseKey) mouseKey.press();
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  jukebox.hover = jukebox.containsPoint(mx, my);
  canvas.style.cursor = jukebox.hover ? 'pointer' : 'default';
  if (e.buttons === 0) return;
  const key = keyAtPoint(mx, my);
  if (key !== mouseKey) {
    if (mouseKey) mouseKey.release();
    mouseKey = key;
    if (mouseKey) mouseKey.press();
  }
});

canvas.addEventListener('mouseup', () => {
  if (mouseKey) mouseKey.release();
  mouseKey = null;
});

// --- Keyboard interaction ---
const heldKeys = new Set();

window.addEventListener('keydown', (e) => {
  if (overlay.classList.contains('open')) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  const label = e.key.toLowerCase();
  if (keysByLabel[label] && !heldKeys.has(label)) {
    heldKeys.add(label);
    keysByLabel[label].press();
  }
});

window.addEventListener('keyup', (e) => {
  const label = e.key.toLowerCase();
  if (keysByLabel[label]) {
    heldKeys.delete(label);
    keysByLabel[label].release();
  }
});

// --- Open jukebox for shared songs ---
if (sharedRecording) openJukebox(sharedRecording);

// --- Animation loop ---
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  allKeys.forEach(key => key.update());

  // Keyboard body — wood finish
  const bodyGrad = ctx.createLinearGradient(bodyX, bodyTop, bodyX, bodyTop + bodyHeight);
  bodyGrad.addColorStop(0, '#5C3317');
  bodyGrad.addColorStop(0.15, '#6B3A20');
  bodyGrad.addColorStop(0.5, '#7A4428');
  bodyGrad.addColorStop(0.85, '#6B3A20');
  bodyGrad.addColorStop(1, '#4A2810');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyTop, bodyWidth, bodyHeight, [8, 8, 0, 0]);
  ctx.fill();
  // Wood grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const gy = bodyTop + 3 + i * 3;
    ctx.beginPath();
    ctx.moveTo(bodyX + 4, gy);
    ctx.lineTo(bodyX + bodyWidth - 4, gy);
    ctx.stroke();
  }
  // Edge highlight and border
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyTop, bodyWidth, bodyHeight, [8, 8, 0, 0]);
  ctx.stroke();

  whiteKeys.forEach(key => key.draw(ctx));
  blackKeys.forEach(key => key.draw(ctx));

  jukebox.draw(ctx);

  requestAnimationFrame(loop);
}

loop();
