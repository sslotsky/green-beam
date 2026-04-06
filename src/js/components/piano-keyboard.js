import { PianoKey } from '../piano-key.js';

const WHITE_KEY_WIDTH = 36;
const WHITE_KEY_HEIGHT = 150;
const BLACK_KEY_WIDTH = 22;
const BLACK_KEY_HEIGHT = 100;
const BODY_PADDING = 12;
const BEAM_WIDTH = BLACK_KEY_WIDTH - 10;
const BLACK_KEY_AFTER = new Set([0, 1, 3, 4, 5]);
const WHITE_MIDI_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_MIDI_OFFSETS = [1, 3, 6, 8, 10];
const WHITE_LABELS = ['z','x','c','v','b','n','m','a','s','d','f','g','h','j','q','w','e','r','t','y','u'];
const BLACK_LABELS = ['1','2','3','4','5','6','7','8','9','0','-','=','[',']','\\'];

export class PianoKeyboard extends HTMLElement {
  constructor() {
    super();
    this.whiteKeys = [];
    this.blackKeys = [];
    this.allKeys = [];
    this.keysByLabel = {};
    this._mouseKey = null;
    this._heldKeys = new Set();
  }

  connectedCallback() {
    this.app = this.closest('piano-app');
    const canvas = this.app.canvas;
    const octaves = parseInt(this.getAttribute('octaves') || '3');
    const startMidi = parseInt(this.getAttribute('start-midi') || '48');
    const offsetX = parseInt(this.getAttribute('offset-x') || '30');
    const offsetY = parseInt(this.getAttribute('offset-y') || '0');

    const pianoWidth = octaves * 7 * WHITE_KEY_WIDTH;
    const pianoX = (canvas.width - pianoWidth) / 2 + offsetX;
    this.bodyX = pianoX - BODY_PADDING;
    this.bodyWidth = pianoWidth + BODY_PADDING * 2;
    this.progressBarSpace = 14;
    this.bodyTop = canvas.height - WHITE_KEY_HEIGHT - BODY_PADDING * 2 - this.progressBarSpace - offsetY;
    this.bodyHeight = WHITE_KEY_HEIGHT + BODY_PADDING * 2;
    const pianoY = this.bodyTop + BODY_PADDING;

    let whiteIndex = 0;
    let blackIndex = 0;

    for (let oct = 0; oct < octaves; oct++) {
      let blackMidiIndex = 0;
      for (let i = 0; i < 7; i++) {
        const x = pianoX + (oct * 7 + i) * WHITE_KEY_WIDTH;
        const label = WHITE_LABELS[whiteIndex] || null;
        const midi = startMidi + oct * 12 + WHITE_MIDI_OFFSETS[i];
        const key = new PianoKey(x, pianoY, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT, false, label, midi, {
          beamWidth: BEAM_WIDTH, beamOriginY: this.bodyTop, audio: this.app.audio, recorder: this.app.recorder,
        });
        this.whiteKeys.push(key);
        if (label) this.keysByLabel[label] = key;
        whiteIndex++;

        if (BLACK_KEY_AFTER.has(i)) {
          const bx = x + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
          const bLabel = BLACK_LABELS[blackIndex] || null;
          const bMidi = startMidi + oct * 12 + BLACK_MIDI_OFFSETS[blackMidiIndex];
          const bKey = new PianoKey(bx, pianoY, BLACK_KEY_WIDTH, BLACK_KEY_HEIGHT, true, bLabel, bMidi, {
            beamWidth: BEAM_WIDTH, beamOriginY: this.bodyTop, audio: this.app.audio, recorder: this.app.recorder,
          });
          this.blackKeys.push(bKey);
          if (bLabel) this.keysByLabel[bLabel] = bKey;
          blackIndex++;
          blackMidiIndex++;
        }
      }
    }

    this.allKeys.push(...this.whiteKeys, ...this.blackKeys);

    // Mouse interaction
    const canvasEl = canvas;
    canvasEl.addEventListener('mousedown', (e) => {
      const { x, y } = this.app.canvasCoords(e);
      if (this._hitPauseBtn(x, y)) return;
      this._mouseKey = this._keyAtPoint(x, y);
      if (this._mouseKey) this._mouseKey.press();
    });

    canvasEl.addEventListener('mousemove', (e) => {
      if (e.buttons === 0) return;
      const { x, y } = this.app.canvasCoords(e);
      const key = this._keyAtPoint(x, y);
      if (key !== this._mouseKey) {
        if (this._mouseKey) this._mouseKey.release();
        this._mouseKey = key;
        if (this._mouseKey) this._mouseKey.press();
      }
    });

    canvasEl.addEventListener('mouseup', () => {
      if (this._mouseKey) this._mouseKey.release();
      this._mouseKey = null;
    });

    // Touch interaction
    canvasEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const { x, y } = this.app.canvasCoords(e);
      if (this._hitPauseBtn(x, y)) return;
      this._mouseKey = this._keyAtPoint(x, y);
      if (this._mouseKey) this._mouseKey.press();
    }, { passive: false });

    canvasEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const { x, y } = this.app.canvasCoords(e);
      const key = this._keyAtPoint(x, y);
      if (key !== this._mouseKey) {
        if (this._mouseKey) this._mouseKey.release();
        this._mouseKey = key;
        if (this._mouseKey) this._mouseKey.press();
      }
    }, { passive: false });

    canvasEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this._mouseKey) this._mouseKey.release();
      this._mouseKey = null;
    });

    // Keyboard interaction
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.altKey || e.ctrlKey) return;
      if (document.querySelector('.overlay.open')) return;
      const label = e.key.toLowerCase();
      if (this.keysByLabel[label] && !this._heldKeys.has(label)) {
        this._heldKeys.add(label);
        this.keysByLabel[label].press();
      }
    });

    window.addEventListener('keyup', (e) => {
      const label = e.key.toLowerCase();
      if (this.keysByLabel[label]) {
        this._heldKeys.delete(label);
        this.keysByLabel[label].release();
      }
    });

    this.app.registerCanvasComponent(this);
  }

  _hitPauseBtn(px, py) {
    const a = this._pauseBtnArea;
    if (!a) return false;
    if (px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) {
      const { recorder } = this.app;
      if (recorder.paused) recorder.resumePlayback();
      else recorder.pausePlayback();
      return true;
    }
    return false;
  }

  _keyAtPoint(px, py) {
    for (const key of this.blackKeys) { if (key.containsPoint(px, py)) return key; }
    for (const key of this.whiteKeys) { if (key.containsPoint(px, py)) return key; }
    return null;
  }

  update() {
    this.allKeys.forEach(key => key.update());
  }

  draw(ctx) {
    // Wood body
    const { bodyX, bodyTop, bodyWidth, bodyHeight } = this;
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
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const gy = bodyTop + 3 + i * 3;
      ctx.beginPath();
      ctx.moveTo(bodyX + 4, gy);
      ctx.lineTo(bodyX + bodyWidth - 4, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8B5E3C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyTop, bodyWidth, bodyHeight, [8, 8, 0, 0]);
    ctx.stroke();

    // Keys
    this.whiteKeys.forEach(key => key.draw(ctx));
    this.blackKeys.forEach(key => key.draw(ctx));

    // Playback progress bar with controls
    const { recorder } = this.app;
    if (recorder.playing) {
      const barHeight = 4;
      const barY = bodyTop + bodyHeight + 6;
      const progress = recorder.progress;
      const btnSize = 10;
      const btnX = bodyX;
      const btnY = barY - 3;
      const trackX = bodyX + btnSize + 8;
      const trackWidth = bodyWidth - btnSize - 8;

      // Pause/Play button
      ctx.fillStyle = '#888';
      if (recorder.paused) {
        // Play triangle
        ctx.beginPath();
        ctx.moveTo(btnX, btnY);
        ctx.lineTo(btnX, btnY + btnSize);
        ctx.lineTo(btnX + btnSize, btnY + btnSize / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // Pause bars
        ctx.fillRect(btnX, btnY, 3, btnSize);
        ctx.fillRect(btnX + 5, btnY, 3, btnSize);
      }

      // Track
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(trackX, barY, trackWidth, barHeight, 2);
      ctx.fill();

      // Fill
      if (progress > 0) {
        const fillWidth = trackWidth * progress;
        ctx.fillStyle = recorder.paused ? '#888' : '#00ff40';
        ctx.beginPath();
        ctx.roundRect(trackX, barY, fillWidth, barHeight, 2);
        ctx.fill();
      }

      // Store hit areas for click handling
      this._pauseBtnArea = { x: btnX, y: btnY, w: btnSize + 4, h: btnSize };
    } else {
      this._pauseBtnArea = null;
    }
  }
}

customElements.define('piano-keyboard', PianoKeyboard);
