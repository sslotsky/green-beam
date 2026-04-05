export class Jukebox {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.hover = false;
  }

  containsPoint(px, py) {
    return px >= this.x && px < this.x + this.w &&
           py >= this.y && py < this.y + this.h;
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    const cx = x + w / 2;

    if (this.hover) {
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 15;
    }

    // Base body
    const bodyY = y + 30;
    const bodyH = h - 30;
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#8B4513');
    grad.addColorStop(0.3, '#D2691E');
    grad.addColorStop(0.5, '#DEB887');
    grad.addColorStop(0.7, '#D2691E');
    grad.addColorStop(1, '#8B4513');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, bodyY, w, bodyH, [0, 0, 8, 8]);
    ctx.fill();

    // Dome top
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + 2, w / 2, 32, 0, Math.PI, 0);
    ctx.fill();

    // Glass window
    const glassGrad = ctx.createLinearGradient(x + 8, bodyY - 10, x + 8, bodyY + 40);
    glassGrad.addColorStop(0, '#ffee88');
    glassGrad.addColorStop(0.5, '#ffcc44');
    glassGrad.addColorStop(1, '#ff8800');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(x + 10, bodyY + 40);
    ctx.lineTo(x + 10, bodyY + 8);
    ctx.quadraticCurveTo(cx, bodyY - 22, x + w - 10, bodyY + 8);
    ctx.lineTo(x + w - 10, bodyY + 40);
    ctx.closePath();
    ctx.fill();

    // Record lines in the glass
    ctx.strokeStyle = '#aa6600';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ly = bodyY + 12 + i * 7;
      ctx.beginPath();
      ctx.moveTo(x + 16, ly);
      ctx.lineTo(x + w - 16, ly);
      ctx.stroke();
    }

    // Speaker grille
    const grillY = bodyY + 55;
    const grillH = 60;
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.roundRect(x + 10, grillY, w - 20, grillH, 4);
    ctx.fill();

    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ly = grillY + 5 + i * 7;
      ctx.beginPath();
      ctx.moveTo(x + 14, ly);
      ctx.lineTo(x + w - 14, ly);
      ctx.stroke();
    }

    // Decorative trim
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, bodyY + 48);
    ctx.lineTo(x + w - 6, bodyY + 48);
    ctx.stroke();

    // Coin slot
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(cx - 8, bodyY + bodyH - 18, 16, 6, 2);
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - 8, bodyY + bodyH - 18, 16, 6, 2);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 6, y + h - 4, 10, 6);
    ctx.fillRect(x + w - 16, y + h - 4, 10, 6);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JUKEBOX', cx, bodyY + bodyH - 24);
    ctx.textAlign = 'left';
  }
}
