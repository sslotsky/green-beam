import { Jukebox } from '../jukebox.js';

export class JukeboxDisplay extends HTMLElement {
  constructor() {
    super();
    this._hover = false;
  }

  connectedCallback() {
    this.app = this.closest('piano-app');
    const canvas = this.app.canvas;
    const x = parseInt(this.getAttribute('x') || '20');
    const y = parseInt(this.getAttribute('y') || String(canvas.height - 160));
    const w = parseInt(this.getAttribute('w') || '80');
    const h = parseInt(this.getAttribute('h') || '150');
    this.jukebox = new Jukebox(x, y, w, h);

    canvas.addEventListener('mousedown', (e) => {
      const { x: px, y: py } = this.app.canvasCoords(e);
      if (this.jukebox.containsPoint(px, py)) {
        this.dispatchEvent(new CustomEvent('jukebox-click', { bubbles: true }));
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const { x: px, y: py } = this.app.canvasCoords(e);
      this._hover = this.jukebox.containsPoint(px, py);
      this.jukebox.hover = this._hover;
      canvas.style.cursor = this._hover ? 'pointer' : 'default';
    });

    this.app.registerCanvasComponent(this);
  }

  draw(ctx) {
    this.jukebox.draw(ctx);
  }
}

customElements.define('jukebox-display', JukeboxDisplay);
