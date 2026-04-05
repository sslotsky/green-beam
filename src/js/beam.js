export class Beam {
  constructor(x, y, width, height, color, velocity) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.velocity = velocity;
    this.done = false;
  }

  update(active) {
    if (active && !this.done) {
      this.y -= this.velocity;
      this.height += this.velocity;
    } else {
      this.y -= this.velocity;
      this.done = true;
    }
  }

  isOffScreen() {
    return this.y + this.height < 0;
  }

  draw(ctx) {
    const r = 6;
    const radii = this.done ? r : [r, r, 0, 0];
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, radii);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}
