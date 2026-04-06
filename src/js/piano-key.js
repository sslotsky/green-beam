import { Beam } from './beam.js';

export class PianoKey {
  constructor(x, y, width, height, isBlack, label, midi, { beamWidth, beamOriginY, audio, recorder }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isBlack = isBlack;
    this.label = label;
    this.midi = midi;
    this.beamWidth = beamWidth;
    this.beamOriginY = beamOriginY;
    this.audio = audio;
    this.recorder = recorder;
    this.pressed = false;
    this.beams = [];
    this.activeNote = null;
  }

  press() {
    if (this.pressed) return;
    this.pressed = true;
    const beamX = this.x + (this.width - this.beamWidth) / 2;
    const hue = Math.floor(Math.random() * 360);
    const color = `hsl(${hue}, 80%, 55%)`;
    this.beams.push(new Beam(beamX, this.beamOriginY, this.beamWidth, 0, color, 2));
    this.activeNote = this.audio.play(this.midi);
    this.recorder.recordEvent('on', this.midi);
  }

  release() {
    if (!this.pressed) return;
    this.pressed = false;
    if (this.activeNote) {
      this.activeNote.stop();
      this.activeNote = null;
    }
    this.recorder.recordEvent('off', this.midi);
  }

  update() {
    this.beams.forEach(beam => beam.update(this.pressed && !beam.done));
    this.beams = this.beams.filter(b => !b.isOffScreen());
  }

  draw(ctx) {
    this.beams.forEach(beam => beam.draw(ctx));
    const { x, y, width, height, isBlack, pressed } = this;
    const r = 4;

    if (isBlack) {
      const depthOffset = pressed ? 1 : 3;
      const grad = ctx.createLinearGradient(x, y, x, y + height);
      if (pressed) {
        grad.addColorStop(0, '#444');
        grad.addColorStop(0.8, '#333');
        grad.addColorStop(1, '#222');
      } else {
        grad.addColorStop(0, '#333');
        grad.addColorStop(0.15, '#1a1a1a');
        grad.addColorStop(0.85, '#111');
        grad.addColorStop(1, '#000');
      }
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height + depthOffset, [0, 0, r, r]);
      ctx.fill();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 1, y, width - 2, height, [0, 0, r, r]);
      ctx.fill();
      if (!pressed) {
        const hlGrad = ctx.createLinearGradient(x, y, x, y + 6);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(x + 2, y, width - 4, 6);
      }
    } else {
      const depthOffset = pressed ? 1 : 3;
      const grad = ctx.createLinearGradient(x, y, x, y + height);
      if (pressed) {
        grad.addColorStop(0, '#d0d0d0');
        grad.addColorStop(0.9, '#c8c8c8');
        grad.addColorStop(1, '#bbb');
      } else {
        grad.addColorStop(0, '#f8f8f0');
        grad.addColorStop(0.6, '#fff');
        grad.addColorStop(0.9, '#f0efe8');
        grad.addColorStop(1, '#ddd');
      }
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height + depthOffset, [0, 0, r, r]);
      ctx.fill();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, width - 1, height, [0, 0, r, r]);
      ctx.fill();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y, width - 1, height, [0, 0, r, r]);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + width, y);
      ctx.lineTo(x + width, y + height - r);
      ctx.stroke();
    }
  }

  containsPoint(px, py) {
    return px >= this.x && px < this.x + this.width &&
           py >= this.y && py < this.y + this.height;
  }
}
