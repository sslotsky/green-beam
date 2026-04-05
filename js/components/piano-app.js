import { Audio } from '../audio.js';
import { Recorder } from '../recorder.js';
import { Midi } from '../midi.js';
import { loadFromHash, encode } from '../sharing.js';

export class PianoApp extends HTMLElement {
  constructor() {
    super();
    this.audio = new Audio();
    this.recorder = new Recorder();
    this.midi = new Midi();
    this.canvasComponents = [];
    this._animating = false;
  }

  connectedCallback() {
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');

    // Load shared recording
    const shared = loadFromHash();
    if (shared) {
      const hash = encode(shared.events);
      const existing = this.recorder.recordings.find(r => r.hash === hash);
      if (existing) {
        this.sharedRecording = existing;
      } else {
        const displayName = shared.name || 'Shared Song';
        this.sharedRecording = {
          name: displayName,
          timestamp: new Date(),
          events: shared.events,
          hash,
          shared: true,
        };
        this.recorder.recordings.push(this.sharedRecording);
        this.recorder._save();
      }
      history.replaceState(null, '', location.pathname);
    }

    // Load default instrument
    this.audio.load('acoustic_grand_piano');

    // Start animation loop
    this._animating = true;
    this._loop();
  }

  registerCanvasComponent(component) {
    this.canvasComponents.push(component);
  }

  canvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  _loop() {
    if (!this._animating) return;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const c of this.canvasComponents) {
      if (c.update) c.update();
      c.draw(ctx);
    }

    requestAnimationFrame(() => this._loop());
  }

  disconnectedCallback() {
    this._animating = false;
  }
}

customElements.define('piano-app', PianoApp);
