export class Platform extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.x = parseInt(this.getAttribute('x') || '10');
    this.y = parseInt(this.getAttribute('y') || '400');
    this.w = parseInt(this.getAttribute('w') || '190');
    this.h = parseInt(this.getAttribute('h') || '12');
    this.app.registerCanvasComponent(this);
  }

  draw(ctx) {
    const { x, y, w, h } = this;

    // Platform top surface
    const topGrad = ctx.createLinearGradient(x, y, x, y + h);
    topGrad.addColorStop(0, '#555');
    topGrad.addColorStop(0.3, '#444');
    topGrad.addColorStop(1, '#333');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + w - 3, y);
    ctx.stroke();

    // Shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + h, w - 4, 4, [0, 0, 2, 2]);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 10, y + h, 6, 8);
    ctx.fillRect(x + w - 16, y + h, 6, 8);
  }
}

customElements.define('stage-platform', Platform);
