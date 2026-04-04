import { Audio } from '../audio.js';
import { Recorder } from '../recorder.js';
import { loadFromHash, encode } from '../sharing.js';

export class PianoApp extends HTMLElement {
  constructor() {
    super();
    this.audio = new Audio();
    this.recorder = new Recorder();
    this.canvasComponents = [];
    this._animating = false;
  }

  connectedCallback() {
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');

    // Load shared recording
    const sharedEvents = loadFromHash();
    if (sharedEvents) {
      const hash = encode(sharedEvents);
      const existing = this.recorder.recordings.find(r => r.hash === hash);
      if (existing) {
        this.sharedRecording = existing;
      } else {
        this.sharedRecording = {
          name: 'Shared Song',
          timestamp: new Date(),
          events: sharedEvents,
          hash,
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
