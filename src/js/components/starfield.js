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

    this.shootingStars = [];
    this._lastSpawn = 0;
    this._nextSpawn = this._randomDelay();

    this.app.registerCanvasComponent(this);
  }

  _randomDelay() {
    return 5000 + Math.random() * 10000;
  }

  _spawnShootingStar() {
    const canvas = this.app.canvas;
    const goRight = Math.random() > 0.5;
    const angle = goRight
      ? Math.PI * 0.05 + Math.random() * Math.PI * 0.2
      : Math.PI * 0.75 + Math.random() * Math.PI * 0.2;
    const speed = 3 + Math.random() * 3;
    this.shootingStars.push({
      x: goRight ? Math.random() * canvas.width * 0.4 : canvas.width * 0.6 + Math.random() * canvas.width * 0.4,
      y: Math.random() * canvas.height * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      tailLength: 80 + Math.random() * 60,
      life: 1,
      decay: 0.006 + Math.random() * 0.004,
    });
  }

  draw(ctx) {
    const t = performance.now() / 1000;
    const now = performance.now();

    // Twinkle stars
    for (const star of this.stars) {
      const alpha = star.baseAlpha + Math.sin(t * star.speed * 10 + star.phase) * 0.3;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
      ctx.fill();
    }

    // Spawn shooting stars
    if (now - this._lastSpawn > this._nextSpawn) {
      this._spawnShootingStar();
      this._lastSpawn = now;
      this._nextSpawn = this._randomDelay();
    }

    // Draw shooting stars
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.decay;

      if (s.life <= 0) {
        this.shootingStars.splice(i, 1);
        continue;
      }

      const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.tailLength;
      const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.tailLength;

      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
      grad.addColorStop(0.7, `rgba(255, 255, 255, ${s.life * 0.4})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${s.life})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Head glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.life})`;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 15 * s.life;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }
}

customElements.define('star-field', Starfield);
