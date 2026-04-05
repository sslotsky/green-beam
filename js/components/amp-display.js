export class AmpDisplay extends HTMLElement {
  constructor() {
    super();
    this.hover = false;
  }

  connectedCallback() {
    this.app = this.closest('piano-app');
    const canvas = this.app.canvas;
    this.x = parseInt(this.getAttribute('x') || String(canvas.width - 100));
    this.y = parseInt(this.getAttribute('y') || String(canvas.height - 150));
    this.w = 80;
    this.h = 140;

    canvas.addEventListener('mousedown', (e) => {
      const { x: px, y: py } = this.app.canvasCoords(e);
      if (this.containsPoint(px, py)) {
        this.dispatchEvent(new CustomEvent('amp-click', { bubbles: true }));
      }
    });

    canvas.addEventListener('touchstart', (e) => {
      const { x: px, y: py } = this.app.canvasCoords(e);
      if (this.containsPoint(px, py)) {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('amp-click', { bubbles: true }));
      }
    }, { passive: false });

    canvas.addEventListener('mousemove', (e) => {
      const { x: px, y: py } = this.app.canvasCoords(e);
      const wasHover = this.hover;
      this.hover = this.containsPoint(px, py);
      if (this.hover && !wasHover) canvas.style.cursor = 'pointer';
      else if (!this.hover && wasHover && !this._otherHover(canvas)) canvas.style.cursor = 'default';
    });

    this.app.registerCanvasComponent(this);
  }

  _otherHover(canvas) {
    // Don't reset cursor if jukebox is hovered
    const jb = this.app.querySelector('jukebox-display');
    return jb && jb._hover;
  }

  containsPoint(px, py) {
    return px >= this.x && px < this.x + this.w &&
           py >= this.y && py < this.y + this.h;
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    const cx = x + w / 2;
    const connected = this.app.midi && this.app.midi.activeInput;

    if (this.hover) {
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 15;
    }

    // Amp body
    const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
    bodyGrad.addColorStop(0, '#2a2a2a');
    bodyGrad.addColorStop(0.3, '#3a3a3a');
    bodyGrad.addColorStop(0.5, '#444');
    bodyGrad.addColorStop(0.7, '#3a3a3a');
    bodyGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // Top panel
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, 40, 4);
    ctx.fill();

    // Status LED
    ctx.beginPath();
    ctx.arc(x + 15, y + 15, 4, 0, Math.PI * 2);
    ctx.fillStyle = connected ? '#00ff40' : '#cc0000';
    if (connected) {
      ctx.shadowColor = '#00ff40';
      ctx.shadowBlur = 6;
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Status text
    ctx.fillStyle = connected ? '#00ff40' : '#666';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(connected ? 'CONNECTED' : 'NO DEVICE', x + 23, y + 18);

    // Knobs row
    for (let i = 0; i < 3; i++) {
      const kx = x + 15 + i * 22;
      const ky = y + 35;
      // Knob base
      ctx.beginPath();
      ctx.arc(kx, ky, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#555';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(kx, ky, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#333';
      ctx.fill();
      // Knob indicator
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx, ky - 5);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Speaker grille
    const grillY = y + 55;
    const grillH = 80;
    ctx.fillStyle = '#1a1a0a';
    ctx.beginPath();
    ctx.roundRect(x + 8, grillY, w - 16, grillH, 4);
    ctx.fill();

    // Speaker mesh pattern
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let row = 0; row < 12; row++) {
      const ly = grillY + 5 + row * 6;
      ctx.beginPath();
      ctx.moveTo(x + 12, ly);
      ctx.lineTo(x + w - 12, ly);
      ctx.stroke();
    }

    // Speaker cone circle
    const scx = cx;
    const scy = grillY + grillH / 2;
    ctx.beginPath();
    ctx.arc(scx, scy, 20, 0, Math.PI * 2);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scx, scy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#444';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(scx, scy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Bottom trim
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#666';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MIDI', cx, y + h - 12);
    ctx.textAlign = 'left';

    if (this.hover) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }
}

customElements.define('amp-display', AmpDisplay);
