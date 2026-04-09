export class Spaceship extends HTMLElement {
  connectedCallback() {
    this.app = this.closest('piano-app');
    this.canvas = this.app.canvas;
    this.ships = [];
    this.explosions = [];
    this._lastSpawn = 0;
    this._nextSpawn = this._randomDelay();
    this.app.registerCanvasComponent(this);
  }

  _randomDelay() {
    return 8000 + Math.random() * 20000;
  }

  _spawn() {
    const y = 40 + Math.random() * (this.canvas.height * 0.4);
    this.ships.push({
      x: -30,
      y,
      baseY: y,
      vx: 0.4 + Math.random() * 0.6,
      wobbleSpeed: 1 + Math.random() * 2,
      wobbleAmp: 8 + Math.random() * 15,
      phase: Math.random() * Math.PI * 2,
      size: 10 + Math.random() * 6,
      tiltSpeed: 1.5 + Math.random() * 2,
      tiltAmp: 0.15 + Math.random() * 0.15,
      tiltPhase: Math.random() * Math.PI * 2,
      spinSpeed: 2 + Math.random() * 2,
      spinPhase: Math.random() * Math.PI * 2,
    });
  }

  _checkBeamCollision(ship) {
    const keyboard = this.app.querySelector('piano-keyboard');
    if (!keyboard) return null;
    for (const key of keyboard.allKeys) {
      for (const beam of key.beams) {
        if (beam.height < 2) continue;
        const bx = beam.x, by = beam.y, bw = beam.width, bh = beam.height;
        const sx = ship.x - ship.size / 2, sy = ship.y - ship.size / 2;
        const sw = ship.size, sh = ship.size;
        if (sx < bx + bw && sx + sw > bx && sy < by + bh && sy + sh > by) {
          return beam.color;
        }
      }
    }
    return null;
  }

  _boom() {
    const ctx = this.app.audio.context;
    ctx.resume();

    // Noise burst
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
    noise.stop(ctx.currentTime + 0.3);

    // Low thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.2);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  _explode(ship, color) {
    const particles = [];
    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x: ship.x,
        y: ship.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1 + Math.random() * 2.5,
        life: 1,
        decay: 0.015 + Math.random() * 0.01,
        color,
      });
    }
    this.explosions.push({ particles });
  }

  update() {
    const now = performance.now();
    const t = now / 1000;

    // Spawn
    if (now - this._lastSpawn > this._nextSpawn) {
      this._spawn();
      this._lastSpawn = now;
      this._nextSpawn = this._randomDelay();
    }

    // Update ships
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const ship = this.ships[i];
      ship.x += ship.vx;
      ship.y = ship.baseY + Math.sin(t * ship.wobbleSpeed + ship.phase) * ship.wobbleAmp;
      ship.rotation = Math.sin(t * ship.tiltSpeed + ship.tiltPhase) * ship.tiltAmp;

      // Check beam collision
      const hitColor = this._checkBeamCollision(ship);
      if (hitColor) {
        this._explode(ship, hitColor);
        this._boom();
        this.ships.splice(i, 1);
        continue;
      }

      // Remove if off-screen right
      if (ship.x > this.canvas.width + 40) {
        this.ships.splice(i, 1);
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      for (let j = exp.particles.length - 1; j >= 0; j--) {
        const p = exp.particles[j];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        if (p.life <= 0) exp.particles.splice(j, 1);
      }
      if (exp.particles.length === 0) this.explosions.splice(i, 1);
    }
  }

  draw(ctx) {
    // Draw ships
    const t = performance.now() / 1000;
    for (const ship of this.ships) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.rotation);
      const s = ship.size;
      const spin = Math.cos(t * ship.spinSpeed + ship.spinPhase);
      const spinSin = Math.sin(t * ship.spinSpeed + ship.spinPhase);

      // Body — squash horizontally to fake 3D spin
      ctx.save();
      ctx.scale(1, 1);
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ring detail — shifts with spin
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.85, s * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Lights orbit around the rim
      const lightR = s * 0.7;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(spin * lightR, spinSin * s * 0.12, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#44ff44';
      ctx.beginPath();
      ctx.arc(-spin * lightR, -spinSin * s * 0.12, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Third light for depth
      ctx.fillStyle = '#ffff44';
      ctx.beginPath();
      ctx.arc(spinSin * lightR, spin * s * 0.12, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Dome
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.2, s * 0.4, s * 0.35, 0, Math.PI, 0);
      ctx.fill();

      // Dome shine — shifts with spin
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(spin * s * 0.12, -s * 0.35, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw explosions
    for (const exp of this.explosions) {
      for (const p of exp.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('hsl(', 'hsla(');
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8 * p.life;
        ctx.fill();
      }
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

customElements.define('space-ship', Spaceship);
