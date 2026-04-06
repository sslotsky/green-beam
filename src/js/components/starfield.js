export class Starfield extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    const canvas = this.app.canvas;
    const count = parseInt(this.getAttribute('count') || '200');

    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5,
        baseAlpha: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.app.registerCanvasComponent(this);
  }

  draw(ctx) {
    const t = performance.now() / 1000;
    for (const star of this.stars) {
      const alpha = star.baseAlpha + Math.sin(t * star.speed * 10 + star.phase) * 0.3;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
      ctx.fill();
    }
  }
}

customElements.define('star-field', Starfield);
