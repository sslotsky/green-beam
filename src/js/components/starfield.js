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
        speed: Math.random() * 2 + 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Nebula — layered clouds that overlap to create depth and structure
    this.nebulaClouds = [];
    // 2-3 nebula clusters, each made of many overlapping blobs
    const clusterCount = 2 + Math.floor(Math.random() * 2);
    for (let c = 0; c < clusterCount; c++) {
      const cx = 150 + Math.random() * (canvas.width - 300);
      const cy = 60 + Math.random() * 280;
      // Each cluster has a primary and secondary color
      const palettes = [
        { primary: [180, 40, 220], secondary: [80, 60, 255], accent: [255, 80, 180] },
        { primary: [220, 50, 100], secondary: [255, 120, 60], accent: [255, 200, 80] },
        { primary: [40, 120, 255], secondary: [100, 200, 255], accent: [180, 60, 220] },
        { primary: [60, 200, 180], secondary: [40, 100, 220], accent: [160, 60, 255] },
      ];
      const pal = palettes[Math.floor(Math.random() * palettes.length)];

      // Large base clouds
      for (let i = 0; i < 5; i++) {
        const color = i < 3 ? pal.primary : pal.secondary;
        this.nebulaClouds.push({
          x: cx + (Math.random() - 0.5) * 200,
          y: cy + (Math.random() - 0.5) * 120,
          radius: 100 + Math.random() * 150,
          r: color[0], g: color[1], b: color[2],
          alpha: 0.08 + Math.random() * 0.06,
        });
      }
      // Medium detail clouds
      for (let i = 0; i < 8; i++) {
        const colors = [pal.primary, pal.secondary, pal.accent];
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.nebulaClouds.push({
          x: cx + (Math.random() - 0.5) * 250,
          y: cy + (Math.random() - 0.5) * 150,
          radius: 40 + Math.random() * 80,
          r: color[0], g: color[1], b: color[2],
          alpha: 0.1 + Math.random() * 0.12,
        });
      }
      // Small bright cores
      for (let i = 0; i < 4; i++) {
        const color = pal.accent;
        this.nebulaClouds.push({
          x: cx + (Math.random() - 0.5) * 120,
          y: cy + (Math.random() - 0.5) * 80,
          radius: 15 + Math.random() * 35,
          r: color[0], g: color[1], b: color[2],
          alpha: 0.15 + Math.random() * 0.15,
        });
      }
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

    // Nebula clouds
    for (const c of this.nebulaClouds) {
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
      grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.alpha})`);
      grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.alpha * 0.5})`);
      grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Twinkle stars
    for (const star of this.stars) {
      const alpha = star.baseAlpha + Math.sin(t * star.speed + star.phase) * 0.3;
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
